"""
Affiliate commission generation — the single call site for creating a Commission
row, used by both the Lemon Squeezy webhook and the manual admin subscription
approval path. A commission can only ever be created alongside a real confirmed
payment (SubscriptionPayment row) — never from a blind timer or guess.
"""
import logging
from typing import Optional
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.shop import Shop
from app.models.subscription import Subscription
from app.models.affiliate import Affiliate, Commission

logger = logging.getLogger(__name__)

ONE_TIME_COMMISSION_AMOUNT = 75.0
RECURRING_COMMISSION_RATE = 0.5
RECURRING_COMMISSION_CAP = 12


def generate_commission_for_payment(
    db: Session,
    subscription: Subscription,
    payment_amount: float,
    subscription_payment_id: Optional[int] = None,
) -> None:
    """
    Called every time a payment is confirmed for a subscription (Lemon Squeezy
    webhook or manual admin approval). Creates the affiliate commission owed for
    that specific payment, based on the referring affiliate's locked-in model:
      one_time  — flat $75, once ever per shop+affiliate
      recurring — 50% of this payment, capped at 12 payments per shop+affiliate
    No-op if the shop wasn't referred by an active affiliate.
    `subscription_payment_id` links the commission to the exact payment record
    that earned it, for full traceability in the admin panel.
    """
    if not subscription.shop_id:
        return

    shop = db.query(Shop).filter(Shop.id == subscription.shop_id).first()
    if not shop:
        return

    shop_owner = db.query(User).filter(User.id == shop.owner_id).first()
    if not shop_owner or not shop_owner.referred_by_code:
        return

    affiliate = db.query(Affiliate).filter(
        Affiliate.referral_code == shop_owner.referred_by_code,
        Affiliate.status == "active",
    ).first()
    if not affiliate:
        return

    if affiliate.commission_model == "recurring":
        existing_count = db.query(Commission).filter(
            Commission.affiliate_id == affiliate.id,
            Commission.shop_id == subscription.shop_id,
            Commission.commission_type == "recurring",
        ).count()
        if existing_count >= RECURRING_COMMISSION_CAP:
            return
        commission_amount = round(payment_amount * RECURRING_COMMISSION_RATE, 2)
        if commission_amount <= 0:
            return
        db.add(Commission(
            affiliate_id=affiliate.id,
            shop_id=subscription.shop_id,
            subscription_id=subscription.id,
            subscription_payment_id=subscription_payment_id,
            amount=commission_amount,
            currency="USD",
            status="pending",
            commission_type="recurring",
            period_month=existing_count + 1,
        ))
        logger.info(f"[Affiliate] recurring commission #{existing_count + 1} for affiliate={affiliate.id} shop={shop.id}")
    else:
        already = db.query(Commission).filter(
            Commission.affiliate_id == affiliate.id,
            Commission.shop_id == subscription.shop_id,
            Commission.commission_type == "one_time",
        ).first()
        if already:
            return
        db.add(Commission(
            affiliate_id=affiliate.id,
            shop_id=subscription.shop_id,
            subscription_id=subscription.id,
            subscription_payment_id=subscription_payment_id,
            amount=ONE_TIME_COMMISSION_AMOUNT,
            currency="USD",
            status="pending",
            commission_type="one_time",
        ))
        logger.info(f"[Affiliate] one-time commission for affiliate={affiliate.id} shop={shop.id}")
