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

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
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
# CONFIRMED (endpoint path pattern only, e.g. "product/202309/images/upload")
# against TikTok's own documented page titles — every Shop API path is
# prefixed by a resource name + this version string.
TIKTOK_API_VERSION = "202309"

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
    """Connection status for the dashboard page."""
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


# ── Product listing ──────────────────────────────────────────────────────────
#
# UNVERIFIED END TO END — unlike the OAuth flow above (which has confirmed
# sources for its critical pieces), nothing below has a confirmed real
# request/response shape. All that's actually confirmed from public sources
# is the endpoint *path pattern* (resource/202309/action) and that TikTok's
# Product API is image-upload-then-create (two calls, not one) — the same
# shape AliExpress's own _aliexpress_fetch_product docstring warns about
# before it had real docs to check against. Field names below (title,
# description, category_id, skus[].price/stock, etc.) are inferred from
# TikTok's own REST naming conventions elsewhere in this file (snake_case,
# matching the token endpoint's real fields), NOT read from a confirmed
# schema. Treat every field name as something to verify against Partner
# Center's own API Reference (available once App Review grants real API
# scope access) before trusting a real response, exactly like eBay's
# Content-Language header requirement was only found after a real failed
# listing attempt.

def _log_tiktok_sync(shop_id: int, product_id: int | None, action: str, success: bool, external_id: str | None, error_message: str | None, db: Session):
    from app.models.channel_sync_log import ChannelSyncLog
    db.add(ChannelSyncLog(
        shop_id=shop_id, product_id=product_id, channel_type="tiktok",
        action=action, success=success, external_id=external_id, error_message=error_message,
    ))
    db.commit()


def _tiktok_upload_image(image_url: str, conn: ChannelConnection, db: Session) -> str | None:
    """UNVERIFIED. Best guess: TikTok requires product images to be
    uploaded to their own CDN first (image-by-URL, not raw bytes, matching
    how most REST product APIs of this shape work), returning an internal
    `uri` to reference in the product-create call. Path pattern itself
    (product/202309/images/upload) is CONFIRMED from TikTok's own doc page
    title; the request/response field names (img_url in, uri out) are
    inferred, not confirmed."""
    resp = _tiktok_api_request(
        "POST", f"/product/{TIKTOK_API_VERSION}/images/upload",
        conn, db, json={"img_url": image_url},
    )
    if resp is None or resp.status_code >= 300:
        logger.error(f"[TIKTOK PRODUCT] image upload failed for {image_url}: {resp.text[:300] if resp else 'no response'}")
        return None
    data = resp.json().get("data") or {}
    return data.get("uri")


class TiktokCreateListingIn(BaseModel):
    category_id: str


@router.post("/shops/{shop_id}/channels/tiktok/products/{product_id}/create")
def create_tiktok_listing(
    shop_id: int,
    product_id: int,
    data: TiktokCreateListingIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lists a product on TikTok Shop — mirrors eBay's create_ebay_listing
    shape (upload images, then create), recorded the same way via
    ChannelProductStatus + _log_tiktok_sync. See module note above: the
    exact TikTok field names are UNVERIFIED, this will need adjustment on
    the first real attempt."""
    from app.models.product import Product
    from app.models.product_fields import ProductImage
    from app.models.channel_product_status import ChannelProductStatus

    shop = _shop_or_404(shop_id, current_user, db)
    conn = _get_tiktok_connection(shop_id, db)
    product = db.query(Product).filter(Product.id == product_id, Product.shop_id == shop_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    # TikTok Shop is a physical-goods marketplace — digital/affiliate
    # products don't belong here (see the same guard on eBay). Sell those
    # through the Custom Website, Whop, or Gumroad.
    if (product.product_type or "physical") != "physical":
        raise HTTPException(
            status_code=400,
            detail=f"“{product.name}” is a {product.product_type} product. TikTok Shop only lists physical products — sell digital items through your Custom Website, Whop, or Gumroad.",
        )

    images = db.query(ProductImage).filter(ProductImage.product_id == product_id).order_by(ProductImage.sort_order).all()
    uploaded_uris = []
    for img in images[:9]:  # TikTok Shop's own UI caps product images around 9 — matched here, not confirmed as a hard API limit
        uri = _tiktok_upload_image(img.url, conn, db)
        if uri:
            uploaded_uris.append(uri)

    if not uploaded_uris:
        _log_tiktok_sync(shop_id, product_id, "create_listing", False, None, "No images could be uploaded to TikTok", db)
        raise HTTPException(status_code=502, detail="Could not upload any product images to TikTok Shop.")

    body = {
        "category_id": data.category_id,
        "title": product.name[:255],
        "description": (product.description or product.name)[:5000],
        "images": [{"uri": uri} for uri in uploaded_uris],
        "skus": [{
            "sales_attributes": [],
            "price": {"amount": str(product.price), "currency": conn.channel_currency or "USD"},
            "inventory": [{"warehouse_id": "", "quantity": int(product.quantity or 0)}],
            "seller_sku": product.sku or f"EC-{product.id}",
        }],
    }
    resp = _tiktok_api_request("POST", f"/product/{TIKTOK_API_VERSION}/products", conn, db, json=body)
    if resp is None or resp.status_code >= 300:
        error_detail = resp.text[:500] if resp is not None else "no response"
        _log_tiktok_sync(shop_id, product_id, "create_listing", False, None, error_detail, db)
        raise HTTPException(status_code=502, detail=f"TikTok Shop rejected the listing: {error_detail}")

    external_id = (resp.json().get("data") or {}).get("product_id")
    existing = db.query(ChannelProductStatus).filter(
        ChannelProductStatus.product_id == product_id,
        ChannelProductStatus.channel_type == "tiktok",
    ).first()
    if existing:
        existing.status = "pending_review"
        existing.external_item_id = external_id
    else:
        db.add(ChannelProductStatus(product_id=product_id, shop_id=shop_id, channel_type="tiktok", status="pending_review", external_item_id=external_id))
    db.commit()
    _log_tiktok_sync(shop_id, product_id, "create_listing", True, external_id, None, db)
    return {"message": "Listed on TikTok Shop — pending TikTok's own review.", "external_id": external_id}


@router.get("/shops/{shop_id}/channels/tiktok/products/{product_id}/listing")
def get_tiktok_listing_status(
    shop_id: int,
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.channel_product_status import ChannelProductStatus
    _shop_or_404(shop_id, current_user, db)
    status = db.query(ChannelProductStatus).filter(
        ChannelProductStatus.product_id == product_id,
        ChannelProductStatus.channel_type == "tiktok",
    ).first()
    if not status:
        return {"listed": False}
    return {"listed": True, "status": status.status, "external_id": status.external_item_id, "rejection_reason": status.rejection_reason}


# ── Order sync ────────────────────────────────────────────────────────────────
# Same UNVERIFIED caveat as Product listing above. order_status and
# page_size as real param names, and the endpoint path pattern, are
# CONFIRMED from public fragments (a real PHP SDK's documented usage); the
# full response shape (line item / SKU / recipient field names) is
# inferred from TikTok's own snake_case convention, not confirmed.

def fetch_tiktok_orders(conn: ChannelConnection, db: Session, days: int = 7) -> list | None:
    """POST /order/202309/orders/search — paginated via next_page_token
    (TikTok's documented pattern for other list endpoints, applied here by
    inference). order_status/page_size params are the two pieces actually
    confirmed from a public source; everything else about this call is a
    best-effort guess to verify on first real use."""
    orders = []
    page_token = None
    create_time_ge = int((datetime.now(timezone.utc) - timedelta(days=days)).timestamp())
    for _ in range(20):  # hard cap so a pagination bug can't loop forever
        body = {"create_time_ge": create_time_ge}
        params = {"page_size": 50}
        if page_token:
            params["page_token"] = page_token
        resp = _tiktok_api_request("POST", f"/order/{TIKTOK_API_VERSION}/orders/search", conn, db, params=params, json=body)
        if resp is None or resp.status_code >= 300:
            logger.error(f"[TIKTOK ORDERS] search failed: {resp.text[:300] if resp else 'no response'}")
            return None if not orders else orders
        data = resp.json().get("data") or {}
        batch = data.get("orders", [])
        orders.extend(batch)
        page_token = data.get("next_page_token")
        if not page_token or not batch:
            break
    return orders


def sync_tiktok_orders(conn: ChannelConnection, shop, db: Session, days: int = 7) -> int:
    """Mirrors eBay's sync_ebay_orders exactly — pulls orders in the given
    window ExiusCart doesn't already have, matches line items to real
    products by SKU (`seller_sku`, inferred field name)."""
    from app.models.channel_order_meta import ChannelOrderMeta
    from app.models.order import Order, OrderItem
    from app.models.product import Product
    from app.models.product_variant import ProductVariant
    import uuid as _uuid

    orders_data = fetch_tiktok_orders(conn, db, days)
    if not orders_data:
        return 0

    order_ids = {o.get("id") for o in orders_data if o.get("id")}
    already_known = {
        m.channel_order_id for m in db.query(ChannelOrderMeta).filter(
            ChannelOrderMeta.channel_type == "tiktok",
            ChannelOrderMeta.channel_order_id.in_(order_ids),
        ).all()
    }
    created = 0

    for tt_order in orders_data:
        tt_order_id = tt_order.get("id")
        if not tt_order_id or tt_order_id in already_known:
            continue

        subtotal = 0.0
        order_items_to_add = []
        items_detail = []
        for line_item in tt_order.get("line_items", []):
            sku = line_item.get("seller_sku")
            product = db.query(Product).filter(Product.shop_id == shop.id, Product.sku == sku).first() if sku else None
            if not product:
                variant = db.query(ProductVariant).filter(ProductVariant.sku == sku).first() if sku else None
                product = db.query(Product).filter(Product.id == variant.product_id).first() if variant else None
            if not product:
                logger.warning(f"[TIKTOK ORDERS] shop={shop.id} order_id={tt_order_id} — no product matches SKU {sku!r}, skipping item")
                continue

            qty = int(line_item.get("quantity") or 1)
            unit_price = float((line_item.get("sale_price") or {}).get("amount") or 0)
            item_total = unit_price * qty
            subtotal += item_total
            order_items_to_add.append(OrderItem(
                product_id=product.id, product_name=product.name,
                quantity=qty, unit_price=unit_price, total_price=item_total,
            ))
            items_detail.append({"sku": sku, "line_item_id": line_item.get("id"), "quantity": qty})

        if not order_items_to_add:
            logger.warning(f"[TIKTOK ORDERS] shop={shop.id} order_id={tt_order_id} — no items matched any product, order not created")
            continue

        order = Order(
            order_number=f"TT-{tt_order_id}-{str(_uuid.uuid4())[:4].upper()}",
            source="channel", subtotal=subtotal, total=subtotal,
            shop_id=shop.id, notes=f"TikTok Shop Order #{tt_order_id}",
        )
        db.add(order)
        db.flush()
        for oi in order_items_to_add:
            oi.order_id = order.id
            db.add(oi)
        db.add(ChannelOrderMeta(order_id=order.id, channel_type="tiktok", channel_order_id=tt_order_id, items_detail=items_detail))
        created += 1

    if created:
        conn.last_synced_at = datetime.now(timezone.utc)
        db.commit()
    return created


@router.post("/shops/{shop_id}/channels/tiktok/sync-orders")
def sync_tiktok_orders_now(
    shop_id: int,
    days: int = 7,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shop = _shop_or_404(shop_id, current_user, db)
    conn = _get_tiktok_connection(shop_id, db)
    created = sync_tiktok_orders(conn, shop, db, min(max(days, 1), 90))
    return {"orders_created": created}


class TiktokFulfillIn(BaseModel):
    tracking_number: str
    shipping_provider_id: str


@router.post("/shops/{shop_id}/channels/tiktok/orders/{order_id}/fulfill")
def fulfill_tiktok_order(
    shop_id: int,
    order_id: int,
    data: TiktokFulfillIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Pushes a tracking number back to TikTok Shop. UNVERIFIED — the
    endpoint path (fulfillment/202309/...) and body fields are inferred
    from TikTok's own naming conventions elsewhere, not confirmed."""
    from app.models.channel_order_meta import ChannelOrderMeta

    shop = _shop_or_404(shop_id, current_user, db)
    conn = _get_tiktok_connection(shop_id, db)

    meta = db.query(ChannelOrderMeta).filter(
        ChannelOrderMeta.order_id == order_id,
        ChannelOrderMeta.channel_type == "tiktok",
    ).first()
    if not meta or not meta.channel_order_id:
        raise HTTPException(status_code=404, detail="This order isn't linked to a TikTok Shop order")

    body = {
        "tracking_number": data.tracking_number,
        "shipping_provider_id": data.shipping_provider_id,
    }
    resp = _tiktok_api_request(
        "POST", f"/fulfillment/{TIKTOK_API_VERSION}/orders/{meta.channel_order_id}/packages",
        conn, db, json=body,
    )
    if resp is None or resp.status_code >= 300:
        detail = resp.text[:500] if resp is not None else "no response"
        raise HTTPException(status_code=502, detail=f"TikTok Shop rejected the fulfillment update: {detail}")
    return {"message": "Tracking sent to TikTok Shop"}
