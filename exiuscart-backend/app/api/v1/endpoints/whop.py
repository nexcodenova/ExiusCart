"""
Whop integration — a digital-product sales channel, not a physical
marketplace like BigCommerce/WooCommerce. Whop is a Merchant of Record:
Whop is legally the seller, handles global tax/VAT compliance itself, and
the seller only needs a payout destination — no business registration
required on the seller's side. That's the whole reason this channel
exists: it unlocks selling for sellers who can't get a traditional
payment gateway (no BR, Stripe unavailable in their country, etc).

Backend-only by design (matches the decision made when this was scoped) —
no dashboard/connect UI yet. Everything here is reachable only via direct
API calls until a UI is built on top of it.

CONFIRMED live against docs.whop.com this session (not guessed):
  - Auth: `Authorization: Bearer <API_KEY>` — a Company/Account API key,
    server-side only (Whop's own docs explicitly warn never to expose an
    Account API key in browser code).
  - Base URL: https://api.whop.com/api/v1
  - POST /products creates a product — "the top-level container for
    plans and experiences" — company_id, title, description are the
    fields confirmed from Whop's own create-product reference.
  - Webhooks use the open Standard Webhooks spec (standardwebhooks.com),
    NOT Whop's own legacy v2/v5 signature scheme — Whop's docs explicitly
    say not to use the legacy formats for new integrations. Standard
    Webhooks: headers `webhook-id`, `webhook-timestamp`, `webhook-signature`;
    signed content is `{id}.{timestamp}.{body}`; secret is a base64
    string prefixed `whsec_`; HMAC-SHA256, base64-encoded, compared
    against each `v1,<sig>` entry in the (space-separated,
    possibly-multiple) signature header.
  - `payment.succeeded` is the event Whop's own docs name for fulfilling
    an order from checkout.

NOT independently confirmed this session (Whop's plan-creation and
order/payment-listing endpoints didn't return through search the way
products/webhooks did) — flagged inline below rather than silently
assumed. Whop's own docs are the source of truth to check before this
goes live against a real API key.
"""
import base64
import hashlib
import hmac
import logging
import os
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

WHOP_API_BASE = "https://api.whop.com/api/v1"


def _get_whop_connection(shop_id: int, db: Session) -> ChannelConnection:
    conn = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.channel_type == "whop",
        ChannelConnection.is_active == True,
    ).first()
    if not conn or not conn.channel_api_key or not conn.channel_seller_id:
        raise HTTPException(status_code=404, detail="Whop is not connected for this shop yet")
    return conn


def _whop_request(api_key: str, method: str, path: str, **kwargs) -> httpx.Response:
    """The one function every Whop REST call goes through."""
    url = f"{WHOP_API_BASE}{path}"
    try:
        with httpx.Client(timeout=20) as client:
            return client.request(
                method, url,
                headers={"Authorization": f"Bearer {api_key}", "Accept": "application/json", "Content-Type": "application/json"},
                **kwargs,
            )
    except Exception as e:
        logger.error(f"[WHOP] {method} {path} failed: {e}")
        raise HTTPException(status_code=502, detail="Could not reach Whop — check the API key and try again.")


def _whop_request_for_shop(shop_id: int, db: Session, method: str, path: str, **kwargs) -> httpx.Response:
    conn = _get_whop_connection(shop_id, db)
    return _whop_request(conn.channel_api_key, method, path, **kwargs)


# ── Connect / disconnect ─────────────────────────────────────────────────────

class WhopConnectIn(BaseModel):
    api_key: str
    company_id: str
    # Whop generates a signing secret (whsec_...) per webhook endpoint you
    # register in their dashboard — the seller pastes it here so incoming
    # webhooks can be verified. Nullable so connecting doesn't hard-require
    # the webhook step to already be done on Whop's side.
    webhook_signing_secret: Optional[str] = None


@router.post("/shops/{shop_id}/channels/whop/connect")
def connect_whop(
    shop_id: int,
    data: WhopConnectIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Saves the seller's own Whop Company API key, verified with a real
    call before saving — same discipline as every other channel's connect
    endpoint. Gated the same way as BigCommerce: not on TheDersi's
    managed-seller model (Whop is a direct-ExiusCart digital-product
    channel), Starter gets it as their one channel, Premium unlimited."""
    _shop_or_404(shop_id, current_user, db)

    if is_thedersi_shop(shop_id, db):
        raise HTTPException(status_code=403, detail="Whop isn't available on TheDersi plans — TheDersi sellers can use TheDersi and Daraz.")

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
            "message": "Whop is available on Starter (as your one channel) and Premium (all channels). Upgrade to connect Whop.",
        })

    api_key = data.api_key.strip()
    company_id = data.company_id.strip()
    # Lightest real call to confirm the credentials actually work before
    # saving anything — list this company's products, not a write.
    resp = _whop_request(api_key, "GET", "/products", params={"company_id": company_id, "per": 1})
    if resp.status_code == 401:
        raise HTTPException(status_code=400, detail="Whop rejected this API key — check it hasn't been revoked.")
    if resp.status_code >= 300:
        raise HTTPException(status_code=502, detail=f"Could not verify Whop connection: {resp.status_code} {resp.text[:300]}")

    conn = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.channel_type == "whop",
    ).first()
    if not conn:
        import secrets
        conn = ChannelConnection(shop_id=shop_id, channel_type="whop", webhook_secret=secrets.token_urlsafe(24))
        db.add(conn)
    conn.channel_api_key = api_key
    conn.channel_seller_id = company_id
    if data.webhook_signing_secret:
        conn.channel_api_url = data.webhook_signing_secret.strip()  # repurposed field — see module note below
    conn.is_active = True
    db.commit()
    db.refresh(conn)
    return {
        "connected": True,
        "company_id": company_id,
        # This shop's webhook_secret is part of the URL the seller needs
        # to register in their Whop dashboard (Developer -> Webhooks) —
        # returned once here so it's easy to copy during setup.
        "webhook_url": f"/api/v1/channels/webhook/whop/{conn.webhook_secret}",
    }


@router.delete("/shops/{shop_id}/channels/whop/disconnect")
def disconnect_whop(
    shop_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _shop_or_404(shop_id, current_user, db)
    conn = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.channel_type == "whop",
    ).first()
    if conn:
        conn.is_active = False
        db.commit()
    return {"disconnected": True}


# ── Product listing ──────────────────────────────────────────────────────────

def _log_whop_sync(db: Session, shop_id: int, action: str, success: bool, product_id: Optional[int] = None,
                    external_id: Optional[str] = None, error_message: Optional[str] = None) -> None:
    from app.models.channel_sync_log import ChannelSyncLog
    db.add(ChannelSyncLog(
        shop_id=shop_id, product_id=product_id, channel_type="whop", action=action,
        success=success, external_id=external_id, error_message=(error_message or "")[:2000] or None,
    ))
    db.commit()


@router.post("/shops/{shop_id}/channels/whop/products/{product_id}/create")
def create_whop_product(
    shop_id: int,
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lists an existing ExiusCart product on the seller's Whop company as
    a sellable product. Deliberately not restricted to product_type ==
    'digital' at this layer — Whop supports physical/service products too
    — but this channel's whole reason to exist is the digital-product,
    no-business-registration use case, so that's what it's built and
    tested against first.

    NOT independently confirmed this session: whether pricing must be
    created via a separate Plans endpoint or can be attached inline on
    product creation. Whop's own docs describe a product-creation flow
    with an "automatically generated plan" — sent inline here as the
    simplest reading of that; verify field names against a real Whop
    account before relying on this in production."""
    from app.models.product import Product
    from app.models.channel_product_status import ChannelProductStatus

    _shop_or_404(shop_id, current_user, db)
    product = db.query(Product).filter(Product.id == product_id, Product.shop_id == shop_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    conn = _get_whop_connection(shop_id, db)
    image_urls = [img.url for img in (product.images or []) if img.url]
    body = {
        "company_id": conn.channel_seller_id,
        "title": product.name,
        "description": product.description or product.name,
        "external_id": f"exiuscart-{product.id}",  # re-posting updates instead of duplicating, per Whop's own docs
        "visibility": "visible",
        # NOT independently confirmed — see docstring above.
        "initial_price": float(product.price),
        "gallery": [{"url": url} for url in image_urls[:10]],
    }
    resp = _whop_request(conn.channel_api_key, "POST", "/products", json=body)
    if resp.status_code >= 300:
        error_detail = resp.text[:500]
        _log_whop_sync(db, shop_id, "create_listing", False, product_id=product_id, error_message=error_detail)
        raise HTTPException(status_code=502, detail=f"Whop rejected the product: {error_detail}")

    data = resp.json()
    external_id = str(data.get("id") or data.get("data", {}).get("id"))
    checkout_url = data.get("checkout_url") or data.get("data", {}).get("checkout_url")

    existing = db.query(ChannelProductStatus).filter(
        ChannelProductStatus.product_id == product_id,
        ChannelProductStatus.channel_type == "whop",
    ).first()
    if existing:
        existing.status = "approved"  # Whop products are live immediately, no marketplace review step
        existing.external_item_id = external_id
    else:
        db.add(ChannelProductStatus(product_id=product_id, shop_id=shop_id, channel_type="whop", status="approved", external_item_id=external_id))
    db.commit()
    _log_whop_sync(db, shop_id, "create_listing", True, product_id=product_id, external_id=external_id)
    return {"message": "Listed on Whop.", "external_id": external_id, "checkout_url": checkout_url}


@router.get("/shops/{shop_id}/channels/whop/products/{product_id}/listing")
def get_whop_listing_status(
    shop_id: int,
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.channel_product_status import ChannelProductStatus
    _shop_or_404(shop_id, current_user, db)
    status = db.query(ChannelProductStatus).filter(
        ChannelProductStatus.product_id == product_id,
        ChannelProductStatus.channel_type == "whop",
    ).first()
    if not status:
        return {"listed": False}
    return {"listed": True, "status": status.status, "external_id": status.external_item_id}


# ── Webhook — payment.succeeded ──────────────────────────────────────────────

def _verify_whop_webhook_signature(secret: str, webhook_id: str, webhook_timestamp: str,
                                    webhook_signature: str, body: bytes) -> bool:
    """Standard Webhooks verification (standardwebhooks.com) — the open
    spec Whop's own docs say to use for new integrations, not their
    legacy per-vendor scheme. `secret` is the whsec_... string Whop shows
    once when a webhook endpoint is registered."""
    if not secret or not webhook_id or not webhook_timestamp or not webhook_signature:
        return False
    try:
        secret_bytes = base64.b64decode(secret.split("_", 1)[1] if secret.startswith("whsec_") else secret)
        signed_content = f"{webhook_id}.{webhook_timestamp}.{body.decode('utf-8')}"
        expected = base64.b64encode(
            hmac.new(secret_bytes, signed_content.encode("utf-8"), hashlib.sha256).digest()
        ).decode("utf-8")
        # webhook-signature can carry multiple space-separated "v1,<sig>" entries
        for entry in webhook_signature.split():
            _, _, sig = entry.partition(",")
            if hmac.compare_digest(sig, expected):
                return True
        return False
    except Exception as e:
        logger.error(f"[WHOP WEBHOOK] signature verification error: {e}")
        return False


@router.post("/channels/webhook/whop/{webhook_secret}")
async def whop_webhook(
    webhook_secret: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """Receives Whop's payment.succeeded event, creates a paid Order, and
    reuses the exact same digital-delivery hook every other paid-order
    path in this codebase already calls — no separate delivery mechanism
    invented for this channel."""
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
        ChannelConnection.channel_type == "whop",
        ChannelConnection.is_active == True,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Invalid webhook URL")

    # channel_api_url repurposed to hold the Whop webhook signing secret
    # for this connection (see connect_whop) — only verify if one was
    # actually provided at connect time, same "verify if configured,
    # never silently skip in a way that looks verified" discipline as
    # TheDersi's own webhook (verify_thedersi_signature).
    if conn.channel_api_url:
        ok = _verify_whop_webhook_signature(
            conn.channel_api_url,
            request.headers.get("webhook-id", ""),
            request.headers.get("webhook-timestamp", ""),
            request.headers.get("webhook-signature", ""),
            body,
        )
        if not ok:
            raise HTTPException(status_code=401, detail="Invalid webhook signature")

    import json
    try:
        payload = json.loads(body)
    except Exception as e:
        logger.error(f"[WHOP WEBHOOK] payload parse failed: {e} | body={body[:500]}")
        raise HTTPException(status_code=422, detail="Invalid webhook payload")

    event = payload.get("action") or payload.get("type") or payload.get("event")
    if event != "payment.succeeded":
        # Ack anything else (membership.activated etc.) without acting on it —
        # avoids Whop retrying an event this endpoint deliberately ignores.
        return {"received": True, "ignored_event": event}

    data = payload.get("data") or {}
    whop_payment_id = str(data.get("id") or "")
    if not whop_payment_id:
        raise HTTPException(status_code=422, detail="payment.succeeded event missing payment id")

    # Idempotency — Whop can retry a webhook delivery; never double-create
    # the same order, same discipline as TheDersi's channel_order_id dedupe.
    existing_meta = db.query(ChannelOrderMeta).filter(
        ChannelOrderMeta.channel_type == "whop",
        ChannelOrderMeta.channel_order_id == whop_payment_id,
    ).first()
    if existing_meta:
        return {"received": True, "duplicate": True, "order_id": existing_meta.order_id}

    # NOT independently confirmed this session: exact field names Whop's
    # payment.succeeded payload uses for buyer email / product external_id
    # / amount — these are the most plausible names given the product
    # fields confirmed above; verify against a real payload before relying
    # on this in production, same flag as create_whop_product's pricing.
    buyer_email = (data.get("user", {}).get("email") or data.get("email") or "").strip().lower()
    external_product_id = str(data.get("product_id") or data.get("product", {}).get("id") or "")
    amount = float(data.get("final_amount") or data.get("amount") or 0)

    if not buyer_email or "@" not in buyer_email:
        logger.warning(f"[WHOP WEBHOOK] payment={whop_payment_id} has no usable buyer email — cannot fulfill")
        raise HTTPException(status_code=422, detail="Webhook payload missing buyer email")

    status = db.query(ChannelProductStatus).filter(
        ChannelProductStatus.channel_type == "whop",
        ChannelProductStatus.external_item_id == external_product_id,
        ChannelProductStatus.shop_id == conn.shop_id,
    ).first()
    product = db.query(Product).filter(Product.id == status.product_id).first() if status else None
    if not product:
        logger.warning(f"[WHOP WEBHOOK] payment={whop_payment_id} — no ExiusCart product matches Whop product {external_product_id!r}")
        raise HTTPException(status_code=422, detail="No matching product for this Whop payment")

    customer = db.query(Customer).filter(
        Customer.shop_id == conn.shop_id, func.lower(Customer.email) == buyer_email,
    ).first()
    if not customer:
        customer = Customer(shop_id=conn.shop_id, name=data.get("user", {}).get("name") or "Whop Customer", email=buyer_email, source="whop")
        db.add(customer)
        db.flush()

    order = Order(
        order_number=f"WHOP-{whop_payment_id[:12]}-{str(_uuid.uuid4())[:4].upper()}",
        source="channel", customer_id=customer.id,
        subtotal=amount, total=amount,
        status="completed", payment_status="paid",
        shop_id=conn.shop_id, notes=f"Whop Payment #{whop_payment_id}",
    )
    db.add(order)
    db.flush()
    db.add(OrderItem(
        order_id=order.id, product_id=product.id, product_name=product.name,
        quantity=1, unit_price=amount, total_price=amount,
    ))
    db.add(ChannelOrderMeta(order_id=order.id, channel_type="whop", channel_order_id=whop_payment_id))
    conn.last_synced_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(order)

    create_digital_deliveries_for_order(order, db)

    return {"received": True, "order_id": order.id}
