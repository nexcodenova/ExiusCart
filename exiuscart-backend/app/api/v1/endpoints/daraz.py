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
     → we validate state, then exchange the code for a real access_token via
       /auth/token/create (see _exchange_code_for_token and _daraz_signed_request).

Every Daraz Open Platform API call — including the token exchange itself —
must be signed: sort all params alphabetically, concatenate as
"key1value1key2value2...", prepend the API path, HMAC-SHA256 with the App
Secret, uppercase-hex the digest. This is implemented once in
_daraz_signed_request and reused for every future Daraz API call (orders,
products, etc.), not just auth.
"""
import os
import time
import hmac
import hashlib
import secrets
import logging
from datetime import datetime, timezone, timedelta
from urllib.parse import urlencode

import httpx
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
DARAZ_AUTHORIZE_URL = os.getenv("DARAZ_AUTHORIZE_URL", "https://api.daraz.lk/oauth/authorize")
DARAZ_API_BASE_URL = os.getenv("DARAZ_API_BASE_URL", "https://api.daraz.com/rest")

STOREFRONT_BASE = "https://store.exiuscart.com"


def _daraz_signed_request(api_path: str, business_params: dict, access_token: str | None = None) -> dict | None:
    """Calls any Daraz Open Platform API with correct HMAC-SHA256 signing.
    api_path is e.g. "/auth/token/create" or "/order/get". Returns the parsed
    JSON response, or None on a transport/HTTP failure (logs the reason)."""
    params = {
        "app_key": DARAZ_APP_KEY,
        "sign_method": "sha256",
        "timestamp": str(int(time.time() * 1000)),
        **business_params,
    }
    if access_token:
        params["access_token"] = access_token

    sorted_keys = sorted(params.keys())
    concatenated = api_path + "".join(f"{k}{params[k]}" for k in sorted_keys)
    sign = hmac.new(
        DARAZ_APP_SECRET.encode("utf-8"), concatenated.encode("utf-8"), hashlib.sha256
    ).hexdigest().upper()
    params["sign"] = sign

    url = f"{DARAZ_API_BASE_URL}{api_path}"
    try:
        resp = httpx.get(url, params=params, timeout=15)
        return resp.json()
    except Exception as e:
        logger.error(f"[DARAZ API] request to {api_path} failed: {e}")
        return None


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
        # Real Daraz API call failed (bad/expired code, network issue, etc.) —
        # leave the connection pending rather than silently dropping the
        # seller's authorization. Safe to retry since the code is still on
        # this ChannelConnection row.
        conn.seller_status = "pending_token_exchange"
        db.commit()
        logger.warning(f"[DARAZ OAUTH] shop={conn.shop_id} token exchange failed — connection left pending, see error above")
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
    """Exchanges an OAuth authorization code for a real access_token via
    POST /auth/token/create, per open.daraz.com's Quick Start Guide →
    Seller authorization introduction. Returns None on failure so the
    caller can leave the connection "pending" instead of guessing."""
    data = _daraz_signed_request("/auth/token/create", {"code": code})
    if not data or "access_token" not in data:
        logger.error(f"[DARAZ OAUTH] token exchange failed — response: {data}")
        return None

    expires_at = datetime.now(timezone.utc) + timedelta(seconds=data.get("expires_in", 0))
    return {
        "access_token": data["access_token"],
        "refresh_token": data.get("refresh_token"),
        "expires_at": expires_at,
    }
