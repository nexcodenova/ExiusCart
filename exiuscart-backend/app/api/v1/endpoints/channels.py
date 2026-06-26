"""
Channel Integrations — connect ExiusCart shops to external sales platforms.

Flow:
  ExiusCart → pushes products TO channels   (TheDersi, Shopify, etc.)
  Channels  → push orders BACK to ExiusCart (via webhook URL)

Supported channels:
  thedersi   — Sri Lankan fashion marketplace
  shopify    — Shopify store
  woocommerce — WooCommerce site
  custom     — any custom website using our storefront API
"""
import os
import secrets
import uuid
import logging
import httpx
from datetime import datetime, timezone
from typing import List, Optional, Union

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Header, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db, SessionLocal
from app.core.thedersi import MONTHLY_ORDER_LIMITS, notify_thedersi, verify_thedersi_signature
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.shop import Shop
from app.models.channel import ChannelConnection
from app.models.product import Product
from app.models.order import Order, OrderItem
from app.models.customer import Customer
from app.models.channel_order_meta import ChannelOrderMeta
from app.models.channel_product_status import ChannelProductStatus
from app.models.channel_category import ChannelCategory, ProductChannelCategory
from app.models.product_variant import ProductVariant
from app.models.subscription import Subscription
from app.models.thedersi_seller import TheDersiSeller

router = APIRouter()

EXIUSCART_BASE = os.getenv("EXIUSCART_API_BASE", "https://api.exiuscart.com/api/v1")

DEFAULT_CHANNEL_URLS = {
    "thedersi": os.getenv("THEDERSI_API_URL", "https://thedersi.lk/api/v1"),
}

# Marketplace channels require admin approval before products go live.
# Own-store channels (Shopify, WooCommerce) publish instantly — seller is their own admin.
MARKETPLACE_CHANNELS = {"thedersi"}


# ── Schemas ───────────────────────────────────────────────────────────────────

class ChannelConnectIn(BaseModel):
    channel_type: str                        # "thedersi" | "shopify" | "woocommerce" | "custom"
    channel_api_key: str                     # API key TheDersi gave to this seller
    channel_api_url: Optional[str] = None   # optional override
    channel_seller_id: Optional[str] = None


class OrderItemIn(BaseModel):
    exiuscart_product_id: Optional[Union[int, str]] = None  # TheDersi sends int, future may send str
    product_name: Optional[str] = None
    quantity: int
    unit_price: float
    item_total: Optional[float] = None
    size: Optional[str] = None
    color: Optional[str] = None

    def parsed_product_id(self) -> Optional[int]:
        """Return integer product id, stripping any non-numeric prefix like 'prod_'."""
        if self.exiuscart_product_id is None:
            return None
        try:
            return int(self.exiuscart_product_id)
        except (ValueError, TypeError):
            stripped = ''.join(filter(str.isdigit, str(self.exiuscart_product_id)))
            return int(stripped) if stripped else None


class ChannelOrderWebhook(BaseModel):
    channel_order_id: str
    buyer_name: Optional[str] = None
    buyer_email: Optional[str] = None
    buyer_phone: Optional[str] = None
    shipping_address: Optional[str] = None
    items: List[OrderItemIn]
    subtotal: float
    total: float
    currency: str = "LKR"
    payment_status: Optional[str] = None        # "paid" | "pending" — TheDersi sends "paid"
    # Delivery info (TheDersi specific)
    delivery_fee: Optional[float] = None
    delivery_paid_by: Optional[str] = None      # "customer" | "seller"
    delivery_note: Optional[str] = None
    # Commission info (TheDersi specific)
    seller_plan: Optional[str] = None
    commission_rate: Optional[float] = None
    commission_amount: Optional[float] = None
    seller_net_earnings: Optional[float] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _shop_or_404(shop_id: int, user: User, db: Session) -> Shop:
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


def _channel_url(conn: ChannelConnection) -> str:
    return (conn.channel_api_url or DEFAULT_CHANNEL_URLS.get(conn.channel_type, "")).rstrip("/")


def _webhook_url(conn: ChannelConnection) -> str:
    return f"{EXIUSCART_BASE.rstrip('/')}/channels/webhook/{conn.webhook_secret}"


def _product_payload(
    product: Product,
    currency: str,
    channel_type: str,
    channel_category_id: str = None,
    channel_sub_category_id: str = None,
) -> dict:
    status = "pending_review" if channel_type in MARKETPLACE_CHANNELS else "active"
    category = channel_category_id or None
    sub_category = channel_sub_category_id or None

    variants = [
        {
            "size": v.size,
            "color": v.color,
            "sku": v.sku,
            "quantity": v.quantity,
            "price": float(v.price) if v.price is not None else None,
        }
        for v in (product.variants or [])
    ]
    total_stock = sum(v["quantity"] for v in variants) if variants else product.quantity

    compare_at_price = float(product.compare_at_price) if product.compare_at_price else None
    selling_price = float(product.price)

    image_urls = [img.url for img in (product.images or []) if img.url][:4]
    if not image_urls and product.image_url:
        image_urls = [product.image_url]

    return {
        "exiuscart_product_id": product.id,
        "name": product.name,
        "description": product.description or "",
        "price": selling_price,
        "compare_at_price": compare_at_price,
        "quantity": total_stock,
        "image_urls": image_urls,
        "category": category,
        "sub_category": sub_category,
        "variants": variants,
        "is_featured": False,
        "is_trending": False,
    }


def _push_one(payload: dict, conn: ChannelConnection):
    """HTTP call to push/update a product on the connected channel."""
    api_url = _channel_url(conn)
    if not api_url:
        logger.warning(f"[CHANNEL PUSH] No API URL for channel {conn.channel_type} conn={conn.id}")
        return
    headers = {"X-Api-Key": conn.channel_api_key, "Content-Type": "application/json"}
    pid = payload["exiuscart_product_id"]
    try:
        with httpx.Client(timeout=10) as client:
            r = client.put(f"{api_url}/exiuscart/products/{pid}", json=payload, headers=headers)
            logger.info(f"[CHANNEL PUSH] PUT {api_url}/exiuscart/products/{pid} → {r.status_code}")
            if r.status_code == 404:
                r2 = client.post(f"{api_url}/exiuscart/products", json=payload, headers=headers)
                logger.info(f"[CHANNEL PUSH] POST {api_url}/exiuscart/products → {r2.status_code}")
    except Exception as exc:
        logger.error(f"[CHANNEL PUSH] {api_url} product={pid} error: {exc}")


def _delete_one(product_id: int, conn: ChannelConnection):
    api_url = _channel_url(conn)
    if not api_url:
        logger.warning(f"[CHANNEL DELETE] No API URL for channel {conn.channel_type} conn={conn.id}")
        return
    headers = {"X-Api-Key": conn.channel_api_key}
    url = f"{api_url}/exiuscart/products/{product_id}"
    try:
        with httpx.Client(timeout=10) as client:
            r = client.delete(url, headers=headers)
            logger.info(f"[CHANNEL DELETE] DELETE {url} → {r.status_code}")
    except Exception as exc:
        logger.error(f"[CHANNEL DELETE] {url} error: {exc}")


# ── Background tasks (use fresh DB session) ───────────────────────────────────

def _bg_full_sync(shop_id: int, conn_id: int):
    db = SessionLocal()
    try:
        conn = db.query(ChannelConnection).filter(ChannelConnection.id == conn_id).first()
        shop = db.query(Shop).filter(Shop.id == shop_id).first()
        if not conn or not shop:
            return
        products = db.query(Product).filter(
            Product.shop_id == shop_id, Product.is_active == True
        ).all()
        for p in products:
            pcc = db.query(ProductChannelCategory).filter(
                ProductChannelCategory.product_id == p.id,
                ProductChannelCategory.channel_connection_id == conn_id,
            ).first()
            cat_id = pcc.channel_category_id if pcc else None
            sub_cat_id = pcc.channel_sub_category_id if pcc else None
            _push_one(_product_payload(p, shop.currency, conn.channel_type, cat_id, sub_cat_id), conn)
        conn.last_synced_at = datetime.now(timezone.utc)
        db.commit()
    finally:
        db.close()


def _bg_push_product(product_id: int, shop_id: int):
    """Push one product to ALL active channel connections for this shop."""
    db = SessionLocal()
    try:
        product = db.query(Product).filter(Product.id == product_id).first()
        shop = db.query(Shop).filter(Shop.id == shop_id).first()
        if not product or not shop:
            logger.warning(f"[BG PUSH] product={product_id} shop={shop_id} not found — skipping")
            return
        if not product.list_on_marketplace:
            logger.info(f"[BG PUSH] product={product_id} is POS-only (list_on_marketplace=False) — not pushing to channels")
            return
        connections = db.query(ChannelConnection).filter(
            ChannelConnection.shop_id == shop_id, ChannelConnection.is_active == True
        ).all()
        logger.info(f"[BG PUSH] product={product_id} shop={shop_id} → {len(connections)} connection(s)")
        for conn in connections:
            pcc = db.query(ProductChannelCategory).filter(
                ProductChannelCategory.product_id == product_id,
                ProductChannelCategory.channel_connection_id == conn.id,
            ).first()
            cat_id = pcc.channel_category_id if pcc else None
            sub_cat_id = pcc.channel_sub_category_id if pcc else None
            _push_one(_product_payload(product, shop.currency, conn.channel_type, cat_id, sub_cat_id), conn)
            if conn.channel_type in MARKETPLACE_CHANNELS:
                existing = db.query(ChannelProductStatus).filter(
                    ChannelProductStatus.product_id == product_id,
                    ChannelProductStatus.channel_type == conn.channel_type,
                ).first()
                if existing:
                    # Preserve approval. A routine update (price, stock, image) on an
                    # already-approved product must NOT bounce it back to pending review.
                    # Only a previously REJECTED product is re-submitted after the fix.
                    if existing.status == "rejected":
                        existing.status = "pending_review"
                        existing.rejection_reason = None
                    # approved → stays approved; pending → stays pending
                else:
                    db.add(ChannelProductStatus(
                        product_id=product_id,
                        shop_id=shop_id,
                        channel_type=conn.channel_type,
                        status="pending_review",
                    ))
        db.commit()
    except Exception as exc:
        logger.error(f"[BG PUSH] product={product_id} shop={shop_id} FAILED: {exc}")
    finally:
        db.close()


def _bg_delete_product_and_notify(product_id: int, shop_id: int):
    """Delete product from all channels — separate from DB delete so it survives process restarts."""
    db = SessionLocal()
    try:
        connections = db.query(ChannelConnection).filter(
            ChannelConnection.shop_id == shop_id, ChannelConnection.is_active == True
        ).all()
        logger.info(f"[BG DELETE] product={product_id} shop={shop_id} → {len(connections)} connection(s)")
        for conn in connections:
            _delete_one(product_id, conn)
    except Exception as exc:
        logger.error(f"[BG DELETE] product={product_id} shop={shop_id} FAILED: {exc}")
    finally:
        db.close()


# ── Public helpers (called from products.py) ──────────────────────────────────

def trigger_product_sync(product_id: int, shop_id: int, background_tasks: BackgroundTasks):
    background_tasks.add_task(_bg_push_product, product_id, shop_id)


def trigger_product_delete(product_id: int, shop_id: int, background_tasks: BackgroundTasks):
    background_tasks.add_task(_bg_delete_product_and_notify, product_id, shop_id)


def _bg_push_stock(product_id: int, shop_id: int):
    """
    Push updated stock levels to all connected marketplace channels after any
    inventory change (POS sale, manual adjustment, order fulfillment).
    Only pushes to marketplace channels (TheDersi) — own-store channels manage stock internally.
    """
    db = SessionLocal()
    try:
        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            return
        if not product.list_on_marketplace:
            return  # POS-only product — never on the marketplace, nothing to sync
        connections = db.query(ChannelConnection).filter(
            ChannelConnection.shop_id == shop_id,
            ChannelConnection.is_active == True,
            ChannelConnection.channel_type.in_(MARKETPLACE_CHANNELS),
        ).all()
        for conn in connections:
            api_url = _channel_url(conn)
            if not api_url:
                continue
            # Build variant stock list if variants exist
            variants = db.query(ProductVariant).filter(ProductVariant.product_id == product_id).all()
            if variants:
                stock_payload = {
                    "quantity": sum(v.quantity for v in variants),
                    "variants": [
                        {"size": v.size, "color": v.color, "quantity": v.quantity}
                        for v in variants
                    ],
                }
            else:
                stock_payload = {"quantity": product.quantity}

            try:
                with httpx.Client(timeout=8) as client:
                    client.patch(
                        f"{api_url}/exiuscart/products/{product_id}/stock",
                        json=stock_payload,
                        headers={"X-Api-Key": conn.channel_api_key},
                    )
            except Exception:
                pass  # stock sync is best-effort
    finally:
        db.close()


def trigger_stock_sync(product_id: int, shop_id: int, background_tasks: BackgroundTasks):
    background_tasks.add_task(_bg_push_stock, product_id, shop_id)


# ── Channel management endpoints ──────────────────────────────────────────────

@router.post("/shops/{shop_id}/channels", status_code=201)
def connect_channel(
    shop_id: int,
    data: ChannelConnectIn,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Connect a shop to an external channel.
    On connect, all existing active products are immediately synced to the channel.
    Returns a webhook_url — give this to the channel developer so they can send orders back.
    """
    _shop_or_404(shop_id, current_user, db)

    existing = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.channel_type == data.channel_type,
        ChannelConnection.is_active == True,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Already connected to {data.channel_type}")

    conn = ChannelConnection(
        shop_id=shop_id,
        channel_type=data.channel_type,
        channel_api_key=data.channel_api_key,
        channel_api_url=data.channel_api_url,
        channel_seller_id=data.channel_seller_id,
        webhook_secret=secrets.token_urlsafe(32),
    )
    db.add(conn)
    db.commit()
    db.refresh(conn)

    background_tasks.add_task(_bg_full_sync, shop_id, conn.id)

    return {
        "id": conn.id,
        "channel_type": conn.channel_type,
        "webhook_url": _webhook_url(conn),
        "message": f"Connected to {data.channel_type}. All products syncing in background.",
        "instruction": "Give webhook_url to the channel developer — they call it when a buyer places an order.",
    }


@router.get("/shops/{shop_id}/channels")
def list_channels(
    shop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    conns = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.is_active == True,
    ).all()
    return [
        {
            "id": c.id,
            "channel_type": c.channel_type,
            "channel_seller_id": c.channel_seller_id,
            "last_synced_at": c.last_synced_at,
            "webhook_url": _webhook_url(c),
        }
        for c in conns
    ]


@router.delete("/shops/{shop_id}/channels/{channel_id}", status_code=200)
def disconnect_channel(
    shop_id: int,
    channel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    conn = db.query(ChannelConnection).filter(
        ChannelConnection.id == channel_id,
        ChannelConnection.shop_id == shop_id,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Channel not found")
    conn.is_active = False
    db.commit()
    return {"message": f"Disconnected from {conn.channel_type}"}


@router.post("/shops/{shop_id}/channels/{channel_id}/sync")
def manual_sync(
    shop_id: int,
    channel_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Force re-sync all products to a connected channel."""
    _shop_or_404(shop_id, current_user, db)
    conn = db.query(ChannelConnection).filter(
        ChannelConnection.id == channel_id,
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.is_active == True,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Channel not found")
    background_tasks.add_task(_bg_full_sync, shop_id, conn.id)
    return {"message": "Full product sync started in background"}


# ── Webhook receiver — channels call this when orders are placed ──────────────

@router.post("/channels/webhook/{webhook_secret}")
async def receive_order_webhook(
    webhook_secret: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Called by TheDersi (or any channel) when a buyer places an order.
    The webhook_secret in the URL identifies which shop and authenticates the call.
    X-Signature (HMAC-SHA256) is verified if THEDERSI_HMAC_SECRET is configured.
    ExiusCart:
      1. Creates/finds the customer
      2. Creates the order
      3. Decreases inventory for each item
    """
    body = await request.body()
    x_sig = request.headers.get("X-Signature", "")
    if not verify_thedersi_signature(body, x_sig):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        payload = ChannelOrderWebhook.model_validate_json(body)
    except Exception as e:
        logger.error(f"[WEBHOOK] payload parse failed: {e} | body={body[:500]}")
        raise HTTPException(status_code=422, detail=f"Invalid webhook payload: {e}")

    conn = db.query(ChannelConnection).filter(
        ChannelConnection.webhook_secret == webhook_secret,
        ChannelConnection.is_active == True,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Invalid webhook URL")

    # ── Idempotency: dedupe by channel_order_id ───────────────────────────────
    # TheDersi sends the same order twice: payment_status "pending" first, then
    # "paid" once confirmed. Both carry the same channel_order_id. On the second
    # (and any later) notification we update the existing order instead of
    # creating a duplicate and decrementing stock again.
    incoming_chan_id = payload.channel_order_id or ""
    while incoming_chan_id.startswith("TD-TD-"):
        incoming_chan_id = incoming_chan_id[3:]

    if incoming_chan_id:
        existing_meta = db.query(ChannelOrderMeta).filter(
            ChannelOrderMeta.channel_type == conn.channel_type,
            ChannelOrderMeta.channel_order_id == incoming_chan_id,
        ).first()
        if existing_meta:
            existing_order = db.query(Order).filter(Order.id == existing_meta.order_id).first()
            if existing_order:
                old_payment = (existing_order.payment_status or "").lower()
                new_payment = (payload.payment_status or existing_order.payment_status or "").lower()
                changed_pids: set = set()

                # Stock follows payment: decrement when entering "paid", restore when leaving it.
                if new_payment == "paid" and old_payment != "paid":
                    for it in existing_order.items:
                        prod = db.query(Product).filter(Product.id == it.product_id).first()
                        if prod:
                            prod.quantity = max(0, (prod.quantity or 0) - it.quantity)
                            changed_pids.add(prod.id)
                elif old_payment == "paid" and new_payment != "paid":
                    for it in existing_order.items:
                        prod = db.query(Product).filter(Product.id == it.product_id).first()
                        if prod:
                            prod.quantity = (prod.quantity or 0) + it.quantity
                            changed_pids.add(prod.id)

                existing_order.payment_status = new_payment or existing_order.payment_status
                db.commit()

                for pid in changed_pids:
                    _bg_push_stock(pid, conn.shop_id)

                logger.info(
                    f"[WEBHOOK] dedupe: {existing_order.order_number} → "
                    f"payment {old_payment}→{new_payment}, stock_changed={list(changed_pids)} "
                    f"(channel_order_id={incoming_chan_id})"
                )
                return {
                    "success": True,
                    "exiuscart_order_id": existing_order.id,
                    "order_number": existing_order.order_number,
                    "updated": True,
                }

    # ── Monthly order limit check (all sources: POS + channel combined) ───────
    sub = db.query(Subscription).filter(Subscription.shop_id == conn.shop_id).first()
    plan_type = sub.plan_type if sub else None
    monthly_limit = MONTHLY_ORDER_LIMITS.get(plan_type)  # None = unlimited

    if monthly_limit is not None:
        # Count ALL orders this calendar month (POS + every connected channel)
        now = datetime.now(timezone.utc)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        orders_this_month = (
            db.query(Order)
            .filter(
                Order.shop_id == conn.shop_id,
                Order.created_at >= month_start,
            )
            .count()
        )

        if orders_this_month >= monthly_limit:
            # Notify TheDersi so they can show an upgrade prompt to the seller
            thedersi_link = db.query(TheDersiSeller).filter(
                TheDersiSeller.shop_id == conn.shop_id
            ).first()
            if thedersi_link and conn.channel_type == "thedersi":
                notify_thedersi(
                    thedersi_link.thedersi_seller_id,
                    plan_type or "thedersi_basic",
                    event="order_limit_reached",
                )
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "order_limit_reached",
                    "limit": monthly_limit,
                    "used": orders_this_month,
                    "plan": plan_type,
                    "message": f"Monthly order limit of {monthly_limit} reached. Upgrade your TheDersi plan to continue.",
                },
            )
    # ─────────────────────────────────────────────────────────────────────────

    # Get or create customer
    customer = None
    if payload.buyer_email:
        customer = db.query(Customer).filter(
            Customer.email == payload.buyer_email,
            Customer.shop_id == conn.shop_id,
        ).first()
    if not customer and payload.buyer_name:
        customer = Customer(
            shop_id=conn.shop_id,
            name=payload.buyer_name,
            email=payload.buyer_email,
            phone=payload.buyer_phone,
            address=payload.shipping_address,
        )
        db.add(customer)
        db.flush()

    # Create order
    order_number = f"{conn.channel_type.upper()}-{uuid.uuid4().hex[:8].upper()}"
    delivery_note = payload.delivery_note or ""
    if payload.delivery_paid_by == "customer":
        delivery_note = delivery_note or f"Customer pays LKR {payload.delivery_fee or 500} delivery on arrival (COD)."
    elif payload.delivery_paid_by == "seller":
        delivery_note = delivery_note or "Free shipping — seller arranges and pays delivery."

    order = Order(
        shop_id=conn.shop_id,
        customer_id=customer.id if customer else None,
        order_number=order_number,
        status="confirmed",
        payment_status=payload.payment_status or "pending",
        source=conn.channel_type,
        subtotal=payload.subtotal,
        tax_amount=0,
        discount_amount=0,
        total=payload.total,
        notes=f"{conn.channel_type.title()} Order #{payload.channel_order_id} | {delivery_note}",
        shipping_address=payload.shipping_address,
    )
    db.add(order)
    db.flush()

    # Create order items. Stock is only decremented when the order is PAID
    # (ExiusCart = single source of truth; TheDersi no longer decrements). A
    # pending order reserves nothing — the decrement happens on the paid
    # follow-up notification handled in the dedupe path above.
    order_is_paid = (payload.payment_status or "").lower() == "paid"
    stock_changed_product_ids: set = set()
    for item in payload.items:
        pid = item.parsed_product_id()
        product = db.query(Product).filter(
            Product.id == pid,
            Product.shop_id == conn.shop_id,
        ).first() if pid else None

        if not product:
            logger.warning(f"[WEBHOOK] product id={pid} not found in shop {conn.shop_id}, skipping item")
            continue

        db.add(OrderItem(
            order_id=order.id,
            product_id=product.id,
            quantity=item.quantity,
            unit_price=item.unit_price,
            total_price=item.item_total or (item.unit_price * item.quantity),
        ))

        if order_is_paid:
            # Reduce variant stock if size/color specified, otherwise product-level
            if item.size or item.color:
                variant = db.query(ProductVariant).filter(
                    ProductVariant.product_id == product.id,
                    ProductVariant.size == item.size,
                    ProductVariant.color == item.color,
                ).first()
                if variant:
                    variant.quantity = max(0, variant.quantity - item.quantity)
                else:
                    product.quantity = max(0, product.quantity - item.quantity)
            else:
                product.quantity = max(0, product.quantity - item.quantity)
            stock_changed_product_ids.add(product.id)

    # Save channel-specific meta (commission, delivery, variants)
    # channel_order_id already normalized above (incoming_chan_id)
    db.add(ChannelOrderMeta(
        order_id=order.id,
        channel_type=conn.channel_type,
        channel_order_id=incoming_chan_id,
        seller_plan=payload.seller_plan,
        commission_rate=payload.commission_rate,
        commission_amount=payload.commission_amount,
        seller_net_earnings=payload.seller_net_earnings,
        delivery_fee=payload.delivery_fee,
        delivery_paid_by=payload.delivery_paid_by,
        delivery_note=delivery_note,
        items_detail=[item.model_dump() for item in payload.items],
    ))

    db.commit()

    # Push updated stock to TheDersi for all products whose stock changed
    for pid in stock_changed_product_ids:
        _bg_push_stock(pid, conn.shop_id)

    return {
        "success": True,
        "exiuscart_order_id": order.id,
        "order_number": order_number,
    }


# ── Channel categories ────────────────────────────────────────────────────────

@router.post("/shops/{shop_id}/channels/{channel_id}/sync-categories")
def sync_channel_categories(
    shop_id: int,
    channel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Fetch and cache the category list from a connected channel.
    Call this when seller first connects a channel, or to refresh categories.
    """
    _shop_or_404(shop_id, current_user, db)
    conn = db.query(ChannelConnection).filter(
        ChannelConnection.id == channel_id,
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.is_active == True,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Channel not found")

    api_url = _channel_url(conn)
    if not api_url:
        raise HTTPException(status_code=400, detail="No API URL configured for this channel")

    headers = {"X-Api-Key": conn.channel_api_key}
    try:
        with httpx.Client(timeout=10) as client:
            r = client.get(f"{api_url}/exiuscart/categories", headers=headers)
            r.raise_for_status()
            categories = r.json()
    except Exception as e:
        logger.warning(f"[SYNC CATEGORIES] Could not reach {api_url}: {e} — returning cached")
        cached = db.query(ChannelCategory).filter(
            ChannelCategory.channel_connection_id == channel_id
        ).all()
        return {"synced": 0, "cached": True, "categories": [c.name for c in cached]}

    # Clear old cached categories and re-save
    db.query(ChannelCategory).filter(
        ChannelCategory.channel_connection_id == channel_id
    ).delete()

    for cat in categories:
        db.add(ChannelCategory(
            channel_connection_id=channel_id,
            channel_category_id=str(cat.get("id") or cat.get("slug") or cat.get("name")),
            name=cat.get("name", ""),
            parent_id=str(cat.get("parent_id")) if cat.get("parent_id") else None,
        ))
    db.commit()

    return {"synced": len(categories), "categories": [c.get("name") for c in categories]}


@router.get("/shops/{shop_id}/channels/{channel_id}/categories")
def get_channel_categories(
    shop_id: int,
    channel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return cached TheDersi (or other channel) categories for use in product form dropdown."""
    _shop_or_404(shop_id, current_user, db)
    cats = db.query(ChannelCategory).filter(
        ChannelCategory.channel_connection_id == channel_id,
    ).all()
    return [{"id": c.channel_category_id, "name": c.name, "parent_id": c.parent_id} for c in cats]


@router.get("/shops/{shop_id}/channels/{channel_id}/thedersi-info")
def get_thedersi_seller_info(
    shop_id: int,
    channel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Proxy call to TheDersi GET /seller/info using the seller's stored API key.
    Returns earnings balance, plan, payout schedule, and next payout date.
    The API key is never exposed to the browser — all calls go server-to-server.
    """
    _shop_or_404(shop_id, current_user, db)
    conn = db.query(ChannelConnection).filter(
        ChannelConnection.id == channel_id,
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.is_active == True,
        ChannelConnection.channel_type == "thedersi",
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="TheDersi connection not found")

    api_url = _channel_url(conn)
    try:
        with httpx.Client(timeout=10) as client:
            r = client.get(
                f"{api_url}/seller/info",
                headers={"X-Api-Key": conn.channel_api_key},
            )
            r.raise_for_status()
            return r.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail="TheDersi returned an error")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not reach TheDersi: {e}")


@router.get("/shops/{shop_id}/channels/{channel_id}/thedersi-payouts")
def get_thedersi_payouts(
    shop_id: int,
    channel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Proxy call to TheDersi GET /seller/payouts.
    Returns payout history for the seller. API key never exposed to browser.
    """
    _shop_or_404(shop_id, current_user, db)
    conn = db.query(ChannelConnection).filter(
        ChannelConnection.id == channel_id,
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.is_active == True,
        ChannelConnection.channel_type == "thedersi",
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="TheDersi connection not found")

    api_url = _channel_url(conn)
    try:
        with httpx.Client(timeout=10) as client:
            r = client.get(
                f"{api_url}/seller/payouts",
                headers={"X-Api-Key": conn.channel_api_key},
            )
            r.raise_for_status()
            return r.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail="TheDersi returned an error")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not reach TheDersi: {e}")


@router.post("/shops/{shop_id}/channels/{channel_id}/thedersi-request-payout")
def request_thedersi_payout(
    shop_id: int,
    channel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Proxy call to TheDersi POST /seller/payouts.
    Submits a payout request on behalf of the seller. API key never exposed to browser.
    TheDersi calculates the available balance automatically.
    """
    _shop_or_404(shop_id, current_user, db)
    conn = db.query(ChannelConnection).filter(
        ChannelConnection.id == channel_id,
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.is_active == True,
        ChannelConnection.channel_type == "thedersi",
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="TheDersi connection not found")

    api_url = _channel_url(conn)
    try:
        with httpx.Client(timeout=10) as client:
            r = client.post(
                f"{api_url}/seller/payouts",
                headers={"X-Api-Key": conn.channel_api_key},
            )
            if r.status_code == 400:
                detail = r.json().get("error", "Payout request failed")
                raise HTTPException(status_code=400, detail=detail)
            r.raise_for_status()
            return r.json()
    except HTTPException:
        raise
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail="TheDersi returned an error")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not reach TheDersi: {e}")


class SetProductChannelCategory(BaseModel):
    channel_connection_id: int
    channel_category_id: str
    channel_category_name: str


@router.put("/shops/{shop_id}/products/{product_id}/channel-category")
def set_product_channel_category(
    shop_id: int,
    product_id: int,
    data: SetProductChannelCategory,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Assign a channel-specific category to a product.
    E.g. seller sets TheDersi category = "Festival Wear" for their Blue Saree product.
    Automatically re-syncs the product to the channel with the updated category.
    """
    _shop_or_404(shop_id, current_user, db)

    existing = db.query(ProductChannelCategory).filter(
        ProductChannelCategory.product_id == product_id,
        ProductChannelCategory.channel_connection_id == data.channel_connection_id,
    ).first()

    if existing:
        existing.channel_category_id = data.channel_category_id
        existing.channel_category_name = data.channel_category_name
    else:
        db.add(ProductChannelCategory(
            product_id=product_id,
            channel_connection_id=data.channel_connection_id,
            channel_category_id=data.channel_category_id,
            channel_category_name=data.channel_category_name,
        ))
    db.commit()

    # Re-sync product to channel with updated category
    trigger_product_sync(product_id, shop_id, background_tasks)
    return {"message": f"Category set to '{data.channel_category_name}' and product re-synced"}


# ── Product approval callback — TheDersi calls this when admin approves/rejects ─

class ProductStatusCallback(BaseModel):
    exiuscart_product_id: int
    status: str                          # "approved" | "rejected"
    channel: str = "thedersi"
    rejection_reason: Optional[str] = None
    seller_email: Optional[str] = None  # optional, not used for lookup


_THEDERSI_INBOUND_KEY = os.getenv("THEDERSI_INBOUND_KEY", "") or os.getenv("THEDERSI_PARTNER_KEY", "")


def _mask_key(k: str) -> str:
    if not k:
        return "<empty>"
    if len(k) <= 12:
        return f"<short len={len(k)}>"
    return f"{k[:6]}...{k[-4:]} (len={len(k)})"


def _require_partner_key(x_partner_key: str = Header(..., alias="X-Partner-Key")):
    if not _THEDERSI_INBOUND_KEY or x_partner_key != _THEDERSI_INBOUND_KEY:
        logger.warning(
            f"[PRODUCT-STATUS AUTH] 401 partner-key mismatch — "
            f"received={_mask_key(x_partner_key)} expected={_mask_key(_THEDERSI_INBOUND_KEY)}"
        )
        raise HTTPException(status_code=401, detail="Invalid partner key")


@router.patch("/channels/product-status", dependencies=[Depends(_require_partner_key)])
async def update_product_channel_status(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Called by TheDersi admin panel when a product is approved or rejected.
    Verified by both X-Partner-Key header and HMAC-SHA256 X-Signature.
    Updates the product's channel status in ExiusCart so the seller can see:
      🟡 Pending review on TheDersi
      ✅ Live on TheDersi
      ❌ Rejected on TheDersi
    """
    body = await request.body()
    x_sig = request.headers.get("X-Signature", "")
    if not verify_thedersi_signature(body, x_sig):
        logger.warning(f"[PRODUCT-STATUS AUTH] 401 signature mismatch — x_signature_present={bool(x_sig)}")
        raise HTTPException(status_code=401, detail="Invalid webhook signature")
    logger.info(f"[PRODUCT-STATUS] auth OK, body={body[:200]}")

    try:
        payload = ProductStatusCallback.model_validate_json(body)
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid payload")
    if payload.status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="status must be 'approved' or 'rejected'")

    record = db.query(ChannelProductStatus).filter(
        ChannelProductStatus.product_id == payload.exiuscart_product_id,
        ChannelProductStatus.channel_type == payload.channel,
    ).first()

    if not record:
        # First time approval callback — create record
        product = db.query(Product).filter(Product.id == payload.exiuscart_product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        record = ChannelProductStatus(
            product_id=payload.exiuscart_product_id,
            shop_id=product.shop_id,
            channel_type=payload.channel,
        )
        db.add(record)

    record.status = payload.status
    record.rejection_reason = payload.rejection_reason
    db.commit()

    return {
        "success": True,
        "product_id": payload.exiuscart_product_id,
        "channel": payload.channel,
        "status": payload.status,
    }


@router.get("/shops/{shop_id}/channel-statuses")
def get_all_channel_statuses(
    shop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns all channel product statuses for a shop in one call.
    Used by the product list to show 🟡/✅/❌ badges without N+1 requests.
    Returns: { product_id: { channel_type: {status, rejection_reason} } }
    """
    _shop_or_404(shop_id, current_user, db)
    rows = db.query(ChannelProductStatus).filter(
        ChannelProductStatus.shop_id == shop_id,
    ).all()
    result: dict = {}
    for r in rows:
        if r.product_id not in result:
            result[r.product_id] = {}
        result[r.product_id][r.channel_type] = {
            "status": r.status,
            "rejection_reason": r.rejection_reason,
        }
    return result


@router.get("/shops/{shop_id}/products/{product_id}/channel-status")
def get_product_channel_status(
    shop_id: int,
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns the approval status of a product on each connected channel.
    Used by ExiusCart seller dashboard to show:
      🟡 Pending review on TheDersi
      ✅ Live on TheDersi
      ❌ Rejected on TheDersi (with reason)
    """
    _shop_or_404(shop_id, current_user, db)
    statuses = db.query(ChannelProductStatus).filter(
        ChannelProductStatus.product_id == product_id,
        ChannelProductStatus.shop_id == shop_id,
    ).all()

    return [
        {
            "channel": s.channel_type,
            "status": s.status,
            "rejection_reason": s.rejection_reason,
            "updated_at": s.updated_at,
            "label": {
                "pending_review": "🟡 Pending review",
                "approved": "✅ Live",
                "rejected": "❌ Rejected",
            }.get(s.status, s.status),
        }
        for s in statuses
    ]


@router.get("/shops/{shop_id}/products/{product_id}/channel-category")
def get_product_channel_categories(
    shop_id: int,
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns which channel category the seller assigned to this product per connection."""
    _shop_or_404(shop_id, current_user, db)
    rows = db.query(ProductChannelCategory).filter(
        ProductChannelCategory.product_id == product_id,
    ).all()
    return [
        {
            "channel_connection_id": r.channel_connection_id,
            "channel_category_id": r.channel_category_id,
            "channel_category_name": r.channel_category_name,
        }
        for r in rows
    ]
