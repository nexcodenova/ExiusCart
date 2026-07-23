"""
Inbound Lemon Squeezy webhook receiver — confirms real payments for direct
ExiusCart Starter/Premium subscriptions. This is the only event that ever
activates a Lemon Squeezy-billed subscription or generates a recurring
affiliate commission; nothing here is guessed on a timer.
"""
import re
import uuid
import json
import secrets
import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_password_hash
from app.core.lemonsqueezy import verify_webhook_signature
from app.core.affiliate_commissions import generate_commission_for_payment
from app.models.subscription import Subscription
from app.models.subscription_payment import SubscriptionPayment
from app.models.affiliate import Affiliate, Commission
from app.models.user import User
from app.models.shop import Shop
from app.core.email import send_dashboard_live_email, send_welcome_email, send_password_setup_email, send_new_signup_notification

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
        if custom_data.get("new_signup") == "true":
            _handle_new_signup_payment(db, custom_data, resource, attrs)
        else:
            _handle_payment_success(db, custom_data, resource, attrs)
    elif event_name in ("subscription_cancelled", "subscription_expired"):
        _handle_subscription_ended(db, resource, event_name)
    elif event_name == "subscription_payment_failed":
        logger.warning(f"[LemonSqueezy] payment failed — subscription_id={attrs.get('subscription_id')}")
    elif event_name == "subscription_payment_refunded":
        _handle_payment_refunded(db, resource)

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
                    send_dashboard_live_email(
                        owner.email, owner.full_name or "", shop.name or "Your Shop",
                        is_trial=False, plan_label=sub.plan_type.replace("_", " ").title(),
                    )
                except Exception:
                    pass


def _slugify(text: str) -> str:
    return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')


def _handle_new_signup_payment(db: Session, custom_data: dict, resource: dict, attrs: dict) -> None:
    """
    Pre-signup checkout — no ExiusCart account existed at checkout time (marketing
    site "pay first" flow). The completed payment is treated as proof of a real,
    deliverable email; auto-create User+Shop+Subscription here. Mirrors the
    free-trial signup flow exactly: status=pending_approval, blocked from login
    until an admin reviews it — commission generation happens at approval time
    (app/api/v1/endpoints/admin.py::approve_subscription), not here, so it's never
    duplicated if this webhook were to retry.
    """
    ls_order_id = str(resource.get("id", ""))
    ls_subscription_id = str(attrs.get("subscription_id", ""))
    amount = float(attrs.get("total", 0)) / 100
    currency = attrs.get("currency", "USD")
    email = attrs.get("user_email", "")
    buyer_name = attrs.get("user_name") or custom_data.get("business_name") or "Shop Owner"
    business_name = custom_data.get("business_name") or f"{buyer_name}'s Shop"
    plan_type = custom_data.get("plan_type")
    billing_type = custom_data.get("billing_type", "monthly")

    if not ls_order_id or not ls_subscription_id or not email or not plan_type:
        logger.error(f"[LemonSqueezy] new_signup payment missing required data — order={ls_order_id} email={bool(email)} plan={plan_type}")
        return

    # Idempotency — Lemon Squeezy may retry the same webhook
    if db.query(SubscriptionPayment).filter(SubscriptionPayment.lemon_squeezy_order_id == ls_order_id).first():
        logger.info(f"[LemonSqueezy] duplicate new_signup webhook for order={ls_order_id}, skipping")
        return

    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        logger.error(f"[LemonSqueezy] new_signup payment for email={email} but a User already exists (id={existing_user.id}) — needs manual reconciliation, refusing to auto-link to avoid hijacking an unrelated account")
        return

    now = datetime.now(timezone.utc)
    user = User(
        email=email,
        hashed_password=get_password_hash(secrets.token_hex(32)),  # unusable placeholder — real password set via the setup link
        full_name=buyer_name,
        is_verified=True,  # a completed payment is proof enough of a deliverable email
    )
    db.add(user)
    db.flush()

    shop = Shop(
        name=business_name,
        slug=f"{_slugify(business_name)}-{uuid.uuid4().hex[:6]}",
        owner_id=user.id,
        currency=currency if currency in ("AED", "USD", "LKR") else "AED",
    )
    db.add(shop)
    db.flush()

    sub = Subscription(
        shop_id=shop.id,
        plan_type=plan_type,
        billing_type=billing_type,
        status="pending_approval",
        amount_paid=amount,
        currency=currency,
        payment_source="lemon_squeezy",
        lemon_squeezy_subscription_id=ls_subscription_id,
        starts_at=now,
    )
    if attrs.get("customer_id"):
        sub.lemon_squeezy_customer_id = str(attrs["customer_id"])
    db.add(sub)
    db.flush()

    payment = SubscriptionPayment(
        subscription_id=sub.id,
        shop_id=shop.id,
        amount=amount,
        currency=currency,
        plan_type=plan_type,
        billing_type=billing_type,
        source="lemon_squeezy",
        lemon_squeezy_order_id=ls_order_id,
        lemon_squeezy_subscription_id=ls_subscription_id,
    )
    db.add(payment)
    db.commit()

    logger.info(f"[LemonSqueezy] new signup shop={shop.id} user={user.id} plan={plan_type} amount={amount} {currency} — pending admin approval")

    from app.api.v1.endpoints.partner import _make_setup_link
    setup_url = _make_setup_link(user.id, user.email)
    plan_label = plan_type.title()

    try:
        send_password_setup_email(user.email, user.full_name or "", setup_url)
        send_welcome_email(user.email, user.full_name or "", f"{plan_label} (Payment Received — Pending Approval)")
        send_new_signup_notification(user.full_name or "", user.email, shop.name, f"{plan_label} (Paid)")
    except Exception as e:
        logger.error(f"[LemonSqueezy] new_signup confirmation emails failed for shop={shop.id}: {e}")


ONE_TIME_COMMISSION_REVERSAL_WINDOW_DAYS = 45


def _handle_subscription_ended(db: Session, resource: dict, event_name: str) -> None:
    ls_subscription_id = str(resource.get("id", ""))
    if not ls_subscription_id:
        return
    sub = db.query(Subscription).filter(Subscription.lemon_squeezy_subscription_id == ls_subscription_id).first()
    if not sub:
        return
    sub.status = "cancelled" if event_name == "subscription_cancelled" else "expired"

    # A referral who churns almost immediately shouldn't leave the affiliate
    # holding a flat $75 for it — but one who stuck around a while was a
    # real, earned referral, so past this window it's final either way.
    # Recurring commissions need no equivalent here: they already stop
    # naturally since a new one is only ever created alongside a real new
    # payment, never guessed on a timer.
    shop = db.query(Shop).filter(Shop.id == sub.shop_id).first()
    owner = db.query(User).filter(User.id == shop.owner_id).first() if shop else None
    if owner and owner.referred_by_code:
        affiliate = db.query(Affiliate).filter(
            Affiliate.referral_code == owner.referred_by_code,
        ).first()
        if affiliate and affiliate.commission_model == "one_time":
            commission = db.query(Commission).filter(
                Commission.affiliate_id == affiliate.id,
                Commission.shop_id == sub.shop_id,
                Commission.commission_type == "one_time",
            ).first()
            if commission and commission.status not in ("reversed", "paid"):
                age_days = (datetime.now(timezone.utc) - commission.created_at).days
                if age_days < ONE_TIME_COMMISSION_REVERSAL_WINDOW_DAYS:
                    commission.status = "reversed"
                    logger.info(f"[LemonSqueezy] shop={sub.shop_id} cancelled at {age_days}d — reversed one-time commission id={commission.id}")
                else:
                    logger.info(f"[LemonSqueezy] shop={sub.shop_id} cancelled at {age_days}d — past {ONE_TIME_COMMISSION_REVERSAL_WINDOW_DAYS}d window, commission id={commission.id} kept")

    db.commit()
    logger.info(f"[LemonSqueezy] subscription {ls_subscription_id} -> {sub.status}")


def _handle_payment_refunded(db: Session, resource: dict) -> None:
    """
    Fires when a payment is refunded via Lemon Squeezy (refunds are issued by
    us, the seller, through Lemon Squeezy's own dashboard — there's no
    self-service refund button for the payer). Marks the payment refunded and
    reverses its affiliate commission if one hasn't been paid out yet already.
    Deliberately does NOT touch the subscription's own status — a refund on a
    past payment doesn't necessarily mean the subscription itself is currently
    cancelled; if Lemon Squeezy also cancels it, that arrives separately as its
    own subscription_cancelled event, already handled above.
    """
    ls_order_id = str(resource.get("id", ""))
    if not ls_order_id:
        logger.error("[LemonSqueezy] refund event missing order id")
        return

    payment = db.query(SubscriptionPayment).filter(
        SubscriptionPayment.lemon_squeezy_order_id == ls_order_id
    ).first()
    if not payment:
        logger.error(f"[LemonSqueezy] refund for order={ls_order_id} but no matching payment on file — needs manual reconciliation")
        return

    if payment.refunded_at:
        logger.info(f"[LemonSqueezy] duplicate refund webhook for order={ls_order_id}, skipping")
        return

    payment.refunded_at = datetime.now(timezone.utc)

    commission = db.query(Commission).filter(
        Commission.subscription_payment_id == payment.id
    ).first()
    if commission:
        if commission.status == "paid":
            logger.warning(f"[LemonSqueezy] refund for order={ls_order_id} — linked commission id={commission.id} was ALREADY PAID OUT, needs manual clawback per affiliate terms, not auto-deducted")
        else:
            commission.status = "reversed"
            logger.info(f"[LemonSqueezy] refund for order={ls_order_id} — reversed commission id={commission.id}")

    db.commit()
    logger.info(f"[LemonSqueezy] payment refunded — order={ls_order_id} shop={payment.shop_id}")
