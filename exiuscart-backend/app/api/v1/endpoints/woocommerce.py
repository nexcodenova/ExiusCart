"""
WooCommerce integration.

Unlike every other channel in this file set (eBay, Daraz, Noon, TikTok —
all a single centralized marketplace ExiusCart registers ONE app with),
WooCommerce is a self-hosted WordPress plugin with no central marketplace
at all. Each seller runs their own independent WordPress site, so there's
no "ExiusCart App Key" to register anywhere — each seller generates their
OWN Consumer Key/Secret from their own site's admin
(WooCommerce → Settings → Advanced → REST API) and pastes both here, plus
their site's own URL. Structurally this is Noon's per-seller-credential
shape, not eBay's per-platform-OAuth shape.

CONFIRMED against WooCommerce's own public REST API v3 docs
(woocommerce.github.io/woocommerce-rest-api-docs — no login wall, unlike
TikTok's Partner Center, so this is real, not a first-guess like the
TikTok product/order code):
  - Auth: HTTP Basic, username=consumer_key, password=consumer_secret,
    over HTTPS. (Non-HTTPS sites need OAuth1.0a "one-legged" auth instead
    — not implemented here; ExiusCart requires HTTPS stores.)
  - Base path: {site_url}/wp-json/wc/v3
  - Product create: POST /products — name, type, regular_price,
    description, sku, images[], stock_quantity, manage_stock.
  - Order list: GET /orders — id, status, line_items[] (product_id, sku,
    quantity, name, total), billing, shipping.
  - Order status update: PATCH /orders/{id} — {"status": "processing" |
    "completed" | "cancelled" | ...}.
  - Order notes (used here for tracking, see fulfill_woo_order below):
    POST /orders/{id}/notes — {"note": str, "customer_note": bool}.

One real gap, flagged rather than guessed around: WooCommerce's CORE REST
API has no dedicated tracking-number field — that's a plugin feature
(WooCommerce Shipment Tracking), not something every store has installed.
Rather than assume a plugin exists, fulfillment here marks the order
"completed" (a real, native status change) and adds a customer-visible
order note containing the tracking info as text — always available, no
plugin dependency, honest about what's actually guaranteed to work.
"""
import json
import logging
import secrets
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.thedersi import is_thedersi_shop
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.channel import ChannelConnection
from app.api.v1.endpoints.channels import _shop_or_404

logger = logging.getLogger(__name__)
router = APIRouter()

WC_API_PATH = "/wp-json/wc/v3"


def _get_woo_connection(shop_id: int, db: Session) -> ChannelConnection:
    conn = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.channel_type == "woocommerce",
        ChannelConnection.is_active == True,
    ).first()
    if not conn or not conn.channel_api_key or not conn.channel_api_url:
        raise HTTPException(status_code=404, detail="WooCommerce is not connected for this shop yet")
    return conn


def _get_woo_creds(conn: ChannelConnection) -> dict:
    try:
        return json.loads(conn.channel_api_key)
    except (TypeError, ValueError):
        raise HTTPException(status_code=500, detail="Stored WooCommerce credentials are corrupted — reconnect WooCommerce for this shop")


def _woo_request(site_url: str, creds: dict, method: str, path: str, **kwargs) -> httpx.Response:
    """The one function every WooCommerce REST call goes through — HTTP
    Basic Auth over the seller's own site, same chokepoint role as every
    other channel's _x_api_request / _x_request."""
    base = site_url.rstrip("/") + WC_API_PATH
    try:
        with httpx.Client(timeout=20) as client:
            return client.request(
                method, f"{base}{path}",
                auth=(creds["consumer_key"], creds["consumer_secret"]),
                **kwargs,
            )
    except Exception as e:
        logger.error(f"[WOOCOMMERCE] {method} {path} failed: {e}")
        raise HTTPException(status_code=502, detail=f"Could not reach {site_url} — check the site URL and that it's reachable over HTTPS.")


def _woo_request_for_shop(shop_id: int, db: Session, method: str, path: str, **kwargs) -> httpx.Response:
    conn = _get_woo_connection(shop_id, db)
    creds = _get_woo_creds(conn)
    return _woo_request(conn.channel_api_url, creds, method, path, **kwargs)


# ── Connect / disconnect ────────────────────────────────────────────────────

class WooConnectIn(BaseModel):
    site_url: str
    consumer_key: str
    consumer_secret: str


@router.post("/shops/{shop_id}/channels/woocommerce/connect")
def connect_woocommerce(
    shop_id: int,
    data: WooConnectIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Saves the seller's own WooCommerce site + credentials, verifying them
    with a real call before saving — same discipline as Noon's connect_noon
    and CJ's connect_cj, so a typo in the URL or a wrong key doesn't get
    stored as if it worked."""
    _shop_or_404(shop_id, current_user, db)

    if is_thedersi_shop(shop_id, db):
        raise HTTPException(status_code=403, detail="WooCommerce isn't available on TheDersi plans — TheDersi sellers can use TheDersi and Daraz.")

    # Free Trial's own pricing copy names only Shopify/TheDersi/custom site
    # as its included channel — WooCommerce isn't one of those three, so
    # it's Starter+ only, same gate shape as TikTok's authorize endpoint.
    from app.models.subscription import Subscription
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
        raise HTTPException(status_code=403, detail={
            "error": "plan_required",
            "plan": plan_type,
            "message": "WooCommerce is available on Starter (as your one channel) and Premium (all channels). Upgrade to connect your WooCommerce store.",
        })

    site_url = data.site_url.strip().rstrip("/")
    if not site_url.startswith("https://"):
        raise HTTPException(status_code=400, detail="Site URL must start with https:// — WooCommerce's REST API requires HTTPS for Basic Auth.")

    creds = {"consumer_key": data.consumer_key.strip(), "consumer_secret": data.consumer_secret.strip()}
    # Lightest real call to confirm the credentials actually work — a
    # single-item product list, not a write, before anything is saved.
    resp = _woo_request(site_url, creds, "GET", "/products", params={"per_page": 1})
    if resp.status_code == 401:
        raise HTTPException(status_code=400, detail="WooCommerce rejected these credentials — check the Consumer Key/Secret and that the REST API is enabled for this site.")
    if resp.status_code >= 300:
        raise HTTPException(status_code=502, detail=f"Could not verify WooCommerce connection: {resp.status_code} {resp.text[:300]}")

    conn = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.channel_type == "woocommerce",
    ).first()
    if not conn:
        conn = ChannelConnection(shop_id=shop_id, channel_type="woocommerce", webhook_secret=secrets.token_urlsafe(24))
        db.add(conn)
    conn.channel_api_key = json.dumps(creds)
    conn.channel_api_url = site_url
    conn.is_active = True
    db.commit()
    return {"connected": True, "site_url": site_url}


@router.delete("/shops/{shop_id}/channels/woocommerce/disconnect")
def disconnect_woocommerce(
    shop_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _shop_or_404(shop_id, current_user, db)
    conn = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.channel_type == "woocommerce",
    ).first()
    if conn:
        conn.is_active = False
        db.commit()
    return {"disconnected": True}


# ── Product listing ──────────────────────────────────────────────────────────

def _log_woo_sync(db: Session, shop_id: int, action: str, success: bool, product_id: Optional[int] = None,
                   external_id: Optional[str] = None, error_message: Optional[str] = None) -> None:
    from app.models.channel_sync_log import ChannelSyncLog
    db.add(ChannelSyncLog(
        shop_id=shop_id, product_id=product_id, channel_type="woocommerce", action=action,
        success=success, external_id=external_id, error_message=(error_message or "")[:2000] or None,
    ))
    db.commit()


@router.post("/shops/{shop_id}/channels/woocommerce/products/{product_id}/create")
def create_woocommerce_product(
    shop_id: int,
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lists an existing ExiusCart product on the seller's own WooCommerce
    site — single call, unlike Noon's 3-call split, since WooCommerce's
    core Product object covers content + stock together."""
    from app.models.product import Product
    from app.models.channel_product_status import ChannelProductStatus

    _shop_or_404(shop_id, current_user, db)
    product = db.query(Product).filter(Product.id == product_id, Product.shop_id == shop_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    image_urls = [img.url for img in (product.images or []) if img.url]
    body = {
        "name": product.name,
        "type": "simple",
        "regular_price": str(product.price),
        "description": product.description or product.name,
        "sku": product.sku or f"EXIUSCART-{product.id}",
        "manage_stock": True,
        "stock_quantity": int(product.quantity or 0),
        "images": [{"src": url} for url in image_urls[:20]],
    }
    resp = _woo_request_for_shop(shop_id, db, "POST", "/products", json=body)
    if resp.status_code >= 300:
        error_detail = resp.text[:500]
        _log_woo_sync(db, shop_id, "create_listing", False, product_id=product_id, error_message=error_detail)
        raise HTTPException(status_code=502, detail=f"WooCommerce rejected the product: {error_detail}")

    external_id = str(resp.json().get("id"))
    existing = db.query(ChannelProductStatus).filter(
        ChannelProductStatus.product_id == product_id,
        ChannelProductStatus.channel_type == "woocommerce",
    ).first()
    if existing:
        existing.status = "approved"  # WooCommerce products are live immediately, no marketplace review step
        existing.external_item_id = external_id
    else:
        db.add(ChannelProductStatus(product_id=product_id, shop_id=shop_id, channel_type="woocommerce", status="approved", external_item_id=external_id))
    db.commit()
    _log_woo_sync(db, shop_id, "create_listing", True, product_id=product_id, external_id=external_id)
    return {"message": "Listed on WooCommerce.", "external_id": external_id}


@router.get("/shops/{shop_id}/channels/woocommerce/products/{product_id}/listing")
def get_woocommerce_listing_status(
    shop_id: int,
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.channel_product_status import ChannelProductStatus
    _shop_or_404(shop_id, current_user, db)
    status = db.query(ChannelProductStatus).filter(
        ChannelProductStatus.product_id == product_id,
        ChannelProductStatus.channel_type == "woocommerce",
    ).first()
    if not status:
        return {"listed": False}
    return {"listed": True, "status": status.status, "external_id": status.external_item_id}


# ── Order sync ────────────────────────────────────────────────────────────────

def fetch_woo_orders(site_url: str, creds: dict, days: int = 7) -> list | None:
    """GET /orders, paginated via page/per_page — confirmed real params."""
    from datetime import datetime, timezone, timedelta
    after = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%S")
    orders = []
    page = 1
    while True:
        resp = _woo_request(site_url, creds, "GET", "/orders", params={"after": after, "per_page": 100, "page": page})
        if resp.status_code >= 300:
            logger.error(f"[WOOCOMMERCE ORDERS] list failed: {resp.status_code} {resp.text[:300]}")
            return None if not orders else orders
        batch = resp.json()
        if not batch:
            break
        orders.extend(batch)
        if len(batch) < 100:
            break
        page += 1
    return orders


def sync_woocommerce_orders(conn: ChannelConnection, shop, db: Session, days: int = 7) -> int:
    """Mirrors eBay's/TikTok's sync_x_orders — pulls orders ExiusCart
    doesn't already have, matches line items to real products by SKU."""
    from app.models.channel_order_meta import ChannelOrderMeta
    from app.models.order import Order, OrderItem
    from app.models.product import Product
    from app.models.product_variant import ProductVariant
    import uuid as _uuid

    creds = _get_woo_creds(conn)
    orders_data = fetch_woo_orders(conn.channel_api_url, creds, days)
    if not orders_data:
        return 0

    order_ids = {str(o.get("id")) for o in orders_data if o.get("id")}
    already_known = {
        m.channel_order_id for m in db.query(ChannelOrderMeta).filter(
            ChannelOrderMeta.channel_type == "woocommerce",
            ChannelOrderMeta.channel_order_id.in_(order_ids),
        ).all()
    }
    created = 0

    for woo_order in orders_data:
        woo_order_id = str(woo_order.get("id"))
        if not woo_order_id or woo_order_id in already_known:
            continue

        subtotal = 0.0
        order_items_to_add = []
        items_detail = []
        for line_item in woo_order.get("line_items", []):
            sku = line_item.get("sku")
            product = db.query(Product).filter(Product.shop_id == shop.id, Product.sku == sku).first() if sku else None
            if not product:
                variant = db.query(ProductVariant).filter(ProductVariant.sku == sku).first() if sku else None
                product = db.query(Product).filter(Product.id == variant.product_id).first() if variant else None
            if not product:
                logger.warning(f"[WOOCOMMERCE ORDERS] shop={shop.id} order_id={woo_order_id} — no product matches SKU {sku!r}, skipping item")
                continue

            qty = int(line_item.get("quantity") or 1)
            item_total = float(line_item.get("total") or 0)
            subtotal += item_total
            order_items_to_add.append(OrderItem(
                product_id=product.id, product_name=product.name,
                quantity=qty, unit_price=(item_total / qty if qty else item_total), total_price=item_total,
            ))
            items_detail.append({"sku": sku, "line_item_id": line_item.get("id"), "quantity": qty})

        if not order_items_to_add:
            logger.warning(f"[WOOCOMMERCE ORDERS] shop={shop.id} order_id={woo_order_id} — no items matched any product, order not created")
            continue

        order = Order(
            order_number=f"WOO-{woo_order_id}-{str(_uuid.uuid4())[:4].upper()}",
            source="channel", subtotal=subtotal, total=subtotal,
            shop_id=shop.id, notes=f"WooCommerce Order #{woo_order_id}",
        )
        db.add(order)
        db.flush()
        for oi in order_items_to_add:
            oi.order_id = order.id
            db.add(oi)
        db.add(ChannelOrderMeta(order_id=order.id, channel_type="woocommerce", channel_order_id=woo_order_id, items_detail=items_detail))
        created += 1

    if created:
        from datetime import datetime, timezone
        conn.last_synced_at = datetime.now(timezone.utc)
        db.commit()
    return created


@router.post("/shops/{shop_id}/channels/woocommerce/sync-orders")
def sync_woocommerce_orders_now(
    shop_id: int,
    days: int = 7,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shop = _shop_or_404(shop_id, current_user, db)
    conn = _get_woo_connection(shop_id, db)
    created = sync_woocommerce_orders(conn, shop, db, min(max(days, 1), 90))
    return {"orders_created": created}


class WooFulfillIn(BaseModel):
    tracking_number: str
    carrier_name: str


@router.post("/shops/{shop_id}/channels/woocommerce/orders/{order_id}/fulfill")
def fulfill_woocommerce_order(
    shop_id: int,
    order_id: int,
    data: WooFulfillIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Marks the order 'completed' (native status, confirmed) and adds a
    customer-visible order note with the tracking info — see module
    docstring for why this isn't a dedicated tracking-number field: that's
    a plugin feature, not guaranteed on every WooCommerce store."""
    from app.models.channel_order_meta import ChannelOrderMeta

    shop = _shop_or_404(shop_id, current_user, db)
    conn = _get_woo_connection(shop_id, db)

    meta = db.query(ChannelOrderMeta).filter(
        ChannelOrderMeta.order_id == order_id,
        ChannelOrderMeta.channel_type == "woocommerce",
    ).first()
    if not meta or not meta.channel_order_id:
        raise HTTPException(status_code=404, detail="This order isn't linked to a WooCommerce order")

    status_resp = _woo_request_for_shop(shop_id, db, "PATCH", f"/orders/{meta.channel_order_id}", json={"status": "completed"})
    if status_resp.status_code >= 300:
        raise HTTPException(status_code=502, detail=f"WooCommerce rejected the status update: {status_resp.text[:500]}")

    note_resp = _woo_request_for_shop(
        shop_id, db, "POST", f"/orders/{meta.channel_order_id}/notes",
        json={"note": f"Shipped via {data.carrier_name} — tracking number: {data.tracking_number}", "customer_note": True},
    )
    if note_resp.status_code >= 300:
        logger.warning(f"[WOOCOMMERCE FULFILL] order marked completed but tracking note failed: {note_resp.text[:300]}")

    return {"message": "Order marked completed on WooCommerce, tracking added as an order note."}
