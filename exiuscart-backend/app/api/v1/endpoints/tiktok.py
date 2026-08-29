"""
TikTok Shop Partner API — OAuth2 connect flow.

Sales channel (list products, sell, sync orders back), the same shape as
eBay/Daraz — not a dropship supplier. ExiusCart registers ONE app in TikTok
Shop Partner Center (partner.tiktokshop.com) and gets a single App Key/App
Secret for the whole platform; each seller then authorizes that app against
their own, already-existing TikTok Shop seller account.

Flow:
  1. Seller clicks "Connect TikTok Shop" → GET
     /shops/{shop_id}/channels/tiktok/authorize → we create a pending
     ChannelConnection with a CSRF `state` token and return TikTok's
     authorize URL.
  2. Browser redirects to TikTok → seller logs into THEIR TikTok Shop
     seller account → approves access.
  3. TikTok redirects back to GET /channels/tiktok/callback?code=...&state=...
     → we exchange the code for a real access_token via
     GET https://auth.tiktok-shops.com/api/v2/token/get (see
     _exchange_code_for_token).

Sourcing note on what's confirmed vs guessed, since eBay's and AliExpress's
own first real connect attempts each failed 2-3 times from guessed
endpoints before landing on the right one (see their own module docstrings)
— this integration hasn't had that live-attempt pass yet, so treat anything
not explicitly marked CONFIRMED as a best-effort first guess to verify once
TIKTOK_APP_KEY/TIKTOK_APP_SECRET exist:

  - Token endpoint + the "authorized_code" grant_type spelling (TikTok's own
    non-standard spelling, NOT the OAuth-spec "authorization_code") —
    CONFIRMED against TikTok's own documented example request.
  - Request signing (HMAC-SHA256 of sorted params, wrapped
    APP_SECRET+query+APP_SECRET, uppercase hex, param name "sign") —
    reconstructed from third-party integration guides, not TikTok's own
    primary docs directly (those sit behind an authenticated Partner Center
    session this environment couldn't reach) — UNVERIFIED, re-check
    against Partner Center's own API Reference once logged in.
  - The seller-facing authorize URL itself — TikTok Shop Partner Center
    generates and displays this directly on your app's own detail page
    (confirmed via a third-party iPaaS's own setup guide, which instructs
    copying it from there) rather than following one universal documented
    shape, so it's read from TIKTOK_AUTHORIZE_URL_TEMPLATE (see below)
    instead of being hardcoded/guessed here.

Every substantive Shop API call goes through _tiktok_api_request, the
TikTok equivalent of eBay's _ebay_api_request / Daraz's
_daraz_signed_request — the one function every future TikTok API call
(products, orders, fulfillment) is built on.
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
from app.core.thedersi import is_thedersi_shop
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.channel import ChannelConnection
from app.models.subscription import Subscription
from app.api.v1.endpoints.channels import _shop_or_404

logger = logging.getLogger(__name__)

router = APIRouter()

TIKTOK_APP_KEY = os.getenv("TIKTOK_APP_KEY", "")
TIKTOK_APP_SECRET = os.getenv("TIKTOK_APP_SECRET", "")

# Partner Center shows the full seller-authorization URL on the app's own
# detail page once registered — paste it here verbatim, with the literal
# substring "{state}" wherever TikTok's own URL has its state/CSRF param
# value, e.g. "https://services.tiktokshop.com/open/authorize?service_id=
# xxxx&state={state}". Left blank (integration "not configured") until
# then, same honest-503 treatment as EBAY_APP_ID/EBAY_RU_NAME below.
TIKTOK_AUTHORIZE_URL_TEMPLATE = os.getenv("TIKTOK_AUTHORIZE_URL_TEMPLATE", "")

TIKTOK_AUTH_BASE = "https://auth.tiktok-shops.com"
TIKTOK_API_BASE = "https://open-api.tiktokglobalshop.com"

STOREFRONT_BASE = "https://store.exiuscart.com"


def _tiktok_sign(path: str, params: dict) -> str:
    """HMAC-SHA256 request signing — sign_src = APP_SECRET + sorted(key+value
    concatenated) + APP_SECRET, keyed by APP_SECRET, uppercase hex digest.
    UNVERIFIED — see module docstring; confirm against Partner Center's own
    API Reference on first real signed call, the same way eBay's
    Content-Language header requirement and AliExpress's token endpoint
    were each only nailed down after a real failed attempt."""
    query = "".join(f"{k}{v}" for k, v in sorted(params.items()))
    sign_src = f"{TIKTOK_APP_SECRET}{path}{query}{TIKTOK_APP_SECRET}"
    return hmac.new(TIKTOK_APP_SECRET.encode("utf-8"), sign_src.encode("utf-8"), hashlib.sha256).hexdigest().upper()


def _tiktok_token_request(grant_type: str, **params) -> dict | None:
    """GET https://auth.tiktok-shops.com/api/v2/token/get — used for both
    the initial authorization-code exchange and every later refresh.
    grant_type is "authorized_code" (TikTok's own spelling) for the first
    exchange, "refresh_token" for refreshes — confirmed against TikTok's
    own documented example request."""
    if not TIKTOK_APP_KEY or not TIKTOK_APP_SECRET:
        logger.error("[TIKTOK OAUTH] TIKTOK_APP_KEY/TIKTOK_APP_SECRET not configured")
        return None
    params = {"app_key": TIKTOK_APP_KEY, "app_secret": TIKTOK_APP_SECRET, "grant_type": grant_type, **params}
    try:
        resp = httpx.get(f"{TIKTOK_AUTH_BASE}/api/v2/token/get", params=params, timeout=15)
        result = resp.json()
        # TikTok wraps real responses as {"code": 0, "message": "success", "data": {...}}
        if resp.status_code >= 300 or result.get("code") != 0:
            logger.error(f"[TIKTOK OAUTH] token request ({grant_type}) failed — status={resp.status_code} body={result}")
            return None
        return result.get("data")
    except Exception as e:
        logger.error(f"[TIKTOK OAUTH] token request ({grant_type}) failed: {e}")
        return None


def _exchange_code_for_token(code: str) -> dict | None:
    data = _tiktok_token_request("authorized_code", auth_code=code)
    if not data:
        return None
    return {
        "access_token": data["access_token"],
        "refresh_token": data.get("refresh_token"),
        "expires_at": datetime.now(timezone.utc) + timedelta(seconds=data.get("access_token_expire_in", 0)),
        # shop_cipher identifies which shop's data a call is for — required
        # on every subsequent Shop API request, stored in the same generic
        # channel_api_key slot eBay reuses for its Business Policies blob.
        "shop_cipher": data.get("shop_cipher"),
    }


def _tiktok_ensure_token(conn: ChannelConnection, db: Session) -> str:
    """Returns a valid TikTok access token, proactively refreshing if
    expired or about to expire — mirrors eBay's _ebay_ensure_token /
    dropshipping.py's _cj_ensure_token."""
    now = datetime.now(timezone.utc)
    buffer = timedelta(minutes=5)
    if conn.access_token and conn.token_expires_at and conn.token_expires_at > now + buffer:
        return conn.access_token

    if not conn.refresh_token:
        raise HTTPException(status_code=400, detail={
            "error": "tiktok_reconnect_required",
            "message": "TikTok Shop session expired. Please reconnect your TikTok Shop account.",
        })

    data = _tiktok_token_request("refresh_token", refresh_token=conn.refresh_token)
    if not data:
        raise HTTPException(status_code=400, detail={
            "error": "tiktok_reconnect_required",
            "message": "Could not refresh TikTok Shop session. Please reconnect your TikTok Shop account.",
        })

    conn.access_token = data["access_token"]
    conn.refresh_token = data.get("refresh_token", conn.refresh_token)
    conn.token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=data.get("access_token_expire_in", 0))
    db.commit()
    return conn.access_token


def _tiktok_api_request(method: str, path: str, conn: ChannelConnection, db: Session, params: dict | None = None, **kwargs) -> httpx.Response | None:
    """The one function every TikTok Shop API call goes through — ensures a
    fresh token, signs the request, hits TIKTOK_API_BASE + path. Direct
    parallel to eBay's _ebay_api_request / Daraz's _daraz_signed_request."""
    token = _tiktok_ensure_token(conn, db)
    params = dict(params or {})
    params.update({
        "app_key": TIKTOK_APP_KEY,
        "access_token": token,
        "shop_cipher": conn.channel_api_key or "",
        "timestamp": int(time.time()),
        "sign_method": "HmacSHA256",
    })
    params["sign"] = _tiktok_sign(path, {k: v for k, v in params.items() if k != "sign"})
    url = f"{TIKTOK_API_BASE}{path}"
    try:
        with httpx.Client(timeout=20) as client:
            return client.request(method, url, params=params, **kwargs)
    except Exception as e:
        logger.error(f"[TIKTOK API] {method} {path} failed: {e}")
        return None


# ── OAuth connect ────────────────────────────────────────────────────────────

@router.get("/shops/{shop_id}/channels/tiktok/authorize")
def tiktok_authorize(
    shop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Start the TikTok Shop OAuth flow — returns the URL to redirect the
    seller's browser to. The seller must already have their own TikTok Shop
    seller account; this only authorizes ExiusCart's app to access it.

    Gated to match what the pricing page actually promises (Starter: pick
    any one channel; Premium: all channels) rather than copying eBay's
    inline Premium-only gate — eBay's own gate currently contradicts its
    own pricing-page copy (flagged separately, not fixed here)."""
    shop = _shop_or_404(shop_id, current_user, db)

    if not TIKTOK_APP_KEY or not TIKTOK_AUTHORIZE_URL_TEMPLATE:
        raise HTTPException(
            status_code=503,
            detail="TikTok Shop integration isn't configured yet — ExiusCart's app registration with TikTok is still pending.",
        )

    # Same restriction already applied to every non-TheDersi/Daraz channel.
    if is_thedersi_shop(shop_id, db):
        raise HTTPException(
            status_code=403,
            detail={
                "error": "channel_not_available",
                "message": "Your plan is managed by TheDersi. Only TheDersi and Daraz channels are available on TheDersi plans.",
            },
        )

    existing = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.channel_type == "tiktok",
        ChannelConnection.is_active == True,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already connected to TikTok Shop")

    sub = db.query(Subscription).filter(Subscription.shop_id == shop_id).order_by(Subscription.id.desc()).first()
    plan_type = sub.plan_type if sub else "free_trial"
    if plan_type == "starter":
        # Starter: one channel of its choice, same generic cap already
        # enforced for the API-key-style channels in channels.py's
        # connect_channel(). TikTok is OAuth-based so it has its own
        # authorize endpoint (like eBay/Daraz) and re-implements that same
        # check inline rather than going through connect_channel().
        other = db.query(ChannelConnection).filter(
            ChannelConnection.shop_id == shop_id,
            ChannelConnection.is_active == True,
        ).first()
        if other:
            raise HTTPException(status_code=403, detail={
                "error": "channel_limit_reached",
                "connected_channel": other.channel_type,
                "message": f"Your Starter plan includes one channel at a time. You already have {other.channel_type.title()} connected — disconnect it first, or upgrade to Premium to connect every channel at once.",
            })
    elif plan_type not in ("premium",):
        raise HTTPException(
            status_code=403,
            detail={
                "error": "plan_required",
                "plan": plan_type,
                "message": "TikTok Shop is available on Starter (as your one channel) and Premium (all channels). Upgrade to connect your TikTok Shop account.",
            },
        )

    state = secrets.token_urlsafe(32)

    pending = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.channel_type == "tiktok",
        ChannelConnection.is_active == False,
    ).first()
    if pending:
        pending.oauth_state = state
    else:
        pending = ChannelConnection(
            shop_id=shop_id,
            channel_type="tiktok",
            is_active=False,
            oauth_state=state,
            webhook_secret=secrets.token_urlsafe(32),
        )
        db.add(pending)
    db.commit()

    authorize_url = TIKTOK_AUTHORIZE_URL_TEMPLATE.format(state=state)
    return {"authorize_url": authorize_url}


@router.get("/channels/tiktok/callback")
def tiktok_callback(
    code: str = None,
    state: str = None,
    error: str = None,
    db: Session = Depends(get_db),
):
    """TikTok redirects the seller's browser here after they approve (or
    deny) access. Public endpoint — verified via the CSRF `state` token,
    not auth. Mirrors eBay's callback exactly."""
    if error or not code or not state:
        logger.warning(f"[TIKTOK OAUTH] callback failed — error={error} code_present={bool(code)} state_present={bool(state)}")
        return RedirectResponse(f"{STOREFRONT_BASE}/dashboard/tiktok-integration?tiktok=denied")

    conn = db.query(ChannelConnection).filter(
        ChannelConnection.channel_type == "tiktok",
        ChannelConnection.oauth_state == state,
        ChannelConnection.is_active == False,
    ).first()
    if not conn:
        logger.error(f"[TIKTOK OAUTH] callback with unknown/expired state={state[:8]}...")
        return RedirectResponse(f"{STOREFRONT_BASE}/dashboard/tiktok-integration?tiktok=invalid_state")

    token_result = _exchange_code_for_token(code)
    if token_result is None:
        conn.seller_status = "pending_token_exchange"
        db.commit()
        logger.warning(f"[TIKTOK OAUTH] shop={conn.shop_id} token exchange failed — connection left pending, see error above")
        return RedirectResponse(f"{STOREFRONT_BASE}/dashboard/tiktok-integration?tiktok=pending")

    conn.access_token = token_result["access_token"]
    conn.refresh_token = token_result.get("refresh_token")
    conn.token_expires_at = token_result.get("expires_at")
    conn.channel_api_key = token_result.get("shop_cipher")
    conn.is_active = True
    conn.oauth_state = None
    conn.seller_status = "approved"
    db.commit()
    return RedirectResponse(f"{STOREFRONT_BASE}/dashboard/tiktok-integration?tiktok=connected")


def _get_tiktok_connection(shop_id: int, db: Session) -> ChannelConnection:
    conn = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.channel_type == "tiktok",
        ChannelConnection.is_active == True,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="TikTok Shop is not connected.")
    return conn


@router.get("/shops/{shop_id}/channels/tiktok/status")
def tiktok_status(
    shop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Connection status for the dashboard page — product listing and order
    sync (the eBay-equivalent create_ebay_listing/sync_ebay_orders) aren't
    built yet; this endpoint exists so the frontend has something real to
    show once Connect succeeds, same incremental order eBay itself was
    built in (connect flow first, product/order endpoints after)."""
    _shop_or_404(shop_id, current_user, db)
    conn = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.channel_type == "tiktok",
        ChannelConnection.is_active == True,
    ).first()
    return {
        "connected": conn is not None,
        "last_synced_at": conn.last_synced_at.isoformat() if conn and conn.last_synced_at else None,
    }
