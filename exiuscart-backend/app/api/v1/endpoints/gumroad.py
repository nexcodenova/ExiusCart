"""
Gumroad integration — deliberately NOT the same shape as whop.py's
create/push flow. Gumroad's own API docs (checked live this session,
dated 2026-03-03) explicitly say product creation via API "is not
currently supported" and 404s if called — sellers must create the
product on Gumroad's own dashboard first. So this channel is
connect + manually LINK an existing Gumroad product to an ExiusCart
product, then order-sync + digital delivery via Gumroad's Ping webhook —
never an auto-create-and-push flow. Don't "fix" that by adding a
create-product endpoint later without first re-checking Gumroad's docs;
it was a deliberate, confirmed limitation, not an oversight.

CONFIRMED live against Gumroad's own docs/help articles this session:
  - Auth: `Authorization: Bearer <ACCESS_TOKEN>` — a personal access
    token generated in the seller's own Gumroad account settings.
  - Base URL: https://api.gumroad.com/v2
  - Webhooks are called "Ping" — ONE account-wide URL registered in
    Settings -> Advanced -> Ping endpoint (not per-product, not an API
    call to register — unlike Whop, there's nothing to POST to create
    it). Fires on sale/refund/subscription events.
  - Ping payload is `application/x-www-form-urlencoded`, NOT JSON —
    fields include sale_id, order_number, seller_id, product_id,
    product_permalink, product_name, email, full_name, price (an
    integer, USD **cents**), test (bool string, present when the seller
    is buying their own product to test the Ping).
  - Signature: `X-Gumroad-Signature` header, HMAC-SHA256 of the raw
    request body.

NOT independently confirmed this session: which exact secret Gumroad
signs with (their docs describe it generically as "your Gumroad secret
key" without naming a specific dashboard field the way Whop names
`whsec_...`). Treated the same as Whop/TheDersi's own webhooks: only
verify if the seller has actually provided a secret; never silently
treat an unconfigured signature as verified.
"""
import hashlib
import hmac
import logging
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.thedersi import is_thedersi_shop
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.channel import ChannelConnection
from app.api.v1.endpoints.channels import _shop_or_404

logger = logging.getLogger(__name__)
router = APIRouter()

GUMROAD_API_BASE = "https://api.gumroad.com/v2"


def _get_gumroad_connection(shop_id: int, db: Session) -> ChannelConnection:
    conn = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.channel_type == "gumroad",
        ChannelConnection.is_active == True,
    ).first()
    if not conn or not conn.channel_api_key:
        raise HTTPException(status_code=404, detail="Gumroad is not connected for this shop yet")
    return conn


def _gumroad_request(access_token: str, method: str, path: str, **kwargs) -> httpx.Response:
    url = f"{GUMROAD_API_BASE}{path}"
    try:
        with httpx.Client(timeout=20) as client:
            return client.request(
                method, url,
                headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
                **kwargs,
            )
    except Exception as e:
        logger.error(f"[GUMROAD] {method} {path} failed: {e}")
        raise HTTPException(status_code=502, detail="Could not reach Gumroad — check the access token and try again.")


# ── Connect / disconnect ─────────────────────────────────────────────────────

class GumroadConnectIn(BaseModel):
    access_token: str
    webhook_signing_secret: Optional[str] = None


@router.post("/shops/{shop_id}/channels/gumroad/connect")
def connect_gumroad(
    shop_id: int,
    data: GumroadConnectIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Saves the seller's own Gumroad access token, verified with a real
    (read-only) call before saving. Gated identically to Whop/BigCommerce:
    not on TheDersi's managed-seller model, Starter's one-channel slot,
    Premium unlimited."""
    _shop_or_404(shop_id, current_user, db)

    if is_thedersi_shop(shop_id, db):
        raise HTTPException(status_code=403, detail="Gumroad isn't available on TheDersi plans — TheDersi sellers can use TheDersi and Daraz.")

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
            "message": "Gumroad is available on Starter (as your one channel) and Premium (all channels). Upgrade to connect Gumroad.",
        })

    access_token = data.access_token.strip()
    resp = _gumroad_request(access_token, "GET", "/products")
    if resp.status_code == 401:
        raise HTTPException(status_code=400, detail="Gumroad rejected this access token — check it hasn't been revoked.")
    if resp.status_code >= 300:
        raise HTTPException(status_code=502, detail=f"Could not verify Gumroad connection: {resp.status_code} {resp.text[:300]}")

    conn = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.channel_type == "gumroad",
    ).first()
    if not conn:
        import secrets
        conn = ChannelConnection(shop_id=shop_id, channel_type="gumroad", webhook_secret=secrets.token_urlsafe(24))
        db.add(conn)
    conn.channel_api_key = access_token
    if data.webhook_signing_secret:
        conn.channel_api_url = data.webhook_signing_secret.strip()  # repurposed field, see whop.py's same pattern
    conn.is_active = True
    db.commit()
    db.refresh(conn)
    return {
        "connected": True,
        # One account-wide Ping URL — paste into Gumroad Settings ->
        # Advanced -> Ping endpoint, not per-product.
        "ping_url": f"/api/v1/channels/webhook/gumroad/{conn.webhook_secret}",
    }


@router.delete("/shops/{shop_id}/channels/gumroad/disconnect")
def disconnect_gumroad(
    shop_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _shop_or_404(shop_id, current_user, db)
    conn = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.channel_type == "gumroad",
    ).first()
    if conn:
        conn.is_active = False
        db.commit()
    return {"disconnected": True}


# ── Manual link — NOT a create/push, see module docstring ───────────────────

def _log_gumroad_sync(db: Session, shop_id: int, action: str, success: bool, product_id: Optional[int] = None,
                       external_id: Optional[str] = None, error_message: Optional[str] = None) -> None:
    from app.models.channel_sync_log import ChannelSyncLog
    db.add(ChannelSyncLog(
        shop_id=shop_id, product_id=product_id, channel_type="gumroad", action=action,
        success=success, external_id=external_id, error_message=(error_message or "")[:2000] or None,
    ))
    db.commit()


class GumroadLinkIn(BaseModel):
    # Gumroad's own product id OR permalink — whichever the seller has
    # handy from their Gumroad dashboard URL. Matched against both fields
    # on incoming Ping webhooks (see gumroad_webhook below).
    gumroad_product_id: str


@router.post("/shops/{shop_id}/channels/gumroad/products/{product_id}/link")
def link_gumroad_product(
    shop_id: int,
    product_id: int,
    data: GumroadLinkIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Links an ExiusCart product to a Gumroad product the seller already
    created on Gumroad's own dashboard — not a create/push, see module
    docstring for why. Orders start syncing the moment the seller's
    Ping endpoint is registered and pointed at this shop's webhook URL."""
    from app.models.product import Product
    from app.models.channel_product_status import ChannelProductStatus

    _shop_or_404(shop_id, current_user, db)
    product = db.query(Product).filter(Product.id == product_id, Product.shop_id == shop_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    _get_gumroad_connection(shop_id, db)  # 404s cleanly if not connected yet

    gumroad_id = data.gumroad_product_id.strip()
    existing = db.query(ChannelProductStatus).filter(
        ChannelProductStatus.product_id == product_id,
        ChannelProductStatus.channel_type == "gumroad",
    ).first()
    if existing:
        existing.status = "approved"
        existing.external_item_id = gumroad_id
    else:
        db.add(ChannelProductStatus(product_id=product_id, shop_id=shop_id, channel_type="gumroad", status="approved", external_item_id=gumroad_id))
    db.commit()
    _log_gumroad_sync(db, shop_id, "link_product", True, product_id=product_id, external_id=gumroad_id)
    return {"message": "Linked to your existing Gumroad product. Orders will sync once your Ping endpoint is registered.", "external_id": gumroad_id}


@router.get("/shops/{shop_id}/channels/gumroad/products/{product_id}/listing")
def get_gumroad_listing_status(
    shop_id: int,
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.channel_product_status import ChannelProductStatus
    _shop_or_404(shop_id, current_user, db)
    status = db.query(ChannelProductStatus).filter(
        ChannelProductStatus.product_id == product_id,
        ChannelProductStatus.channel_type == "gumroad",
    ).first()
    if not status:
        return {"listed": False}
    return {"listed": True, "status": status.status, "external_id": status.external_item_id}


# ── Webhook — Gumroad "Ping" (sale event) ────────────────────────────────────

def _verify_gumroad_signature(secret: str, signature: str, body: bytes) -> bool:
    if not secret or not signature:
        return False
    try:
        expected = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(signature, expected)
    except Exception as e:
        logger.error(f"[GUMROAD WEBHOOK] signature verification error: {e}")
        return False


@router.post("/channels/webhook/gumroad/{webhook_secret}")
async def gumroad_webhook(
    webhook_secret: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """Receives Gumroad's Ping (form-urlencoded, not JSON — see module
    docstring), creates a paid Order for the linked ExiusCart product, and
    reuses the same digital-delivery hook every other paid-order path in
    this codebase already calls."""
    from datetime import datetime, timezone
    import uuid as _uuid
    from app.models.order import Order, OrderItem
    from app.models.customer import Customer
    from app.models.channel_order_meta import ChannelOrderMeta
    from app.models.channel_product_status import ChannelProductStatus
    from app.models.product import Product
    from app.api.v1.endpoints.digital_delivery import create_digital_deliveries_for_order

    body = await request.body()
    conn = db.query(ChannelConnection).filter(
        ChannelConnection.webhook_secret == webhook_secret,
        ChannelConnection.channel_type == "gumroad",
        ChannelConnection.is_active == True,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Invalid webhook URL")

    if conn.channel_api_url:  # repurposed field holding the signing secret, see connect_gumroad
        ok = _verify_gumroad_signature(conn.channel_api_url, request.headers.get("x-gumroad-signature", ""), body)
        if not ok:
            raise HTTPException(status_code=401, detail="Invalid webhook signature")

    form = await request.form()
    data = {k: v for k, v in form.items()}

    if data.get("test") in ("true", "1", True):
        # Gumroad's own "Send test ping" button — ack without creating
        # an order, matching how a real test event should behave.
        return {"received": True, "test": True}

    sale_id = str(data.get("sale_id") or "")
    if not sale_id:
        raise HTTPException(status_code=422, detail="Ping payload missing sale_id")

    existing_meta = db.query(ChannelOrderMeta).filter(
        ChannelOrderMeta.channel_type == "gumroad",
        ChannelOrderMeta.channel_order_id == sale_id,
    ).first()
    if existing_meta:
        return {"received": True, "duplicate": True, "order_id": existing_meta.order_id}

    buyer_email = (data.get("email") or "").strip().lower()
    gumroad_product_id = str(data.get("product_id") or "")
    gumroad_permalink = str(data.get("product_permalink") or "")
    amount = float(int(data.get("price") or 0)) / 100  # Gumroad sends USD cents

    if not buyer_email or "@" not in buyer_email:
        logger.warning(f"[GUMROAD WEBHOOK] sale={sale_id} has no usable buyer email — cannot fulfill")
        raise HTTPException(status_code=422, detail="Ping payload missing buyer email")

    status = db.query(ChannelProductStatus).filter(
        ChannelProductStatus.channel_type == "gumroad",
        ChannelProductStatus.shop_id == conn.shop_id,
        ChannelProductStatus.external_item_id.in_([v for v in (gumroad_product_id, gumroad_permalink) if v]),
    ).first()
    product = db.query(Product).filter(Product.id == status.product_id).first() if status else None
    if not product:
        logger.warning(f"[GUMROAD WEBHOOK] sale={sale_id} — no ExiusCart product linked to Gumroad product {gumroad_product_id!r}/{gumroad_permalink!r}")
        raise HTTPException(status_code=422, detail="No ExiusCart product is linked to this Gumroad product yet")

    customer = db.query(Customer).filter(
        Customer.shop_id == conn.shop_id, func.lower(Customer.email) == buyer_email,
    ).first()
    if not customer:
        customer = Customer(shop_id=conn.shop_id, name=data.get("full_name") or "Gumroad Customer", email=buyer_email, source="gumroad")
        db.add(customer)
        db.flush()

    order = Order(
        order_number=f"GUM-{sale_id[:12]}-{str(_uuid.uuid4())[:4].upper()}",
        source="channel", customer_id=customer.id,
        subtotal=amount, total=amount,
        status="completed", payment_status="paid",
        shop_id=conn.shop_id, notes=f"Gumroad Sale #{sale_id}",
    )
    db.add(order)
    db.flush()
    db.add(OrderItem(
        order_id=order.id, product_id=product.id, product_name=product.name,
        quantity=1, unit_price=amount, total_price=amount,
    ))
    db.add(ChannelOrderMeta(order_id=order.id, channel_type="gumroad", channel_order_id=sale_id))
    conn.last_synced_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(order)

    create_digital_deliveries_for_order(order, db)

    return {"received": True, "order_id": order.id}
