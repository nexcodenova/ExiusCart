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
import httpx
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db, SessionLocal
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.shop import Shop
from app.models.channel import ChannelConnection
from app.models.product import Product
from app.models.order import Order, OrderItem
from app.models.customer import Customer

router = APIRouter()

EXIUSCART_BASE = os.getenv("EXIUSCART_API_BASE", "https://api.exiuscart.com/api/v1")

DEFAULT_CHANNEL_URLS = {
    "thedersi": os.getenv("THEDERSI_API_URL", "https://api.thedersi.com/v1"),
}


# ── Schemas ───────────────────────────────────────────────────────────────────

class ChannelConnectIn(BaseModel):
    channel_type: str                        # "thedersi" | "shopify" | "woocommerce" | "custom"
    channel_api_key: str                     # API key TheDersi gave to this seller
    channel_api_url: Optional[str] = None   # optional override
    channel_seller_id: Optional[str] = None


class OrderItemIn(BaseModel):
    exiuscart_product_id: int
    quantity: int
    unit_price: float


class ChannelOrderWebhook(BaseModel):
    channel_order_id: str      # TheDersi/Shopify order ID (for reference)
    buyer_name: str
    buyer_email: Optional[str] = None
    buyer_phone: Optional[str] = None
    shipping_address: Optional[str] = None
    items: List[OrderItemIn]
    subtotal: float
    total: float
    currency: str = "LKR"


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


def _product_payload(product: Product, currency: str) -> dict:
    return {
        "exiuscart_product_id": product.id,
        "name": product.name,
        "description": product.description or "",
        "price": float(product.price),
        "currency": currency,
        "stock": product.quantity,
        "sku": product.sku or "",
        "image_url": product.image_url or "",
        "video_url": product.video_url or "",
        "is_active": product.is_active,
        "is_featured": product.is_featured,
        "is_trending": product.is_trending,
        "status": "pending_review",  # always goes to TheDersi admin queue first — admin must approve before going live
    }


def _push_one(payload: dict, conn: ChannelConnection):
    """HTTP call to push/update a product on the connected channel."""
    api_url = _channel_url(conn)
    if not api_url:
        return
    headers = {"X-Api-Key": conn.channel_api_key, "Content-Type": "application/json"}
    pid = payload["exiuscart_product_id"]
    try:
        with httpx.Client(timeout=10) as client:
            r = client.put(f"{api_url}/exiuscart/products/{pid}", json=payload, headers=headers)
            if r.status_code == 404:
                client.post(f"{api_url}/exiuscart/products", json=payload, headers=headers)
    except Exception:
        pass


def _delete_one(product_id: int, conn: ChannelConnection):
    api_url = _channel_url(conn)
    if not api_url:
        return
    headers = {"X-Api-Key": conn.channel_api_key}
    try:
        with httpx.Client(timeout=10) as client:
            client.delete(f"{api_url}/exiuscart/products/{product_id}", headers=headers)
    except Exception:
        pass


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
            _push_one(_product_payload(p, shop.currency), conn)
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
            return
        connections = db.query(ChannelConnection).filter(
            ChannelConnection.shop_id == shop_id, ChannelConnection.is_active == True
        ).all()
        for conn in connections:
            _push_one(_product_payload(product, shop.currency), conn)
    finally:
        db.close()


def _bg_delete_product(product_id: int, shop_id: int):
    db = SessionLocal()
    try:
        connections = db.query(ChannelConnection).filter(
            ChannelConnection.shop_id == shop_id, ChannelConnection.is_active == True
        ).all()
        for conn in connections:
            _delete_one(product_id, conn)
    finally:
        db.close()


# ── Public helpers (called from products.py) ──────────────────────────────────

def trigger_product_sync(product_id: int, shop_id: int, background_tasks: BackgroundTasks):
    background_tasks.add_task(_bg_push_product, product_id, shop_id)


def trigger_product_delete(product_id: int, shop_id: int, background_tasks: BackgroundTasks):
    background_tasks.add_task(_bg_delete_product, product_id, shop_id)


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
def receive_order_webhook(
    webhook_secret: str,
    payload: ChannelOrderWebhook,
    db: Session = Depends(get_db),
):
    """
    Called by TheDersi (or any channel) when a buyer places an order.
    The webhook_secret in the URL identifies which shop and authenticates the call.
    ExiusCart:
      1. Creates/finds the customer
      2. Creates the order
      3. Decreases inventory for each item
    """
    conn = db.query(ChannelConnection).filter(
        ChannelConnection.webhook_secret == webhook_secret,
        ChannelConnection.is_active == True,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Invalid webhook URL")

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
    order = Order(
        shop_id=conn.shop_id,
        customer_id=customer.id if customer else None,
        order_number=order_number,
        status="pending",
        payment_status="pending",
        source="online",
        subtotal=payload.subtotal,
        tax_amount=0,
        discount_amount=0,
        total=payload.total,
        notes=f"Channel: {conn.channel_type} | Ref: {payload.channel_order_id}",
        shipping_address=payload.shipping_address,
    )
    db.add(order)
    db.flush()

    # Create order items + decrease stock
    for item in payload.items:
        product = db.query(Product).filter(
            Product.id == item.exiuscart_product_id,
            Product.shop_id == conn.shop_id,
        ).first()
        if not product:
            continue

        db.add(OrderItem(
            order_id=order.id,
            product_id=product.id,
            quantity=item.quantity,
            unit_price=item.unit_price,
            total_price=item.unit_price * item.quantity,
        ))

        # Reduce inventory (never go below 0)
        product.quantity = max(0, product.quantity - item.quantity)

    db.commit()
    return {
        "success": True,
        "exiuscart_order_id": order.id,
        "order_number": order_number,
    }
