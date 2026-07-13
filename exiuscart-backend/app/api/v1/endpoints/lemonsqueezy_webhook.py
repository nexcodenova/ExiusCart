"""
Inbound Lemon Squeezy webhook receiver — confirms real payments for direct
ExiusCart Starter/Premium subscriptions. This is the only event that ever
activates a Lemon Squeezy-billed subscription or generates a recurring
affiliate commission; nothing here is guessed on a timer.
"""
import json
import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.lemonsqueezy import verify_webhook_signature
from app.core.affiliate_commissions import generate_commission_for_payment
from app.models.subscription import Subscription
from app.models.subscription_payment import SubscriptionPayment
from app.models.user import User
from app.models.shop import Shop
from app.core.email import send_dashboard_live_email

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/webhooks/lemonsqueezy")
async def lemonsqueezy_webhook(request: Request, db: Session = Depends(get_db)):
    raw_body = await request.body()
    signature = request.headers.get("X-Signature", "")

    if not verify_webhook_signature(raw_body, signature):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        payload = json.loads(raw_body)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event_name = payload.get("meta", {}).get("event_name", "")
    custom_data = payload.get("meta", {}).get("custom_data", {}) or {}
    resource = payload.get("data", {})
    attrs = resource.get("attributes", {})

    logger.info(f"[LemonSqueezy Webhook] event={event_name}")

    if event_name == "subscription_payment_success":
        _handle_payment_success(db, custom_data, resource, attrs)
    elif event_name in ("subscription_cancelled", "subscription_expired"):
        _handle_subscription_ended(db, resource, event_name)
    elif event_name == "subscription_payment_failed":
        logger.warning(f"[LemonSqueezy] payment failed — subscription_id={attrs.get('subscription_id')}")

    # Always 200 quickly — Lemon Squeezy retries on non-2xx
    return {"received": True}


def _handle_payment_success(db: Session, custom_data: dict, resource: dict, attrs: dict) -> None:
    ls_order_id = str(resource.get("id", ""))
    ls_subscription_id = str(attrs.get("subscription_id", ""))
    amount = float(attrs.get("total", 0)) / 100  # Lemon Squeezy sends amounts in cents
    currency = attrs.get("currency", "USD")

    if not ls_order_id or not ls_subscription_id:
        logger.error("[LemonSqueezy] payment_success event missing order/subscription id")
        return

    # Idempotency — Lemon Squeezy may retry the same webhook
    if db.query(SubscriptionPayment).filter(SubscriptionPayment.lemon_squeezy_order_id == ls_order_id).first():
        logger.info(f"[LemonSqueezy] duplicate webhook for order={ls_order_id}, skipping")
        return

    sub = db.query(Subscription).filter(Subscription.lemon_squeezy_subscription_id == ls_subscription_id).first()

    is_new_subscription = sub is None
    if is_new_subscription:
        shop_id = custom_data.get("shop_id")
        plan_type = custom_data.get("plan_type")
        billing_type = custom_data.get("billing_type", "monthly")
        if not shop_id or not plan_type:
            logger.error(f"[LemonSqueezy] first payment for order={ls_order_id} missing custom_data — cannot create subscription")
            return
        shop = db.query(Shop).filter(Shop.id == int(shop_id)).first()
        if not shop:
            logger.error(f"[LemonSqueezy] shop_id={shop_id} from checkout not found")
            return
        sub = Subscription(
            shop_id=int(shop_id),
            plan_type=plan_type,
            billing_type=billing_type,
            currency=currency,
        )
        db.add(sub)
        db.flush()  # assign sub.id before using it below

    now = datetime.now(timezone.utc)
    sub.status = "active"
    sub.starts_at = sub.starts_at or now
    sub.expires_at = now + timedelta(days=365 if sub.billing_type == "yearly" else 30)
    sub.amount_paid = amount
    sub.currency = currency
    sub.payment_source = "lemon_squeezy"
    sub.lemon_squeezy_subscription_id = ls_subscription_id
    if attrs.get("customer_id"):
        sub.lemon_squeezy_customer_id = str(attrs["customer_id"])

    payment = SubscriptionPayment(
        subscription_id=sub.id,
        shop_id=sub.shop_id,
        amount=amount,
        currency=currency,
        plan_type=sub.plan_type,
        billing_type=sub.billing_type,
        source="lemon_squeezy",
        lemon_squeezy_order_id=ls_order_id,
        lemon_squeezy_subscription_id=ls_subscription_id,
    )
    db.add(payment)
    db.flush()  # assign payment.id before linking a commission to it

    monthly_equivalent = amount / 12 if sub.billing_type == "yearly" else amount
    generate_commission_for_payment(db, sub, monthly_equivalent, payment.id)

    db.commit()
    logger.info(f"[LemonSqueezy] payment confirmed shop={sub.shop_id} plan={sub.plan_type} amount={amount} {currency}")

    if is_new_subscription:
        shop = db.query(Shop).filter(Shop.id == sub.shop_id).first()
        if shop:
            owner = db.query(User).filter(User.id == shop.owner_id).first()
            if owner:
                try:
                    send_dashboard_live_email(owner.email, owner.full_name or "", shop.name or "Your Shop")
                except Exception:
                    pass


def _handle_subscription_ended(db: Session, resource: dict, event_name: str) -> None:
    ls_subscription_id = str(resource.get("id", ""))
    if not ls_subscription_id:
        return
    sub = db.query(Subscription).filter(Subscription.lemon_squeezy_subscription_id == ls_subscription_id).first()
    if not sub:
        return
    sub.status = "cancelled" if event_name == "subscription_cancelled" else "expired"
    db.commit()
    logger.info(f"[LemonSqueezy] subscription {ls_subscription_id} -> {sub.status}")
