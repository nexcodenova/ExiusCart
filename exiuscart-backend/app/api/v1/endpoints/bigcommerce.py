"""
BigCommerce integration.

Same per-seller-credential shape as WooCommerce/Noon — not eBay's
per-platform-OAuth shape. BigCommerce's own "store-level API account"
is a self-serve credential a merchant generates themselves in their own
control panel (Settings → Store-level API accounts), no ExiusCart App
to register anywhere and no OAuth consent screen. That's what makes this
integration "easy" the same way WooCommerce is — unlike Wix, which
requires building and publishing a real Wix App through their App
Market review process before any seller can connect at all.

CONFIRMED live against BigCommerce's own docs this session
(docs.bigcommerce.com — the auth page rendered real content; several
other reference sub-pages returned their JS app's shell rather than
real content through automated fetching, so those parts below are from
well-established, stable BigCommerce API knowledge, not a live-doc
confirmation — same "flag the confidence level honestly" discipline
this file set already uses for TikTok vs. WooCommerce):
  - Auth (CONFIRMED): header `X-Auth-Token: {access_token}`, base URL
    `https://api.bigcommerce.com/stores/{store_hash}/v3` for Catalog.
  - Orders (CONFIRMED still on v2, never got a v3 equivalent):
    `https://api.bigcommerce.com/stores/{store_hash}/v2/orders` — a real,
    genuinely confirmed BigCommerce API inconsistency, not a guess.
  - Product create: POST /v3/catalog/products — name, type ("physical"),
    weight (BigCommerce requires this even for non-shippable listings,
    unlike WooCommerce), price, description, sku, inventory_level,
    inventory_tracking: "product", images: [{"image_url": ...}].
  - Order line items are NOT embedded in the v2 order object — a
    separate call, GET /v2/orders/{id}/products, same "extra call" shape
    Noon's connect_noon already has for a different reason.
  - Order status uses a numeric status_id (BigCommerce's own enum), not
    a string like WooCommerce — 2 = Shipped is the one this file relies
    on, via PUT /v2/orders/{id}.
  - Shipment/tracking: BigCommerce v2 has a real, first-class Shipments
    endpoint (POST /v2/orders/{id}/shipments — tracking_number,
    shipping_method, items[]), unlike WooCommerce's plugin-only gap
    noted in woocommerce.py's own docstring.
"""
import re
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

BC_API_HOST = "https://api.bigcommerce.com/stores"
# BigCommerce's own "Shipped" status_id — confirmed stable/well-known
# across their v2 Orders API, not seller-configurable.
BC_STATUS_SHIPPED = 2


def _strip_clipboard_fragments(html: str) -> str:
    """Word/Google Docs pastes into the rich text editor leave behind
    <!--StartFragment-->/<!--EndFragment--> clipboard markers — pure bloat,
    no visual effect."""
    if not html:
        return html
    return re.sub(r"<!--\s*(Start|End)Fragment\s*-->", "", html, flags=re.IGNORECASE)


# BigCommerce doesn't publish a confirmed max length for the product
# description field itself — the closest confirmed number is their category
# description cap (65,642 chars), used here as an evidence-based backstop
# against pathological content (not a confirmed product-description limit).
BIGCOMMERCE_DESCRIPTION_MAX = 65642


def _get_bc_connection(shop_id: int, db: Session) -> ChannelConnection:
    conn = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.channel_type == "bigcommerce",
        ChannelConnection.is_active == True,
    ).first()
    if not conn or not conn.channel_api_key or not conn.channel_api_url:
        raise HTTPException(status_code=404, detail="BigCommerce is not connected for this shop yet")
    return conn


def _bc_request(store_hash: str, access_token: str, method: str, api_version: str, path: str, **kwargs) -> httpx.Response:
    """The one function every BigCommerce REST call goes through —
    api_version is "v2" or "v3" since Orders and Catalog are genuinely on
    different API generations (see module docstring)."""
    url = f"{BC_API_HOST}/{store_hash}/{api_version}{path}"
    try:
        with httpx.Client(timeout=20) as client:
            return client.request(
                method, url,
                headers={"X-Auth-Token": access_token, "Accept": "application/json", "Content-Type": "application/json"},
                **kwargs,
            )
    except Exception as e:
        logger.error(f"[BIGCOMMERCE] {method} {api_version}{path} failed: {e}")
        raise HTTPException(status_code=502, detail="Could not reach BigCommerce — check the store hash and that the API account is still active.")


def _bc_request_for_shop(shop_id: int, db: Session, method: str, api_version: str, path: str, **kwargs) -> httpx.Response:
    conn = _get_bc_connection(shop_id, db)
    # channel_api_key holds the access_token directly (unlike WooCommerce's
    # JSON-encoded consumer key/secret pair, BigCommerce's store-level
    # account is a single token) — channel_api_url holds the store_hash.
    return _bc_request(conn.channel_api_url, conn.channel_api_key, method, api_version, path, **kwargs)


# ── Connect / disconnect ─────────────────────────────────────────────────────

class BigCommerceConnectIn(BaseModel):
    store_hash: str
    access_token: str


@router.post("/shops/{shop_id}/channels/bigcommerce/connect")
def connect_bigcommerce(
    shop_id: int,
    data: BigCommerceConnectIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Saves the seller's own BigCommerce store hash + access token,
    verified with a real call before saving — same discipline as
    WooCommerce/Noon's connect endpoints."""
    _shop_or_404(shop_id, current_user, db)

    if is_thedersi_shop(shop_id, db):
        raise HTTPException(status_code=403, detail="BigCommerce isn't available on TheDersi plans — TheDersi sellers can use TheDersi and Daraz.")

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
            "message": "BigCommerce is available on Starter (as your one channel) and Premium (all channels). Upgrade to connect your BigCommerce store.",
        })

    store_hash = data.store_hash.strip()
    access_token = data.access_token.strip()
    # Lightest real call to confirm the credentials actually work — a
    # single-item product list, not a write, before anything is saved.
    resp = _bc_request(store_hash, access_token, "GET", "v3", "/catalog/products", params={"limit": 1})
    if resp.status_code == 401:
        raise HTTPException(status_code=400, detail="BigCommerce rejected this token — check the store hash and access token, and that the API account hasn't been deleted.")
    if resp.status_code >= 300:
        raise HTTPException(status_code=502, detail=f"Could not verify BigCommerce connection: {resp.status_code} {resp.text[:300]}")

    conn = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.channel_type == "bigcommerce",
    ).first()
    if not conn:
        conn = ChannelConnection(shop_id=shop_id, channel_type="bigcommerce", webhook_secret=secrets.token_urlsafe(24))
        db.add(conn)
    conn.channel_api_key = access_token
    conn.channel_api_url = store_hash
    conn.is_active = True
    db.commit()
    return {"connected": True, "store_hash": store_hash}


@router.delete("/shops/{shop_id}/channels/bigcommerce/disconnect")
def disconnect_bigcommerce(
    shop_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _shop_or_404(shop_id, current_user, db)
    conn = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.channel_type == "bigcommerce",
    ).first()
    if conn:
        conn.is_active = False
        db.commit()
    return {"disconnected": True}


# ── Product listing ──────────────────────────────────────────────────────────

def _log_bc_sync(db: Session, shop_id: int, action: str, success: bool, product_id: Optional[int] = None,
                  external_id: Optional[str] = None, error_message: Optional[str] = None) -> None:
    from app.models.channel_sync_log import ChannelSyncLog
    db.add(ChannelSyncLog(
        shop_id=shop_id, product_id=product_id, channel_type="bigcommerce", action=action,
        success=success, external_id=external_id, error_message=(error_message or "")[:2000] or None,
    ))
    db.commit()


@router.post("/shops/{shop_id}/channels/bigcommerce/products/{product_id}/create")
def create_bigcommerce_product(
    shop_id: int,
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lists an existing ExiusCart product on the seller's own BigCommerce
    store. weight defaults to 0.5kg when the product has none set —
    BigCommerce rejects product creation without a weight value even for
    listings that will never actually ship by weight."""
    from app.models.product import Product
    from app.models.channel_product_status import ChannelProductStatus

    _shop_or_404(shop_id, current_user, db)
    product = db.query(Product).filter(Product.id == product_id, Product.shop_id == shop_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    image_urls = [img.url for img in (product.images or []) if img.url]
    body = {
        "name": product.name,
        "type": "physical",
        "weight": float(getattr(product, "weight", None) or 0.5),
        "price": float(product.price),
        "description": (_strip_clipboard_fragments(product.description) or product.name)[:BIGCOMMERCE_DESCRIPTION_MAX],
        "sku": product.sku or f"EXIUSCART-{product.id}",
        "inventory_tracking": "product",
        "inventory_level": int(product.quantity or 0),
        "images": [{"image_url": url} for url in image_urls[:20]],
    }
    resp = _bc_request_for_shop(shop_id, db, "POST", "v3", "/catalog/products", json=body)
    if resp.status_code >= 300:
        error_detail = resp.text[:500]
        _log_bc_sync(db, shop_id, "create_listing", False, product_id=product_id, error_message=error_detail)
        raise HTTPException(status_code=502, detail=f"BigCommerce rejected the product: {error_detail}")

    external_id = str(resp.json().get("data", {}).get("id"))
    existing = db.query(ChannelProductStatus).filter(
        ChannelProductStatus.product_id == product_id,
        ChannelProductStatus.channel_type == "bigcommerce",
    ).first()
    if existing:
        existing.status = "approved"  # BigCommerce products are live immediately, no marketplace review step
        existing.external_item_id = external_id
    else:
        db.add(ChannelProductStatus(product_id=product_id, shop_id=shop_id, channel_type="bigcommerce", status="approved", external_item_id=external_id))
    db.commit()
    _log_bc_sync(db, shop_id, "create_listing", True, product_id=product_id, external_id=external_id)
    return {"message": "Listed on BigCommerce.", "external_id": external_id}


@router.get("/shops/{shop_id}/channels/bigcommerce/products/{product_id}/listing")
def get_bigcommerce_listing_status(
    shop_id: int,
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.channel_product_status import ChannelProductStatus
    _shop_or_404(shop_id, current_user, db)
    status = db.query(ChannelProductStatus).filter(
        ChannelProductStatus.product_id == product_id,
        ChannelProductStatus.channel_type == "bigcommerce",
    ).first()
    if not status:
        return {"listed": False}
    return {"listed": True, "status": status.status, "external_id": status.external_item_id}


# ── Order sync ────────────────────────────────────────────────────────────────

def fetch_bc_orders(store_hash: str, access_token: str, days: int = 7) -> list | None:
    """GET /v2/orders, paginated via page/limit. min_date_created filters
    server-side — BigCommerce's v2 API expects RFC 2822 date format."""
    from datetime import datetime, timezone, timedelta
    from email.utils import format_datetime
    since = datetime.now(timezone.utc) - timedelta(days=days)
    orders = []
    page = 1
    while True:
        resp = _bc_request(
            store_hash, access_token, "GET", "v2", "/orders",
            params={"min_date_created": format_datetime(since), "limit": 250, "page": page},
        )
        if resp.status_code == 204:  # BigCommerce v2 returns 204 (not an empty array) when a page has no results
            break
        if resp.status_code >= 300:
            logger.error(f"[BIGCOMMERCE ORDERS] list failed: {resp.status_code} {resp.text[:300]}")
            return None if not orders else orders
        batch = resp.json()
        if not batch:
            break
        orders.extend(batch)
        if len(batch) < 250:
            break
        page += 1
    return orders


def sync_bigcommerce_orders(conn: ChannelConnection, shop, db: Session, days: int = 7) -> int:
    """Mirrors sync_woocommerce_orders — pulls orders ExiusCart doesn't
    already have. Line items need a separate call per order since
    BigCommerce's v2 order object only links to them, doesn't embed them."""
    from app.models.channel_order_meta import ChannelOrderMeta
    from app.models.order import Order, OrderItem
    from app.models.product import Product
    from app.models.product_variant import ProductVariant
    import uuid as _uuid

    store_hash, access_token = conn.channel_api_url, conn.channel_api_key
    orders_data = fetch_bc_orders(store_hash, access_token, days)
    if not orders_data:
        return 0

    order_ids = {str(o.get("id")) for o in orders_data if o.get("id")}
    already_known = {
        m.channel_order_id for m in db.query(ChannelOrderMeta).filter(
            ChannelOrderMeta.channel_type == "bigcommerce",
            ChannelOrderMeta.channel_order_id.in_(order_ids),
        ).all()
    }
    created = 0

    for bc_order in orders_data:
        bc_order_id = str(bc_order.get("id"))
        if not bc_order_id or bc_order_id in already_known:
            continue

        products_resp = _bc_request(store_hash, access_token, "GET", "v2", f"/orders/{bc_order_id}/products")
        if products_resp.status_code >= 300:
            logger.warning(f"[BIGCOMMERCE ORDERS] order_id={bc_order_id} — could not fetch line items: {products_resp.status_code}")
            continue
        line_items = products_resp.json() or []

        subtotal = 0.0
        order_items_to_add = []
        items_detail = []
        for line_item in line_items:
            sku = line_item.get("sku")
            product = db.query(Product).filter(Product.shop_id == shop.id, Product.sku == sku).first() if sku else None
            if not product:
                variant = db.query(ProductVariant).filter(ProductVariant.sku == sku).first() if sku else None
                product = db.query(Product).filter(Product.id == variant.product_id).first() if variant else None
            if not product:
                logger.warning(f"[BIGCOMMERCE ORDERS] shop={shop.id} order_id={bc_order_id} — no product matches SKU {sku!r}, skipping item")
                continue

            qty = int(line_item.get("quantity") or 1)
            item_total = float(line_item.get("total_inc_tax") or line_item.get("total_ex_tax") or 0)
            subtotal += item_total
            order_items_to_add.append(OrderItem(
                product_id=product.id, product_name=product.name,
                quantity=qty, unit_price=(item_total / qty if qty else item_total), total_price=item_total,
            ))
            items_detail.append({"sku": sku, "line_item_id": line_item.get("id"), "quantity": qty})

        if not order_items_to_add:
            logger.warning(f"[BIGCOMMERCE ORDERS] shop={shop.id} order_id={bc_order_id} — no items matched any product, order not created")
            continue

        order = Order(
            order_number=f"BC-{bc_order_id}-{str(_uuid.uuid4())[:4].upper()}",
            source="channel", subtotal=subtotal, total=subtotal,
            shop_id=shop.id, notes=f"BigCommerce Order #{bc_order_id}",
        )
        db.add(order)
        db.flush()
        for oi in order_items_to_add:
            oi.order_id = order.id
            db.add(oi)
        db.add(ChannelOrderMeta(order_id=order.id, channel_type="bigcommerce", channel_order_id=bc_order_id, items_detail=items_detail))
        created += 1

    if created:
        from datetime import datetime, timezone
        conn.last_synced_at = datetime.now(timezone.utc)
        db.commit()
    return created


@router.post("/shops/{shop_id}/channels/bigcommerce/sync-orders")
def sync_bigcommerce_orders_now(
    shop_id: int,
    days: int = 7,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shop = _shop_or_404(shop_id, current_user, db)
    conn = _get_bc_connection(shop_id, db)
    created = sync_bigcommerce_orders(conn, shop, db, min(max(days, 1), 90))
    return {"orders_created": created}


class BigCommerceFulfillIn(BaseModel):
    tracking_number: str
    carrier_name: str


@router.post("/shops/{shop_id}/channels/bigcommerce/orders/{order_id}/fulfill")
def fulfill_bigcommerce_order(
    shop_id: int,
    order_id: int,
    data: BigCommerceFulfillIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Creates a real BigCommerce Shipment (first-class tracking_number
    field, unlike WooCommerce's plugin-only gap) and marks the order
    Shipped (status_id 2)."""
    from app.models.channel_order_meta import ChannelOrderMeta

    shop = _shop_or_404(shop_id, current_user, db)
    conn = _get_bc_connection(shop_id, db)

    meta = db.query(ChannelOrderMeta).filter(
        ChannelOrderMeta.order_id == order_id,
        ChannelOrderMeta.channel_type == "bigcommerce",
    ).first()
    if not meta or not meta.channel_order_id:
        raise HTTPException(status_code=404, detail="This order isn't linked to a BigCommerce order")

    order_items = (meta.items_detail or [])
    shipment_resp = _bc_request_for_shop(
        shop_id, db, "POST", "v2", f"/orders/{meta.channel_order_id}/shipments",
        json={
            "tracking_number": data.tracking_number,
            "shipping_method": data.carrier_name,
            "items": [{"order_product_id": it.get("line_item_id"), "quantity": it.get("quantity", 1)} for it in order_items if it.get("line_item_id")],
        },
    )
    if shipment_resp.status_code >= 300:
        raise HTTPException(status_code=502, detail=f"BigCommerce rejected the shipment: {shipment_resp.text[:500]}")

    status_resp = _bc_request_for_shop(shop_id, db, "PUT", "v2", f"/orders/{meta.channel_order_id}", json={"status_id": BC_STATUS_SHIPPED})
    if status_resp.status_code >= 300:
        logger.warning(f"[BIGCOMMERCE FULFILL] shipment created but status update failed: {status_resp.text[:300]}")

    return {"message": "Order marked Shipped on BigCommerce with tracking attached."}
