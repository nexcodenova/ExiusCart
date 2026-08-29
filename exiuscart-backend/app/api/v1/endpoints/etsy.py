"""
Etsy Open API v3 — OAuth2 + PKCE connect flow.

Sales channel (list products, sell, sync orders back), same shape as
eBay/TikTok — not a dropship supplier. ExiusCart registers ONE app in
Etsy's Developer Portal (developer.etsy.com → "Create a Personal App" —
NOT "Seller App", which is scoped to a single shop's own use, not a
multi-seller platform like ExiusCart) and gets a Keystring + Shared
Secret; each seller then authorizes that app against their own,
already-existing Etsy shop.

CONFIRMED against Etsy's own public documentation
(developers.etsy.com/documentation — no login wall, unlike TikTok's
Partner Center, so everything below is real, not a first-guess:

  - Authorize: GET https://www.etsy.com/oauth/connect — response_type=code,
    client_id, redirect_uri, scope, state, code_challenge,
    code_challenge_method=S256. Etsy requires PKCE (unlike eBay/TikTok),
    so a code_verifier is generated per attempt and its SHA256 hash sent
    as code_challenge — see _generate_pkce_pair.
  - Token exchange/refresh: POST https://api.etsy.com/v3/public/oauth/token
    — grant_type=authorization_code (real OAuth-spec spelling, unlike
    TikTok's non-standard "authorized_code") or grant_type=refresh_token;
    client_id, code, code_verifier (only on the first exchange),
    refresh_token (only on refresh).
  - API base: https://api.etsy.com/v3/application — every call also needs
    header x-api-key: {keystring}:{shared_secret}, in addition to the
    Bearer access token.
  - Create listing: POST /shops/{shop_id}/listings — quantity, title,
    description, price (pennies), who_made, when_made, taxonomy_id,
    image_ids, shipping_profile_id, readiness_state_id.
  - List orders: GET /shops/{shop_id}/receipts.
  - Fulfillment: POST /shops/{shop_id}/receipts/{receipt_id}/tracking —
    tracking_code, carrier_name.

Every substantive Etsy API call goes through _etsy_api_request, the Etsy
equivalent of eBay's _ebay_api_request / TikTok's _tiktok_api_request.
"""
import os
import time
import base64
import hashlib
import secrets
import logging
from datetime import datetime, timezone, timedelta
from urllib.parse import urlencode

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
from app.api.v1.endpoints.channels import _shop_or_404, EXIUSCART_BASE

logger = logging.getLogger(__name__)

router = APIRouter()

ETSY_KEYSTRING = os.getenv("ETSY_KEYSTRING", "")
ETSY_SHARED_SECRET = os.getenv("ETSY_SHARED_SECRET", "")

ETSY_AUTHORIZE_URL = "https://www.etsy.com/oauth/connect"
ETSY_TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token"
ETSY_API_BASE = "https://api.etsy.com/v3/application"

STOREFRONT_BASE = "https://store.exiuscart.com"

ETSY_SCOPES = " ".join([
    "listings_r", "listings_w", "transactions_r", "transactions_w", "shops_r",
])


def _generate_pkce_pair() -> tuple[str, str]:
    """code_verifier: 43-128 char URL-safe random string (Etsy's stated
    range). code_challenge: base64url(sha256(code_verifier)), no padding —
    standard PKCE S256, per Etsy's own documented example."""
    verifier = secrets.token_urlsafe(64)[:128]
    digest = hashlib.sha256(verifier.encode("utf-8")).digest()
    challenge = base64.urlsafe_b64encode(digest).decode("utf-8").rstrip("=")
    return verifier, challenge


def _etsy_token_request(grant_type: str, **params) -> dict | None:
    """POST https://api.etsy.com/v3/public/oauth/token — used for both the
    initial code exchange and every later refresh. No client secret in
    the body (PKCE replaces it for the auth-code exchange) — confirmed
    against Etsy's own documented example request."""
    if not ETSY_KEYSTRING:
        logger.error("[ETSY OAUTH] ETSY_KEYSTRING not configured")
        return None
    data = {"grant_type": grant_type, "client_id": ETSY_KEYSTRING, **params}
    try:
        resp = httpx.post(ETSY_TOKEN_URL, data=data, headers={"Content-Type": "application/x-www-form-urlencoded"}, timeout=15)
        result = resp.json()
        if resp.status_code >= 300 or "access_token" not in result:
            logger.error(f"[ETSY OAUTH] token request ({grant_type}) failed — status={resp.status_code} body={result}")
            return None
        return result
    except Exception as e:
        logger.error(f"[ETSY OAUTH] token request ({grant_type}) failed: {e}")
        return None


def _exchange_code_for_token(code: str, code_verifier: str, redirect_uri: str) -> dict | None:
    data = _etsy_token_request("authorization_code", code=code, redirect_uri=redirect_uri, code_verifier=code_verifier)
    if not data:
        return None
    # Etsy's access_token is prefixed "{numeric_user_id}.{token}" — the
    # shop's own Etsy user ID, confirmed in Etsy's own docs, useful later
    # without a separate lookup call.
    return {
        "access_token": data["access_token"],
        "refresh_token": data.get("refresh_token"),
        "expires_at": datetime.now(timezone.utc) + timedelta(seconds=data.get("expires_in", 3600)),
    }


def _etsy_ensure_token(conn: ChannelConnection, db: Session) -> str:
    """Mirrors eBay's _ebay_ensure_token / TikTok's _tiktok_ensure_token —
    Etsy's access token lasts 3600s (confirmed), proactively refreshed."""
    now = datetime.now(timezone.utc)
    buffer = timedelta(minutes=5)
    if conn.access_token and conn.token_expires_at and conn.token_expires_at > now + buffer:
        return conn.access_token

    if not conn.refresh_token:
        raise HTTPException(status_code=400, detail={
            "error": "etsy_reconnect_required",
            "message": "Etsy session expired. Please reconnect your Etsy shop.",
        })

    data = _etsy_token_request("refresh_token", refresh_token=conn.refresh_token)
    if not data:
        raise HTTPException(status_code=400, detail={
            "error": "etsy_reconnect_required",
            "message": "Could not refresh Etsy session. Please reconnect your Etsy shop.",
        })

    conn.access_token = data["access_token"]
    conn.refresh_token = data.get("refresh_token", conn.refresh_token)
    conn.token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=data.get("expires_in", 3600))
    db.commit()
    return conn.access_token


def _etsy_api_request(method: str, path: str, conn: ChannelConnection, db: Session, **kwargs) -> httpx.Response | None:
    """The one function every Etsy API call goes through — ensures a fresh
    token, sets both the Bearer token and the required x-api-key header."""
    token = _etsy_ensure_token(conn, db)
    headers = {
        "Authorization": f"Bearer {token}",
        "x-api-key": f"{ETSY_KEYSTRING}:{ETSY_SHARED_SECRET}",
        **kwargs.pop("headers", {}),
    }
    url = f"{ETSY_API_BASE}{path}"
    try:
        with httpx.Client(timeout=20) as client:
            return client.request(method, url, headers=headers, **kwargs)
    except Exception as e:
        logger.error(f"[ETSY API] {method} {path} failed: {e}")
        return None


def _etsy_callback_url() -> str:
    return f"{EXIUSCART_BASE.rstrip('/')}/channels/etsy/callback"


def _get_etsy_connection(shop_id: int, db: Session) -> ChannelConnection:
    conn = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.channel_type == "etsy",
        ChannelConnection.is_active == True,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Etsy is not connected for this shop yet")
    return conn


# ── OAuth connect ────────────────────────────────────────────────────────────

@router.get("/shops/{shop_id}/channels/etsy/authorize")
def etsy_authorize(
    shop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Start the Etsy OAuth flow — returns the URL to redirect the seller's
    browser to. The seller must already have their own Etsy shop; this
    only authorizes ExiusCart's app to access it.

    Gated the same shape as TikTok/WooCommerce — Starter picks it as
    their one channel, Premium gets it unlimited."""
    shop = _shop_or_404(shop_id, current_user, db)

    if not ETSY_KEYSTRING:
        raise HTTPException(
            status_code=503,
            detail="Etsy integration isn't configured yet — ExiusCart's app registration with Etsy is still pending.",
        )

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
        ChannelConnection.channel_type == "etsy",
        ChannelConnection.is_active == True,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already connected to Etsy")

    sub = db.query(Subscription).filter(Subscription.shop_id == shop_id).order_by(Subscription.id.desc()).first()
    plan_type = sub.plan_type if sub else "free_trial"
    if plan_type == "starter":
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
                "message": "Etsy is available on Starter (as your one channel) and Premium (all channels). Upgrade to connect your Etsy shop.",
            },
        )

    state = secrets.token_urlsafe(32)
    code_verifier, code_challenge = _generate_pkce_pair()

    pending = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.channel_type == "etsy",
        ChannelConnection.is_active == False,
    ).first()
    if pending:
        pending.oauth_state = state
        # code_verifier stashed in channel_api_key while pending — unused
        # for anything else until the connection is real, overwritten
        # with actual credentials (there aren't any for Etsy beyond the
        # shared ExiusCart-wide keystring) once connected.
        pending.channel_api_key = code_verifier
    else:
        pending = ChannelConnection(
            shop_id=shop_id,
            channel_type="etsy",
            is_active=False,
            oauth_state=state,
            channel_api_key=code_verifier,
            webhook_secret=secrets.token_urlsafe(32),
        )
        db.add(pending)
    db.commit()

    params = {
        "response_type": "code",
        "client_id": ETSY_KEYSTRING,
        "redirect_uri": _etsy_callback_url(),
        "scope": ETSY_SCOPES,
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
    }
    return {"authorize_url": f"{ETSY_AUTHORIZE_URL}?{urlencode(params)}"}


@router.get("/channels/etsy/callback")
def etsy_callback(
    code: str = None,
    state: str = None,
    error: str = None,
    db: Session = Depends(get_db),
):
    """Etsy redirects the seller's browser here after they approve (or
    deny) access. Public endpoint — verified via the CSRF `state` token,
    not auth. Mirrors eBay's/TikTok's callback."""
    if error or not code or not state:
        logger.warning(f"[ETSY OAUTH] callback failed — error={error} code_present={bool(code)} state_present={bool(state)}")
        return RedirectResponse(f"{STOREFRONT_BASE}/dashboard/etsy-integration?etsy=denied")

    conn = db.query(ChannelConnection).filter(
        ChannelConnection.channel_type == "etsy",
        ChannelConnection.oauth_state == state,
        ChannelConnection.is_active == False,
    ).first()
    if not conn:
        logger.error(f"[ETSY OAUTH] callback with unknown/expired state={state[:8]}...")
        return RedirectResponse(f"{STOREFRONT_BASE}/dashboard/etsy-integration?etsy=invalid_state")

    code_verifier = conn.channel_api_key
    token_result = _exchange_code_for_token(code, code_verifier, _etsy_callback_url())
    if token_result is None:
        conn.seller_status = "pending_token_exchange"
        db.commit()
        logger.warning(f"[ETSY OAUTH] shop={conn.shop_id} token exchange failed — connection left pending, see error above")
        return RedirectResponse(f"{STOREFRONT_BASE}/dashboard/etsy-integration?etsy=pending")

    conn.access_token = token_result["access_token"]
    conn.refresh_token = token_result.get("refresh_token")
    conn.token_expires_at = token_result.get("expires_at")
    conn.channel_api_key = None  # done with the PKCE verifier, nothing else to store here for Etsy
    # Etsy's access_token is prefixed "{user_id}.{token}" — extract as the
    # seller-facing identifier, confirmed in Etsy's own docs.
    conn.channel_seller_id = token_result["access_token"].split(".")[0]
    conn.is_active = True
    conn.oauth_state = None
    conn.seller_status = "approved"
    db.commit()
    return RedirectResponse(f"{STOREFRONT_BASE}/dashboard/etsy-integration?etsy=connected")


@router.get("/shops/{shop_id}/channels/etsy/status")
def etsy_status(
    shop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    conn = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.channel_type == "etsy",
        ChannelConnection.is_active == True,
    ).first()
    return {
        "connected": conn is not None,
        "seller_id": conn.channel_seller_id if conn else None,
        "last_synced_at": conn.last_synced_at.isoformat() if conn and conn.last_synced_at else None,
    }


# ── Product listing ──────────────────────────────────────────────────────────
# Unlike TikTok's product/order code, everything below is built against
# Etsy's own confirmed, publicly-documented field names — same confidence
# tier as eBay, not a first-guess.

def _log_etsy_sync(shop_id: int, product_id: int | None, action: str, success: bool, external_id: str | None, error_message: str | None, db: Session):
    from app.models.channel_sync_log import ChannelSyncLog
    db.add(ChannelSyncLog(
        shop_id=shop_id, product_id=product_id, channel_type="etsy",
        action=action, success=success, external_id=external_id, error_message=error_message,
    ))
    db.commit()


class EtsyCreateListingIn(BaseModel):
    taxonomy_id: int
    who_made: str  # "i_did" | "someone_else" | "collective"
    when_made: str  # e.g. "made_to_order", "2020_2026" — Etsy's own enum
    shipping_profile_id: int


@router.post("/shops/{shop_id}/channels/etsy/products/{product_id}/create")
def create_etsy_listing(
    shop_id: int,
    product_id: int,
    data: EtsyCreateListingIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lists a product on Etsy — mirrors eBay's create_ebay_listing shape.
    Price is confirmed to be in whole pennies (not a decimal string like
    eBay/TikTok/WooCommerce), converted here so the seller never has to
    think about it."""
    from app.models.product import Product
    from app.models.product_fields import ProductImage
    from app.models.channel_product_status import ChannelProductStatus

    shop = _shop_or_404(shop_id, current_user, db)
    conn = _get_etsy_connection(shop_id, db)
    product = db.query(Product).filter(Product.id == product_id, Product.shop_id == shop_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    images = db.query(ProductImage).filter(ProductImage.product_id == product_id).order_by(ProductImage.sort_order).all()
    if not images:
        raise HTTPException(status_code=400, detail="This product has no images — Etsy requires at least one before a listing can go active.")

    body = {
        "quantity": int(product.quantity or 0),
        "title": product.name[:140],  # Etsy's own title length cap
        "description": product.description or product.name,
        "price": round(float(product.price) * 100),  # confirmed: pennies, not a decimal string
        "who_made": data.who_made,
        "when_made": data.when_made,
        "taxonomy_id": data.taxonomy_id,
        "shipping_profile_id": data.shipping_profile_id,
    }
    resp = _etsy_api_request("POST", f"/shops/{conn.channel_seller_id}/listings", conn, db, data=body)
    if resp is None or resp.status_code >= 300:
        error_detail = resp.text[:500] if resp is not None else "no response"
        _log_etsy_sync(shop_id, product_id, "create_listing", False, None, error_detail, db)
        raise HTTPException(status_code=502, detail=f"Etsy rejected the listing: {error_detail}")

    listing = resp.json()
    listing_id = listing.get("listing_id")

    # Images are a separate call in Etsy's API (POST .../listings/{id}/images) —
    # confirmed as a distinct step, not part of the create body.
    for i, img in enumerate(images[:10]):
        img_resp = httpx.get(img.url, timeout=15) if img.url.startswith("http") else None
        if img_resp is None or img_resp.status_code >= 300:
            continue
        _etsy_api_request(
            "POST", f"/shops/{conn.channel_seller_id}/listings/{listing_id}/images",
            conn, db, files={"image": (f"image_{i}.jpg", img_resp.content)}, data={"rank": i + 1},
        )

    existing = db.query(ChannelProductStatus).filter(
        ChannelProductStatus.product_id == product_id,
        ChannelProductStatus.channel_type == "etsy",
    ).first()
    if existing:
        existing.status = "approved"
        existing.external_item_id = str(listing_id)
    else:
        db.add(ChannelProductStatus(product_id=product_id, shop_id=shop_id, channel_type="etsy", status="approved", external_item_id=str(listing_id)))
    db.commit()
    _log_etsy_sync(shop_id, product_id, "create_listing", True, str(listing_id), None, db)
    return {"message": "Listed on Etsy.", "external_id": str(listing_id)}


@router.get("/shops/{shop_id}/channels/etsy/products/{product_id}/listing")
def get_etsy_listing_status(
    shop_id: int,
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.channel_product_status import ChannelProductStatus
    _shop_or_404(shop_id, current_user, db)
    status = db.query(ChannelProductStatus).filter(
        ChannelProductStatus.product_id == product_id,
        ChannelProductStatus.channel_type == "etsy",
    ).first()
    if not status:
        return {"listed": False}
    return {"listed": True, "status": status.status, "external_id": status.external_item_id}


# ── Order sync (Etsy calls orders "receipts") ───────────────────────────────

def fetch_etsy_receipts(conn: ChannelConnection, db: Session, days: int = 7) -> list | None:
    """GET /shops/{shop_id}/receipts — confirmed endpoint, paginated via
    limit/offset (Etsy's standard v3 pagination shape)."""
    from datetime import datetime, timezone, timedelta
    min_created = int((datetime.now(timezone.utc) - timedelta(days=days)).timestamp())
    receipts = []
    offset = 0
    limit = 100
    while True:
        resp = _etsy_api_request(
            "GET", f"/shops/{conn.channel_seller_id}/receipts", conn, db,
            params={"min_created": min_created, "limit": limit, "offset": offset},
        )
        if resp is None or resp.status_code >= 300:
            logger.error(f"[ETSY ORDERS] receipts fetch failed: {resp.text[:300] if resp else 'no response'}")
            return None if not receipts else receipts
        data = resp.json()
        batch = data.get("results", [])
        receipts.extend(batch)
        if len(batch) < limit:
            break
        offset += limit
    return receipts


def sync_etsy_orders(conn: ChannelConnection, shop, db: Session, days: int = 7) -> int:
    """Mirrors eBay's/TikTok's sync_x_orders — a receipt's transactions
    array is Etsy's equivalent of line items, matched to real products by
    SKU (confirmed field name)."""
    from app.models.channel_order_meta import ChannelOrderMeta
    from app.models.order import Order, OrderItem
    from app.models.product import Product
    from app.models.product_variant import ProductVariant
    import uuid as _uuid

    receipts_data = fetch_etsy_receipts(conn, db, days)
    if not receipts_data:
        return 0

    receipt_ids = {str(r.get("receipt_id")) for r in receipts_data if r.get("receipt_id")}
    already_known = {
        m.channel_order_id for m in db.query(ChannelOrderMeta).filter(
            ChannelOrderMeta.channel_type == "etsy",
            ChannelOrderMeta.channel_order_id.in_(receipt_ids),
        ).all()
    }
    created = 0

    for receipt in receipts_data:
        receipt_id = str(receipt.get("receipt_id"))
        if not receipt_id or receipt_id in already_known:
            continue

        subtotal = 0.0
        order_items_to_add = []
        items_detail = []
        for txn in receipt.get("transactions", []):
            sku = txn.get("sku")
            product = db.query(Product).filter(Product.shop_id == shop.id, Product.sku == sku).first() if sku else None
            if not product:
                variant = db.query(ProductVariant).filter(ProductVariant.sku == sku).first() if sku else None
                product = db.query(Product).filter(Product.id == variant.product_id).first() if variant else None
            if not product:
                logger.warning(f"[ETSY ORDERS] shop={shop.id} receipt_id={receipt_id} — no product matches SKU {sku!r}, skipping item")
                continue

            qty = int(txn.get("quantity") or 1)
            price_info = txn.get("price") or {}
            unit_price = float(price_info.get("amount", 0)) / float(price_info.get("divisor", 100) or 100)
            item_total = unit_price * qty
            subtotal += item_total
            order_items_to_add.append(OrderItem(
                product_id=product.id, product_name=product.name,
                quantity=qty, unit_price=unit_price, total_price=item_total,
            ))
            items_detail.append({"sku": sku, "transaction_id": txn.get("transaction_id"), "quantity": qty})

        if not order_items_to_add:
            logger.warning(f"[ETSY ORDERS] shop={shop.id} receipt_id={receipt_id} — no items matched any product, order not created")
            continue

        order = Order(
            order_number=f"ETSY-{receipt_id}-{str(_uuid.uuid4())[:4].upper()}",
            source="channel", subtotal=subtotal, total=subtotal,
            shop_id=shop.id, notes=f"Etsy Receipt #{receipt_id}",
        )
        db.add(order)
        db.flush()
        for oi in order_items_to_add:
            oi.order_id = order.id
            db.add(oi)
        db.add(ChannelOrderMeta(order_id=order.id, channel_type="etsy", channel_order_id=receipt_id, items_detail=items_detail))
        created += 1

    if created:
        conn.last_synced_at = datetime.now(timezone.utc)
        db.commit()
    return created


@router.post("/shops/{shop_id}/channels/etsy/sync-orders")
def sync_etsy_orders_now(
    shop_id: int,
    days: int = 7,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shop = _shop_or_404(shop_id, current_user, db)
    conn = _get_etsy_connection(shop_id, db)
    created = sync_etsy_orders(conn, shop, db, min(max(days, 1), 90))
    return {"orders_created": created}


class EtsyFulfillIn(BaseModel):
    tracking_number: str
    carrier_name: str


@router.post("/shops/{shop_id}/channels/etsy/orders/{order_id}/fulfill")
def fulfill_etsy_order(
    shop_id: int,
    order_id: int,
    data: EtsyFulfillIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """POST /shops/{shop_id}/receipts/{receipt_id}/tracking — confirmed
    endpoint and field names (tracking_code, carrier_name)."""
    from app.models.channel_order_meta import ChannelOrderMeta

    shop = _shop_or_404(shop_id, current_user, db)
    conn = _get_etsy_connection(shop_id, db)

    meta = db.query(ChannelOrderMeta).filter(
        ChannelOrderMeta.order_id == order_id,
        ChannelOrderMeta.channel_type == "etsy",
    ).first()
    if not meta or not meta.channel_order_id:
        raise HTTPException(status_code=404, detail="This order isn't linked to an Etsy receipt")

    resp = _etsy_api_request(
        "POST", f"/shops/{conn.channel_seller_id}/receipts/{meta.channel_order_id}/tracking",
        conn, db, data={"tracking_code": data.tracking_number, "carrier_name": data.carrier_name},
    )
    if resp is None or resp.status_code >= 300:
        detail = resp.text[:500] if resp is not None else "no response"
        raise HTTPException(status_code=502, detail=f"Etsy rejected the fulfillment update: {detail}")
    return {"message": "Tracking sent to Etsy"}
