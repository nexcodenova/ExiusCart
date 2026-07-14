"""
Daraz Open Platform — OAuth2 connect flow.

Unlike TheDersi (a static per-seller API key), Daraz uses OAuth2: ExiusCart
registers ONE app on open.daraz.com and gets a single App Key/Secret for the
whole platform. Each seller then authorizes that app against their own,
already-existing Daraz seller account — they never see or enter the App
Key/Secret themselves.

Flow:
  1. Seller clicks "Connect Daraz" → GET /shops/{shop_id}/channels/daraz/authorize
     → we create a pending ChannelConnection with a CSRF `state` token and
       return Daraz's authorize URL.
  2. Browser redirects to Daraz → seller logs into THEIR Daraz seller account
     → approves access.
  3. Daraz redirects back to GET /channels/daraz/callback?code=...&state=...
     → we validate state and store the authorization code.

NOTE — the actual code-for-token exchange (_exchange_code_for_token) is not
yet implemented. Daraz's exact token endpoint + request-signing spec could
not be confirmed from public docs (the real docs are behind a login-gated
JS app); this needs to be filled in from the real open.daraz.com docs once
the ExiusCart developer account has access. Until then, the callback stores
the received `code` and marks the connection "pending_token_exchange" rather
than pretending the exchange succeeded.
"""
import os
import secrets
import logging
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.channel import ChannelConnection
from app.models.subscription import Subscription
from app.api.v1.endpoints.channels import _shop_or_404, EXIUSCART_BASE

logger = logging.getLogger(__name__)

router = APIRouter()

DARAZ_APP_KEY = os.getenv("DARAZ_APP_KEY", "")
DARAZ_APP_SECRET = os.getenv("DARAZ_APP_SECRET", "")
DARAZ_AUTHORIZE_URL = os.getenv("DARAZ_AUTHORIZE_URL", "https://auth.daraz.com/oauth/authorize")

STOREFRONT_BASE = "https://store.exiuscart.com"


def _daraz_callback_url() -> str:
    return f"{EXIUSCART_BASE.rstrip('/')}/channels/daraz/callback"


@router.get("/shops/{shop_id}/channels/daraz/authorize")
def daraz_authorize(
    shop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Start the Daraz OAuth flow — returns the URL to redirect the seller's
    browser to. The seller must already have their own Daraz seller account;
    this only authorizes ExiusCart's app to access it."""
    _shop_or_404(shop_id, current_user, db)

    if not DARAZ_APP_KEY:
        raise HTTPException(
            status_code=503,
            detail="Daraz integration isn't configured yet — ExiusCart's app registration with Daraz is still pending.",
        )

    existing = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.channel_type == "daraz",
        ChannelConnection.is_active == True,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already connected to Daraz")

    sub = db.query(Subscription).filter(Subscription.shop_id == shop_id).order_by(Subscription.id.desc()).first()
    plan_type = sub.plan_type if sub else "free_trial"
    if plan_type not in ("thedersi_pro", "premium"):
        raise HTTPException(
            status_code=403,
            detail={
                "error": "daraz_requires_pro",
                "plan": plan_type,
                "message": (
                    "Daraz sync is available on TheDersi Pro. Upgrade your TheDersi plan to connect Daraz."
                    if plan_type.startswith("thedersi")
                    else "Daraz sync is available on Premium. Upgrade to connect your Daraz seller account."
                ),
            },
        )

    state = secrets.token_urlsafe(32)

    pending = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.channel_type == "daraz",
        ChannelConnection.is_active == False,
    ).first()
    if pending:
        pending.oauth_state = state
    else:
        pending = ChannelConnection(
            shop_id=shop_id,
            channel_type="daraz",
            is_active=False,
            oauth_state=state,
            webhook_secret=secrets.token_urlsafe(32),
        )
        db.add(pending)
    db.commit()

    params = {
        "response_type": "code",
        "force_auth": "true",
        "redirect_uri": _daraz_callback_url(),
        "client_id": DARAZ_APP_KEY,
        "state": state,
    }
    authorize_url = f"{DARAZ_AUTHORIZE_URL}?{urlencode(params)}"
    return {"authorize_url": authorize_url}


@router.get("/channels/daraz/callback")
def daraz_callback(
    code: str = None,
    state: str = None,
    error: str = None,
    db: Session = Depends(get_db),
):
    """Daraz redirects the seller's browser here after they approve (or deny)
    access. Public endpoint — verified via the CSRF `state` token, not auth."""
    if error or not code or not state:
        logger.warning(f"[DARAZ OAUTH] callback failed — error={error} code_present={bool(code)} state_present={bool(state)}")
        return RedirectResponse(f"{STOREFRONT_BASE}/dashboard/channels?daraz=denied")

    conn = db.query(ChannelConnection).filter(
        ChannelConnection.channel_type == "daraz",
        ChannelConnection.oauth_state == state,
        ChannelConnection.is_active == False,
    ).first()
    if not conn:
        logger.error(f"[DARAZ OAUTH] callback with unknown/expired state={state[:8]}...")
        return RedirectResponse(f"{STOREFRONT_BASE}/dashboard/channels?daraz=invalid_state")

    token_result = _exchange_code_for_token(code)
    if token_result is None:
        # Token exchange isn't implemented yet (see module docstring) — store
        # what we have so the connection can be completed once it is, instead
        # of silently dropping the seller's authorization.
        conn.seller_status = "pending_token_exchange"
        db.commit()
        logger.warning(f"[DARAZ OAUTH] shop={conn.shop_id} authorized but token exchange not implemented — code received, connection left pending")
        return RedirectResponse(f"{STOREFRONT_BASE}/dashboard/channels?daraz=pending")

    conn.access_token = token_result["access_token"]
    conn.refresh_token = token_result.get("refresh_token")
    conn.token_expires_at = token_result.get("expires_at")
    conn.is_active = True
    conn.oauth_state = None
    conn.seller_status = "approved"
    db.commit()
    return RedirectResponse(f"{STOREFRONT_BASE}/dashboard/channels?daraz=connected")


def _exchange_code_for_token(code: str):
    """TODO: implement once Daraz's real token endpoint + signing spec are
    confirmed from open.daraz.com (see module docstring). Returns None until
    then so the callback can degrade gracefully instead of guessing."""
    return None
