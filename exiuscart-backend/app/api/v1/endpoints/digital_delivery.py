"""
Digital product delivery — one file per product, delivered via an
access-code-gated link instead of a license-key pool or a download-center
dashboard (explicitly scoped down from that on request). See
DigitalDelivery's own docstring (app/models/digital_delivery.py) and
upload_digital_file's (app/core/storage.py) for the actual security
model — a gate page + unguessable file key, not real DRM.
"""
import os
import time
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.email import send_digital_product_email
from app.models.order import Order, OrderItem
from app.models.product import Product
from app.models.shop import Shop
from app.models.digital_delivery import DigitalDelivery

logger = logging.getLogger(__name__)
router = APIRouter()

EXIUSCART_WEBSITE_BASE = os.getenv("EXIUSCART_WEBSITE_BASE", "https://exiuscart.com")
DELIVERY_EXPIRY_DAYS = 30  # gate stops honoring the code after this — see DigitalDelivery.expires_at


def create_digital_deliveries_for_order(order: Order, db: Session) -> None:
    """Called once an order is marked paid (same hook point physical stock
    already decrements at — checkout.py's _mark_order_paid_or_failed, and
    orders.py's equivalent for POS/manual orders). Idempotent: safe to call
    more than once for the same order, matching those same callers' own
    idempotency guarantee — won't create a second delivery or send a
    second email for an item that already has one."""
    items = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()
    for item in items:
        if not item.product_id:
            continue
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if not product or product.product_type != "digital" or not product.digital_file_url:
            continue

        existing = db.query(DigitalDelivery).filter(DigitalDelivery.order_item_id == item.id).first()
        if existing:
            continue

        customer_email = order.customer.email if order.customer else None
        customer_name = order.customer.name if order.customer else None
        if not customer_email:
            logger.warning(f"[Digital Delivery] order={order.id} item={item.id} has no customer email — cannot deliver")
            continue

        delivery = DigitalDelivery(
            shop_id=order.shop_id,
            order_id=order.id,
            order_item_id=item.id,
            product_id=product.id,
            delivered_to_email=customer_email,
            expires_at=datetime.now(timezone.utc) + timedelta(days=DELIVERY_EXPIRY_DAYS),
        )
        db.add(delivery)
        db.flush()  # get delivery.download_token's default applied

        download_page_url = f"{EXIUSCART_WEBSITE_BASE.rstrip('/')}/download/{delivery.download_token}"
        try:
            send_digital_product_email(
                customer_email, customer_name, order.shop.name if order.shop else "the store",
                product.name, download_page_url, delivery.access_code,
                custom_subject=product.digital_email_subject,
                custom_message=product.digital_email_message,
            )
        except Exception as exc:
            logger.error(f"[Digital Delivery] order={order.id} item={item.id} email send failed: {exc}")

    db.commit()


# ── Public — download gate ────────────────────────────────────────────────────

# Simple in-memory attempt cap against code-guessing — module-level, resets
# on deploy, same lightweight philosophy as the rate cache in
# app/core/currency.py. {token: [timestamp, ...]}
_verify_attempts: dict[str, list[float]] = {}
MAX_ATTEMPTS_PER_HOUR = 10


def _too_many_attempts(token: str) -> bool:
    now = time.time()
    attempts = [t for t in _verify_attempts.get(token, []) if now - t < 3600]
    _verify_attempts[token] = attempts
    return len(attempts) >= MAX_ATTEMPTS_PER_HOUR


@router.get("/public/download/{token}")
def get_download_info(token: str, db: Session = Depends(get_db)):
    """No-auth — the gate page's first call, before the buyer has entered
    a code. Only ever reveals the product/shop name, never the file."""
    delivery = db.query(DigitalDelivery).filter(DigitalDelivery.download_token == token).first()
    if not delivery:
        raise HTTPException(status_code=404, detail="This download link doesn't exist.")
    if delivery.expires_at and delivery.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="This download link has expired.")

    product = db.query(Product).filter(Product.id == delivery.product_id).first()
    shop = db.query(Shop).filter(Shop.id == delivery.shop_id).first()
    return {
        "product_name": product.name if product else "Your purchase",
        "shop_name": shop.name if shop else "",
    }


class VerifyCodeIn(BaseModel):
    code: str


@router.post("/public/download/{token}/verify")
def verify_download_code(token: str, data: VerifyCodeIn, db: Session = Depends(get_db)):
    """No-auth — checks the access code and, only on a match, returns the
    real file link. Rate-limited per token so the 8-character code can't
    just be brute-forced from here."""
    if _too_many_attempts(token):
        raise HTTPException(status_code=429, detail="Too many attempts — try again in an hour.")
    _verify_attempts.setdefault(token, []).append(time.time())

    delivery = db.query(DigitalDelivery).filter(DigitalDelivery.download_token == token).first()
    if not delivery:
        raise HTTPException(status_code=404, detail="This download link doesn't exist.")
    if delivery.expires_at and delivery.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="This download link has expired.")

    submitted = (data.code or "").strip().upper().replace("-", "").replace(" ", "")
    real = (delivery.access_code or "").strip().upper()
    if submitted != real:
        raise HTTPException(status_code=400, detail="That code doesn't match. Check the email and try again.")

    product = db.query(Product).filter(Product.id == delivery.product_id).first()
    if not product or not product.digital_file_url:
        raise HTTPException(status_code=404, detail="This file is no longer available — contact the seller.")

    delivery.view_count = (delivery.view_count or 0) + 1
    delivery.last_accessed_at = datetime.now(timezone.utc)
    db.commit()

    return {"file_url": product.digital_file_url, "file_name": product.digital_file_name or product.name}
