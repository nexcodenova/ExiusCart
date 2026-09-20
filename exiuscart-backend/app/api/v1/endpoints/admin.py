"""
Super-admin endpoints — all routes require is_superuser.
"""
import logging
import re
import secrets
import httpx
from types import SimpleNamespace
from urllib.parse import urlencode
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, UploadFile, status, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from pydantic import BaseModel

from app.core.database import get_db, SessionLocal
from app.api.v1.deps import get_current_user
from app.core.encryption import encrypt
from app.models.dropship import DropshipConnection, DropshipProductLink
from app.api.v1.endpoints.dropshipping import _cj_get_token, _cj_ensure_token, _parse_cj_price, CJ_BASE
from app.api.v1.endpoints.product_fields import _DESCRIPTION_WORD_LIMITS

# The Prodora catalogue keeps descriptions up to the LARGEST plan limit (Scale),
# not the smallest. Each seller's import is then trimmed to their own plan's
# limit (see import_shopping_product in shopping.py), so a Scale seller gets the
# full text and a Launch seller never ends up over their limit.
DESCRIPTION_WORDS_DEFAULT = max(_DESCRIPTION_WORD_LIMITS.values())
from app.core.email import (
    send_dashboard_live_email,
    send_affiliate_pending_email,
    send_affiliate_approved_email,
)
from app.core.security import create_access_token
from app.core.currency import convert_amount_sync
from app.core.affiliate_commissions import generate_commission_for_payment
from app.models.user import User
from app.models.shop import Shop
from app.models.subscription import Subscription
from app.models.subscription_payment import SubscriptionPayment
from app.models.lead import Lead
from app.models.affiliate import Affiliate, Commission
from app.models.product import Product, Category
from app.models.order import Order
from app.models.partner import PartnerLicense
from app.models.admin_settings import AdminSettings

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Guard ─────────────────────────────────────────────────────────────────────

def require_superuser(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Superuser access required")
    return current_user


# ── Money helpers ─────────────────────────────────────────────────────────────
# A subscription can be charged in different currencies (Lemon Squeezy bills in
# the buyer's own currency, e.g. AED). Every admin total is shown in USD, so
# each amount is converted first — adding raw numbers would count 998.99 AED as
# 998.99 USD.

_AED_PER_USD = 3.6725  # AED is pegged to the dollar, so this is a safe fallback


def _to_usd(amount, currency) -> float:
    amount = float(amount or 0)
    cur = (currency or "USD").upper()
    if cur == "USD" or amount == 0:
        return amount
    converted = convert_amount_sync(amount, cur, "USD")
    if converted == amount and cur == "AED":  # rate service unavailable
        return round(amount / _AED_PER_USD, 2)
    return converted


def _usd_total(rows) -> float:
    """rows: (currency, amount) pairs, already summed per currency."""
    return round(sum(_to_usd(amount, cur) for cur, amount in rows), 2)


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class LeadCreate(BaseModel):
    name: str
    shop_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None
    business_type: Optional[str] = None
    notes: Optional[str] = None
    status: str = "new"
    source: str = "manual"

class LeadUpdate(BaseModel):
    name: Optional[str] = None
    shop_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None
    business_type: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    source: Optional[str] = None

class LeadOut(BaseModel):
    id: int
    name: str
    shop_name: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    city: Optional[str]
    business_type: Optional[str]
    notes: Optional[str]
    status: str
    source: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Admin Stats ───────────────────────────────────────────────────────────────

@router.get("/admin/stats")
def get_admin_stats(
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    # Internal shops (blog + catalogue) are not customers.
    total_shops = db.query(func.count(Shop.id)).filter(Shop.slug.notin_(SYSTEM_SHOP_SLUGS)).scalar() or 0
    active_shops = db.query(func.count(Shop.id)).filter(Shop.is_active == True, Shop.slug.notin_(SYSTEM_SHOP_SLUGS)).scalar() or 0
    total_users = db.query(func.count(User.id)).filter(User.is_superuser == False).scalar() or 0

    # Revenue: sum of amount_paid from approved/active subscriptions
    total_revenue = _usd_total(
        db.query(Subscription.currency, func.sum(Subscription.amount_paid))
        .filter(Subscription.status == "active")
        .group_by(Subscription.currency).all()
    )

    # Pending approvals: only subscriptions actually waiting for an admin. A
    # running trial starts on its own and is not pending anything.
    pending_count = db.query(func.count(Subscription.id)).join(Shop, Subscription.shop_id == Shop.id).filter(
        Subscription.status == "pending_approval", Shop.slug.notin_(SYSTEM_SHOP_SLUGS),
    ).scalar() or 0

    # Expiring soon (within 7 days)
    now = datetime.now(timezone.utc)
    seven_days = now + timedelta(days=7)
    expiring_count = db.query(func.count(Subscription.id)).filter(
        Subscription.status == "active",
        Subscription.expires_at != None,
        Subscription.expires_at <= seven_days,
        Subscription.expires_at >= now,
    ).scalar() or 0

    return {
        "total_shops": total_shops,
        "active_shops": active_shops,
        "total_users": total_users,
        "monthly_revenue": float(total_revenue),
        "pending_payments": pending_count,
        "expiring_soon": expiring_count,
    }


# ── Shops ─────────────────────────────────────────────────────────────────────

@router.get("/admin/shops")
def list_shops(
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    query = db.query(Shop).options(
        joinedload(Shop.owner),
        joinedload(Shop.subscription),
    ).filter(Shop.slug.notin_(SYSTEM_SHOP_SLUGS))
    if search:
        q = f"%{search}%"
        query = query.join(User, Shop.owner_id == User.id).filter(
            (Shop.name.ilike(q)) | (User.email.ilike(q)) | (User.full_name.ilike(q))
        )
    if status_filter == "active":
        query = query.filter(Shop.is_active == True)
    elif status_filter == "suspended":
        query = query.filter(Shop.is_active == False)

    shops = query.order_by(Shop.created_at.desc()).all()

    result = []
    for shop in shops:
        sub = shop.subscription
        product_count = db.query(func.count(Product.id)).filter(Product.shop_id == shop.id).scalar() or 0
        order_count = db.query(func.count(Order.id)).filter(Order.shop_id == shop.id).scalar() or 0
        result.append({
            "id": shop.id,
            "name": shop.name,
            "email": shop.email or shop.owner.email,
            "phone": shop.phone or "",
            "owner": shop.owner.full_name,
            "owner_email": shop.owner.email,
            "is_active": shop.is_active,
            "created_at": shop.created_at.isoformat() if shop.created_at else None,
            "subscription_id": sub.id if sub else None,
            "plan": sub.plan_type if sub else "none",
            "subscription_status": sub.status if sub else "none",
            "billing_type": sub.billing_type if sub else None,
            "starts_at": sub.starts_at.isoformat() if sub and sub.starts_at else None,
            "expires_at": sub.expires_at.isoformat() if sub and sub.expires_at else None,
            "product_count": product_count,
            "order_count": order_count,
        })
    return result


@router.put("/admin/shops/{shop_id}/status")
def toggle_shop_status(
    shop_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    shop = db.query(Shop).filter(Shop.id == shop_id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    shop.is_active = not shop.is_active
    db.commit()
    return {"id": shop.id, "is_active": shop.is_active}


class ChangePlanIn(BaseModel):
    plan_type: str
    billing_type: str = "monthly"


@router.put("/admin/shops/{shop_id}/plan")
def change_shop_plan(
    shop_id: int,
    data: ChangePlanIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    shop = db.query(Shop).filter(Shop.id == shop_id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    now = datetime.now(timezone.utc)
    sub = db.query(Subscription).filter(Subscription.shop_id == shop_id).order_by(Subscription.id.desc()).first()
    if sub:
        sub.plan_type = data.plan_type
        sub.billing_type = data.billing_type
        sub.status = "active"
        sub.starts_at = now
        sub.expires_at = now + timedelta(days=365 if data.billing_type == "yearly" else 30)
    else:
        sub = Subscription(
            shop_id=shop_id,
            plan_type=data.plan_type,
            billing_type=data.billing_type,
            status="active",
            amount_paid=0,
            currency="USD",
            starts_at=now,
            expires_at=now + timedelta(days=30),
        )
        db.add(sub)
    db.commit()
    return {"message": "Plan updated", "plan_type": data.plan_type}


@router.delete("/admin/shops/{shop_id}")
def delete_shop(
    shop_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    shop = db.query(Shop).filter(Shop.id == shop_id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    shop.is_active = False
    sub = db.query(Subscription).filter(Subscription.shop_id == shop_id).first()
    if sub:
        sub.status = "cancelled"
    db.commit()
    return {"message": "Store deactivated"}


# ── Users ─────────────────────────────────────────────────────────────────────

@router.get("/admin/users")
def list_users(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    query = db.query(User).filter(User.is_superuser == False).options(joinedload(User.shops))
    if search:
        q = f"%{search}%"
        query = query.filter(
            (User.full_name.ilike(q)) | (User.email.ilike(q))
        )
    users = query.order_by(User.created_at.desc()).all()

    result = []
    for user in users:
        shop = user.shops[0] if user.shops else None
        sub = db.query(Subscription).filter(Subscription.shop_id == shop.id).order_by(Subscription.created_at.desc()).first() if shop else None
        source = "thedersi" if (sub and sub.promo_code == "partner_thedersi") else "exiuscart"
        result.append({
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "phone": user.phone or "",
            "is_active": user.is_active,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "store_name": shop.name if shop else None,
            "store_id": shop.id if shop else None,
            "plan_type": sub.plan_type if sub else None,
            "plan_status": sub.status if sub else None,
            "source": source,
            "referred_by_code": user.referred_by_code or None,
        })
    return result


@router.put("/admin/users/{user_id}/status")
def toggle_user_status(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    user = db.query(User).filter(User.id == user_id, User.is_superuser == False).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = not user.is_active
    db.commit()
    return {"id": user.id, "is_active": user.is_active}


# ── Subscriptions / Payments ──────────────────────────────────────────────────

@router.get("/admin/subscriptions")
def list_subscriptions(
    status_filter: Optional[str] = None,
    plan_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    query = db.query(Subscription).options(joinedload(Subscription.shop))
    if status_filter:
        query = query.filter(Subscription.status == status_filter)
    if plan_filter:
        query = query.filter(Subscription.plan_type == plan_filter)

    subs = query.order_by(Subscription.created_at.desc()).all()

    now = datetime.now(timezone.utc)
    seven_days = now + timedelta(days=7)

    result = []
    for sub in subs:
        # Compute derived status
        derived_status = sub.status
        if sub.status == "active" and sub.expires_at and sub.expires_at <= seven_days:
            derived_status = "expiring"

        result.append({
            "id": sub.id,
            "shop_id": sub.shop_id,
            "shop_name": sub.shop.name if sub.shop else "Unknown",
            "plan_type": sub.plan_type,
            "billing_type": sub.billing_type,
            "status": derived_status,
            "amount_paid": float(sub.amount_paid) if sub.amount_paid else 0,
            "amount_usd": _to_usd(sub.amount_paid, sub.currency),
            "currency": sub.currency,
            "payment_source": sub.payment_source or "manual",
            "card_billing": bool(
                sub.lemon_squeezy_subscription_id and sub.payment_source == "lemon_squeezy"
                and sub.status in ("active", "trial_dollar")
            ),
            "starts_at": sub.starts_at.isoformat() if sub.starts_at else None,
            "expires_at": sub.expires_at.isoformat() if sub.expires_at else None,
            "trial_ends_at": sub.trial_ends_at.isoformat() if sub.trial_ends_at else None,
            "created_at": sub.created_at.isoformat() if sub.created_at else None,
        })
    return result


@router.get("/admin/subscription-payments")
def list_subscription_payments(
    shop_id: Optional[int] = None,
    source_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    """
    Full payment ledger — every confirmed payment, real (Lemon Squeezy) or
    manual (admin-approved), with the exact affiliate commission it generated
    (if any). This is the single source of truth admins can point to for
    'did we actually get paid, and what did that cost us in commission'.
    """
    query = db.query(SubscriptionPayment).options(joinedload(SubscriptionPayment.shop))
    if shop_id:
        query = query.filter(SubscriptionPayment.shop_id == shop_id)
    if source_filter:
        query = query.filter(SubscriptionPayment.source == source_filter)

    payments = query.order_by(SubscriptionPayment.created_at.desc()).limit(500).all()
    payment_ids = [p.id for p in payments]
    commissions_by_payment = {}
    if payment_ids:
        for c in db.query(Commission).options(joinedload(Commission.affiliate)).filter(
            Commission.subscription_payment_id.in_(payment_ids)
        ).all():
            commissions_by_payment[c.subscription_payment_id] = c

    result = []
    for p in payments:
        commission = commissions_by_payment.get(p.id)
        result.append({
            "id": p.id,
            "shop_id": p.shop_id,
            "shop_name": p.shop.name if p.shop else "Unknown",
            "plan_type": p.plan_type,
            "billing_type": p.billing_type,
            "amount": float(p.amount),
            "currency": p.currency,
            "source": p.source,
            "lemon_squeezy_order_id": p.lemon_squeezy_order_id,
            "confirmed_at": p.confirmed_at.isoformat() if p.confirmed_at else None,
            "refunded_at": p.refunded_at.isoformat() if p.refunded_at else None,
            "commission": {
                "affiliate_name": commission.affiliate.name if commission and commission.affiliate else None,
                "amount": float(commission.amount) if commission else None,
                "type": commission.commission_type if commission else None,
                "period_month": commission.period_month if commission else None,
                "status": commission.status if commission else None,
            } if commission else None,
        })
    return result


@router.put("/admin/subscription-payments/{payment_id}/refund")
def refund_subscription_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_superuser),
):
    """
    Marks a payment refunded, blocks the shop owner's account, and reverses
    the affiliate commission it generated (if any) — unconditionally, no
    45-day grace period like the cancellation path has, since money was
    actually returned here.

    The refund itself still has to be issued on Lemon Squeezy's own
    dashboard first (their API doesn't support triggering one) — this
    button is ExiusCart's side of the bookkeeping once that's done.
    """
    payment = db.query(SubscriptionPayment).filter(SubscriptionPayment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    if payment.refunded_at:
        raise HTTPException(status_code=400, detail="This payment is already marked refunded")

    payment.refunded_at = datetime.now(timezone.utc)

    shop = db.query(Shop).filter(Shop.id == payment.shop_id).first()
    if shop:
        owner = db.query(User).filter(User.id == shop.owner_id).first()
        if owner:
            owner.is_active = False
            owner.deactivation_reason = "refunded"

    commission = db.query(Commission).filter(Commission.subscription_payment_id == payment.id).first()
    if commission and commission.status != "reversed":
        commission.status = "reversed"

    db.commit()
    logger.info(f"[Admin Refund] payment={payment_id} shop={payment.shop_id} refunded by admin={admin.id}, account blocked")
    return {
        "refunded": True,
        "payment_id": payment.id,
        "account_blocked": bool(shop),
        "commission_reversed": bool(commission and commission.status == "reversed"),
    }


@router.put("/admin/subscriptions/{sub_id}/approve")
def approve_subscription(
    sub_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    sub = db.query(Subscription).options(joinedload(Subscription.shop)).filter(
        Subscription.id == sub_id
    ).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    now = datetime.now(timezone.utc)
    sub.starts_at = now

    if sub.plan_type == "free_trial":
        # Generic organic-signup free trial (no specific plan chosen): start
        # the same 7-day countdown every other trial gets.
        from app.core.lemonsqueezy import TRIAL_FREE_DAYS
        sub.status = "trial"
        sub.trial_ends_at = now + timedelta(days=TRIAL_FREE_DAYS)
        sub.expires_at = now + timedelta(days=TRIAL_FREE_DAYS)
    elif sub.trial_dollar_ends_at:
        # A $1 trial checkout (Growth/Scale's "Try for $1") already paid at
        # checkout time — trial_dollar_ends_at was already set then (always
        # 7 days). Approval just unblocks login; it doesn't restart the
        # countdown or charge again. The $1->full-price move at day 7 is
        # handled separately by app/core/subscription_lifecycle.py, not here.
        sub.status = "trial_dollar"
        sub.expires_at = sub.trial_dollar_ends_at
    elif sub.trial_ends_at:
        # Pricing-page "Try for free" signup (Launch only — Growth/Scale
        # have no free week) — no payment yet, trial_ends_at was set at
        # signup. Approval starts the real 7-day countdown (unblocks it now).
        sub.status = "trial"
        sub.expires_at = sub.trial_ends_at
    else:
        # Paid plan approval (e.g. bank transfer, full price): activate immediately
        sub.status = "active"
        if sub.billing_type == "monthly":
            sub.expires_at = now + timedelta(days=30)
        elif sub.billing_type == "yearly":
            sub.expires_at = now + timedelta(days=365)
        else:
            sub.expires_at = None  # Lifetime / one-time

    # ── Record the payment + generate affiliate commission ─────────────────────
    # Manual admin approval = an offline payment (e.g. bank transfer) the admin is
    # personally vouching for. It gets logged in the same SubscriptionPayment
    # ledger as real Lemon Squeezy charges, so affiliate commissions are always
    # backed by a real payment record — never a blind guess.
    #
    # Exception: pre-signup Lemon Squeezy checkouts (lemonsqueezy_webhook.py ::
    # _handle_new_signup_payment) already recorded the real payment before this
    # subscription ever reached pending_approval — reuse that row instead of
    # logging a second, duplicate "manual" payment for money that was already
    # charged online. Also skip entirely for a free trial (status == "trial",
    # whether the legacy generic free_trial or a real-plan 7-day trial) — no
    # money changed hands yet, so there's nothing real to log or commission.
    if sub.shop and sub.status not in ("trial",):
        existing_payment = db.query(SubscriptionPayment).filter(
            SubscriptionPayment.subscription_id == sub.id
        ).order_by(SubscriptionPayment.id.desc()).first()

        if existing_payment:
            payment_id = existing_payment.id
            payment_amount = float(existing_payment.amount or 0)
        else:
            payment_amount = float(sub.amount_paid or 0)
            payment = SubscriptionPayment(
                subscription_id=sub.id,
                shop_id=sub.shop_id,
                amount=payment_amount,
                currency=sub.currency or "AED",
                plan_type=sub.plan_type,
                billing_type=sub.billing_type,
                source="manual",
            )
            db.add(payment)
            db.flush()  # assign payment.id before linking a commission to it
            payment_id = payment.id

        # Normalize to a monthly-equivalent value for recurring commission math
        monthly_equivalent = payment_amount / 12 if sub.billing_type == "yearly" else payment_amount
        generate_commission_for_payment(db, sub, monthly_equivalent, payment_id)

    db.commit()

    # Send "dashboard is live" email to shop owner
    if sub.shop:
        owner = db.query(User).filter(User.id == sub.shop.owner_id).first()
        if owner:
            from concurrent.futures import ThreadPoolExecutor
            _pool = ThreadPoolExecutor(max_workers=1)
            _pool.submit(
                send_dashboard_live_email,
                owner.email,
                owner.full_name or "",
                sub.shop.name or "Your Shop",
                "https://store.exiuscart.com/login",
                sub.plan_type == "free_trial",
                sub.plan_type.replace("_", " ").title(),
            )

    return {"message": "Subscription approved", "id": sub_id}


def expire_overdue_subscriptions() -> None:
    """
    Called daily by the background scheduler in main.py.
    Flips any paid subscription past its expires_at to 'expired' if no renewal
    payment has come in. Recurring affiliate commissions stop naturally once a
    subscription is no longer 'active', since commissions are only ever created
    alongside a real SubscriptionPayment row — never guessed on a timer.

    Includes 'cancelled' subscriptions, not just 'active' ones — a customer
    who explicitly cancels correctly keeps access until their already-paid
    period ends (handled elsewhere), but nothing was ever cutting that
    access off once that date actually passed. Left them with permanent
    free access after cancelling. This job is what finally closes that.
    """
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        overdue = db.query(Subscription).filter(
            Subscription.status.in_(["active", "cancelled"]),
            Subscription.expires_at.isnot(None),
            Subscription.expires_at < now,
        ).all()
        for sub in overdue:
            sub.status = "expired"
            logger.info(f"[Subscription Expiry] shop={sub.shop_id} subscription={sub.id} auto-expired")
        if overdue:
            db.commit()
    except Exception as e:
        logger.error(f"[Subscription Expiry] job error: {e}")
    finally:
        db.close()


@router.put("/admin/subscriptions/{sub_id}/reject")
def reject_subscription(
    sub_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    sub = db.query(Subscription).filter(Subscription.id == sub_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    sub.status = "cancelled"
    db.commit()
    return {"message": "Subscription rejected", "id": sub_id}


class UpdateSubscriptionIn(BaseModel):
    plan_type: str
    billing_type: str
    status: str
    amount_paid: float = 0.0
    currency: str = "USD"
    expires_at: Optional[str] = None  # ISO date string or null for lifetime
    # Also stop the card subscription at Lemon Squeezy. Without this an admin
    # edit is a database change only and the card keeps being billed.
    cancel_card_billing: bool = False


@router.patch("/admin/subscriptions/{sub_id}")
def update_subscription(
    sub_id: int,
    body: UpdateSubscriptionIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    """
    Admin manually sets a subscription to any plan (launch/growth/scale/
    thedersi_*/free_trial — any string), any status, any amount, any expiry
    — a direct database write only. Never calls Lemon Squeezy, never charges
    a card; safe to use for comps, manual grants, corrections, or overriding
    a stuck trial regardless of what payment_source the row has.
    """
    sub = db.query(Subscription).filter(Subscription.id == sub_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")

    now = datetime.now(timezone.utc)
    live_statuses = ("active", "trial", "trial_dollar")

    # Stop the card first: if Lemon Squeezy refuses, nothing else is saved.
    card_billing = "none"
    on_card = bool(sub.lemon_squeezy_subscription_id) and sub.payment_source == "lemon_squeezy"
    if body.cancel_card_billing and on_card:
        from app.core.lemonsqueezy import cancel_subscription_sync
        try:
            cancel_subscription_sync(sub.lemon_squeezy_subscription_id)
        except RuntimeError as e:
            raise HTTPException(status_code=502, detail=f"{e} Nothing was changed.")
        # From here the account is managed by hand, so the cancellation event
        # coming back from Lemon Squeezy must not overwrite this edit.
        sub.payment_source = "manual"
        card_billing = "cancelled"
    elif on_card:
        card_billing = "still_active"

    sub.plan_type = body.plan_type
    sub.billing_type = body.billing_type
    sub.status = body.status
    sub.amount_paid = body.amount_paid
    sub.currency = body.currency

    provided = None
    if body.expires_at:
        try:
            # Accept "YYYY-MM-DD" or full ISO string
            provided = datetime.strptime(body.expires_at[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except Exception:
            provided = None
    # The edit form pre-fills the OLD expiry date. A live status with a date that
    # has already passed would expire the account again on the next request, so
    # such a date is ignored and a fresh one is worked out below.
    if provided is not None and body.status in live_statuses and provided <= now:
        provided = None

    if provided is not None:
        sub.expires_at = provided
    elif body.status == "active":
        if body.billing_type == "monthly":
            sub.expires_at = now + timedelta(days=30)
        elif body.billing_type == "yearly":
            sub.expires_at = now + timedelta(days=365)
        else:
            sub.expires_at = None  # Lifetime
    elif body.status in ("trial", "trial_dollar"):
        from app.core.lemonsqueezy import TRIAL_FREE_DAYS, TRIAL_DOLLAR_DAYS
        days = TRIAL_FREE_DAYS if body.status == "trial" else TRIAL_DOLLAR_DAYS
        sub.expires_at = now + timedelta(days=days)
    else:
        sub.expires_at = None

    # Keep the trial clocks in step with the status so nothing else acts on a stale one.
    if body.status == "trial":
        sub.trial_ends_at = sub.expires_at
    elif body.status == "trial_dollar":
        sub.trial_dollar_ends_at = sub.expires_at
    elif body.status == "active":
        # A manual grant must never be picked up by the $1 -> full price job.
        sub.trial_dollar_ends_at = None

    if body.status in ("active", "trial") and not sub.starts_at:
        sub.starts_at = now

    db.commit()
    return {"message": "Subscription updated", "id": sub_id, "card_billing": card_billing}


# ── Dashboard quick panels ────────────────────────────────────────────────────

@router.get("/admin/pending-subscriptions")
def pending_subscriptions(
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    """Accounts awaiting manual admin approval. A running trial is not pending."""
    subs = db.query(Subscription).join(Shop, Subscription.shop_id == Shop.id).options(joinedload(Subscription.shop)).filter(
        Subscription.status == "pending_approval", Shop.slug.notin_(SYSTEM_SHOP_SLUGS),
    ).order_by(Subscription.created_at.desc()).limit(50).all()

    return [
        {
            "id": sub.id,
            "shop_name": sub.shop.name if sub.shop else "Unknown",
            "plan_type": sub.plan_type,
            "amount_paid": float(sub.amount_paid) if sub.amount_paid else 0,
            "amount_usd": _to_usd(sub.amount_paid, sub.currency),
            "currency": sub.currency,
            "created_at": sub.created_at.isoformat() if sub.created_at else None,
        }
        for sub in subs
    ]


@router.get("/admin/expiring-subscriptions")
def expiring_subscriptions(
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    """Active subscriptions expiring in the next 7 days."""
    now = datetime.now(timezone.utc)
    seven_days = now + timedelta(days=7)
    subs = db.query(Subscription).options(joinedload(Subscription.shop)).filter(
        Subscription.status == "active",
        Subscription.expires_at != None,
        Subscription.expires_at <= seven_days,
        Subscription.expires_at >= now,
    ).order_by(Subscription.expires_at).limit(10).all()

    return [
        {
            "id": sub.id,
            "shop_name": sub.shop.name if sub.shop else "Unknown",
            "plan_type": sub.plan_type,
            "billing_type": sub.billing_type,
            "expires_at": sub.expires_at.isoformat() if sub.expires_at else None,
            "days_left": max(0, (sub.expires_at - now).days) if sub.expires_at else 0,
        }
        for sub in subs
    ]


@router.get("/admin/recent-shops")
def recent_shops(
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    """Last 10 registered shops for the dashboard."""
    shops = db.query(Shop).options(
        joinedload(Shop.owner),
        joinedload(Shop.subscription),
    ).order_by(Shop.created_at.desc()).limit(10).all()

    return [
        {
            "id": shop.id,
            "name": shop.name,
            "owner": shop.owner.full_name,
            "plan": shop.subscription.plan_type if shop.subscription else "none",
            "subscription_status": shop.subscription.status if shop.subscription else "none",
            "is_active": shop.is_active,
            "created_at": shop.created_at.isoformat() if shop.created_at else None,
        }
        for shop in shops
    ]


# ── Leads ─────────────────────────────────────────────────────────────────────

@router.get("/admin/leads", response_model=List[LeadOut])
def list_leads(
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    query = db.query(Lead)
    if search:
        q = f"%{search}%"
        query = query.filter(
            (Lead.name.ilike(q)) | (Lead.shop_name.ilike(q)) |
            (Lead.phone.ilike(q)) | (Lead.email.ilike(q))
        )
    if status_filter:
        query = query.filter(Lead.status == status_filter)
    return query.order_by(Lead.created_at.desc()).all()


@router.post("/admin/leads", response_model=LeadOut, status_code=201)
def create_lead(
    data: LeadCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    lead = Lead(**data.model_dump())
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead


@router.put("/admin/leads/{lead_id}", response_model=LeadOut)
def update_lead(
    lead_id: int,
    data: LeadUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(lead, key, val)
    db.commit()
    db.refresh(lead)
    return lead


@router.delete("/admin/leads/{lead_id}", status_code=204)
def delete_lead(
    lead_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    db.delete(lead)
    db.commit()


# ── Reports ───────────────────────────────────────────────────────────────────

@router.get("/admin/reports")
def get_admin_reports(
    date_range: Optional[str] = "last_30_days",
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    now = datetime.now(timezone.utc)

    # Determine start date based on range
    range_map = {
        "last_7_days": timedelta(days=7),
        "last_30_days": timedelta(days=30),
        "last_90_days": timedelta(days=90),
        "this_year": timedelta(days=365),
    }
    delta = range_map.get(date_range or "last_30_days", timedelta(days=30))
    start_date = now - delta

    # Monthly revenue: group active subscriptions by month of created_at
    monthly_rows = (
        db.query(
            func.date_trunc("month", Subscription.created_at).label("month"),
            Subscription.currency,
            func.sum(Subscription.amount_paid).label("total"),
        )
        .filter(
            Subscription.status == "active",
            Subscription.created_at >= start_date,
        )
        .group_by(func.date_trunc("month", Subscription.created_at), Subscription.currency)
        .order_by(func.date_trunc("month", Subscription.created_at))
        .all()
    )
    monthly_usd: dict = {}  # month -> USD total, in month order
    for row in monthly_rows:
        monthly_usd[row.month] = monthly_usd.get(row.month, 0.0) + _to_usd(row.total, row.currency)
    monthly_revenue = [
        {
            "month": month.strftime("%b") if month else "",
            "value": round(value, 2),
        }
        for month, value in monthly_usd.items()
    ]

    # Top shops: by number of active subscriptions (proxy for revenue activity)
    top_shop_rows = (
        db.query(
            Shop,
            Subscription.currency,
            func.coalesce(func.sum(Subscription.amount_paid), 0).label("revenue"),
        )
        .join(Subscription, Subscription.shop_id == Shop.id, isouter=True)
        .filter(Shop.is_active == True)
        .group_by(Shop.id, Subscription.currency)
        .all()
    )
    shop_usd: dict = {}  # shop id -> [shop, USD total]
    for shop, currency, revenue in top_shop_rows:
        entry = shop_usd.setdefault(shop.id, [shop, 0.0])
        entry[1] += _to_usd(revenue, currency)
    top_shops = [
        {"name": shop.name, "revenue": round(value, 2)}
        for shop, value in sorted(shop_usd.values(), key=lambda e: e[1], reverse=True)[:10]
    ]

    # Plan distribution
    plan_rows = (
        db.query(
            Subscription.plan_type,
            func.count(Subscription.id).label("count"),
        )
        .filter(Subscription.status == "active")
        .group_by(Subscription.plan_type)
        .all()
    )
    total_subs = sum(row.count for row in plan_rows) or 1
    plan_distribution = [
        {
            "plan": row.plan_type or "Unknown",
            "count": row.count,
            "percentage": round((row.count / total_subs) * 100),
        }
        for row in plan_rows
    ]

    # Quick stats for the selected range
    new_shops = db.query(func.count(Shop.id)).filter(Shop.created_at >= start_date).scalar() or 0
    new_users = (
        db.query(func.count(User.id))
        .filter(User.is_superuser == False, User.created_at >= start_date)
        .scalar() or 0
    )
    payments_count = (
        db.query(func.count(Subscription.id))
        .filter(Subscription.status == "active", Subscription.created_at >= start_date)
        .scalar() or 0
    )
    total_active_shops = db.query(func.count(Shop.id)).filter(Shop.is_active == True).scalar() or 1
    total_revenue = _usd_total(
        db.query(Subscription.currency, func.sum(Subscription.amount_paid))
        .filter(Subscription.status == "active")
        .group_by(Subscription.currency).all()
    )
    avg_revenue_per_shop = float(total_revenue) / total_active_shops

    return {
        "monthly_revenue": monthly_revenue,
        "top_shops": top_shops,
        "plan_distribution": plan_distribution,
        "quick_stats": {
            "new_shops": new_shops,
            "new_users": new_users,
            "payments_count": payments_count,
            "avg_revenue_per_shop": round(avg_revenue_per_shop, 2),
            "total_revenue": float(total_revenue),
        },
    }


# ── Affiliates ────────────────────────────────────────────────────────────────

def _affiliate_out(affiliate: Affiliate, db: Session) -> dict:
    total_earned = db.query(func.sum(Commission.amount)).filter(
        Commission.affiliate_id == affiliate.id,
        Commission.status == "paid",
    ).scalar() or 0
    pending_amount = db.query(func.sum(Commission.amount)).filter(
        Commission.affiliate_id == affiliate.id,
        Commission.status == "pending",
    ).scalar() or 0
    referral_count = db.query(func.count(User.id)).filter(
        User.referred_by_code == affiliate.referral_code
    ).scalar() or 0
    return {
        "id": affiliate.id,
        "name": affiliate.name,
        "email": affiliate.email,
        "phone": affiliate.phone,
        "company": affiliate.company,
        "website": affiliate.website,
        "how_promote": affiliate.how_promote,
        "referral_code": affiliate.referral_code,
        "referral_link": f"https://exiuscart.com/register?ref={affiliate.referral_code}",
        "affiliate_type": affiliate.affiliate_type,
        "status": affiliate.status,
        "commission_model": affiliate.commission_model or "one_time",
        "total_earned": float(total_earned),
        "pending_amount": float(pending_amount),
        "referral_count": referral_count,
        "notes": affiliate.notes,
        "payout_method": affiliate.payout_method or "",
        "paypal_email": affiliate.paypal_email or "",
        "skrill_email": affiliate.skrill_email or "",
        "payoneer_id": affiliate.payoneer_id or "",
        "created_at": affiliate.created_at,
        "approved_at": affiliate.approved_at,
    }


@router.get("/admin/affiliates")
def list_affiliates(
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    query = db.query(Affiliate)
    if search:
        q = f"%{search}%"
        query = query.filter(
            (Affiliate.name.ilike(q)) | (Affiliate.email.ilike(q)) | (Affiliate.referral_code.ilike(q))
        )
    if status_filter:
        query = query.filter(Affiliate.status == status_filter)
    affiliates = query.order_by(Affiliate.created_at.desc()).all()
    return [_affiliate_out(a, db) for a in affiliates]


@router.get("/admin/affiliates/{affiliate_id}")
def get_affiliate(
    affiliate_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    affiliate = db.query(Affiliate).filter(Affiliate.id == affiliate_id).first()
    if not affiliate:
        raise HTTPException(status_code=404, detail="Affiliate not found")
    result = _affiliate_out(affiliate, db)
    # Include commission history
    commissions = db.query(Commission).options(
        joinedload(Commission.shop)
    ).filter(Commission.affiliate_id == affiliate_id).order_by(Commission.created_at.desc()).all()
    result["commissions"] = [
        {
            "id": c.id,
            "shop_id": c.shop_id,
            "shop_name": c.shop.name if c.shop else "",
            "amount": float(c.amount),
            "currency": c.currency,
            "status": c.status,
            "commission_type": c.commission_type or "one_time",
            "period_month": c.period_month,
            "paid_at": c.paid_at,
            "created_at": c.created_at,
        }
        for c in commissions
    ]

    # ── Referral breakdown — every signup this affiliate referred, not just the
    # ones that have already earned a commission. A trial/$1-trial referral has
    # zero Commission rows (by design — see affiliate_commissions.py), so building
    # this list from `commissions` alone made every pending signup invisible here.
    # Same shape as GET /affiliates/me/referrals, which gets this right already.
    commissions_by_shop: dict = {}
    for c in commissions:
        commissions_by_shop.setdefault(c.shop_id, []).append(c)

    referred_users = db.query(User).filter(
        User.referred_by_code == affiliate.referral_code
    ).order_by(User.created_at.desc()).all()

    referral_breakdown = []
    for user in referred_users:
        shop = db.query(Shop).filter(Shop.owner_id == user.id).first()
        sub = None
        if shop:
            sub = db.query(Subscription).filter(
                Subscription.shop_id == shop.id
            ).order_by(Subscription.id.desc()).first()

        shop_commissions = commissions_by_shop.get(shop.id, []) if shop else []
        commission_type = shop_commissions[0].commission_type if shop_commissions else (affiliate.commission_model or "one_time")
        months_paid = len([c for c in shop_commissions if c.commission_type == "recurring"])

        referral_breakdown.append({
            "shop_id": shop.id if shop else None,
            "shop_name": shop.name if shop else user.full_name,
            "plan_type": sub.plan_type if sub else None,
            "billing_type": sub.billing_type if sub else None,
            # Real subscription status — "trial" / "trial_dollar" / "active" / "expired" /
            # "cancelled", or "registered" when they signed up but never created a shop/sub.
            "status": sub.status if sub else "registered",
            "subscription_amount": float(sub.amount_paid) if sub and sub.amount_paid else None,
            "commission_type": commission_type,
            "months_paid": months_paid if commission_type == "recurring" else None,
            "months_remaining": max(0, 12 - months_paid) if commission_type == "recurring" else None,
            "total_earned_from_referral": sum(float(c.amount) for c in shop_commissions),
        })
    # Paying referrals first (highest earner first), then everyone still in trial/registered.
    result["referral_breakdown"] = sorted(
        referral_breakdown, key=lambda r: r["total_earned_from_referral"], reverse=True
    )

    return result


@router.put("/admin/affiliates/{affiliate_id}/status")
def update_affiliate_status(
    affiliate_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    affiliate = db.query(Affiliate).filter(Affiliate.id == affiliate_id).first()
    if not affiliate:
        raise HTTPException(status_code=404, detail="Affiliate not found")
    was_pending = affiliate.status == "pending"
    if affiliate.status == "pending":
        affiliate.status = "active"
        affiliate.approved_at = datetime.now(timezone.utc)
    elif affiliate.status == "active":
        affiliate.status = "suspended"
    else:
        affiliate.status = "active"
    db.commit()

    # Send approval email with password setup link only when transitioning from pending → active
    if was_pending:
        try:
            setup_token = create_access_token(
                data={"sub": str(affiliate.id), "purpose": "affiliate_setup"},
                expires_delta=timedelta(hours=72),
            )
            setup_url = f"https://affiliates.exiuscart.com/setup-password?token={setup_token}"
            send_affiliate_approved_email(
                to=affiliate.email,
                full_name=affiliate.name,
                setup_url=setup_url,
            )
        except Exception:
            pass

    return {"status": affiliate.status}


@router.get("/admin/payout-requests")
def list_payout_requests(
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    from app.models.affiliate import PayoutRequest
    query = db.query(PayoutRequest)
    if status_filter:
        query = query.filter(PayoutRequest.status == status_filter)
    else:
        query = query.filter(PayoutRequest.status == "pending")
    requests = query.order_by(PayoutRequest.requested_at.asc()).all()
    return [
        {
            "id": r.id,
            "affiliate_id": r.affiliate_id,
            "affiliate_name": r.affiliate.name if r.affiliate else "",
            "affiliate_email": r.affiliate.email if r.affiliate else "",
            "payout_method": r.payout_method,
            "payout_address": r.payout_address,
            "amount": float(r.amount),
            "currency": r.currency,
            "status": r.status,
            "admin_notes": r.admin_notes,
            "requested_at": r.requested_at,
            "paid_at": r.paid_at,
        }
        for r in requests
    ]


@router.put("/admin/payout-requests/{request_id}/pay")
def pay_payout_request(
    request_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    from app.models.affiliate import PayoutRequest, Commission
    from app.core.email import send_affiliate_payout_paid_email
    req = db.query(PayoutRequest).filter(PayoutRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Payout request not found")
    if req.status != "pending":
        raise HTTPException(status_code=400, detail="Request is not pending")

    # Only settle the commissions actually linked to THIS request — not every
    # currently-approved commission for the affiliate, which could include
    # ones approved after this request was created (those get their own
    # future payout request instead of being silently swept in here).
    linked_commissions = db.query(Commission).filter(
        Commission.payout_request_id == req.id,
    ).all()
    payable = [c for c in linked_commissions if c.status == "approved"]
    reversed_since_request = [c for c in linked_commissions if c.status == "reversed"]
    actual_amount = sum(float(c.amount) for c in payable)

    if reversed_since_request:
        logger.warning(
            f"[payout] request id={req.id} affiliate_id={req.affiliate_id} — "
            f"{len(reversed_since_request)} linked commission(s) were refunded/reversed "
            f"after the request was created; excluding them, paying ${actual_amount:.2f} "
            f"instead of the originally requested ${float(req.amount):.2f}"
        )

    req.status = "paid"
    req.paid_at = datetime.now(timezone.utc)
    req.amount = actual_amount

    for c in payable:
        c.status = "paid"
        c.paid_at = datetime.now(timezone.utc)

    db.commit()

    try:
        if req.affiliate:
            send_affiliate_payout_paid_email(
                to=req.affiliate.email,
                full_name=req.affiliate.name,
                amount=float(req.amount),
                payout_method=req.payout_method or "",
                payout_address=req.payout_address or "",
            )
    except Exception:
        pass

    return {"message": "Payout marked as paid", "id": req.id}


@router.put("/admin/payout-requests/{request_id}/reject")
def reject_payout_request(
    request_id: int,
    notes: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    from app.models.affiliate import PayoutRequest
    req = db.query(PayoutRequest).filter(PayoutRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Payout request not found")
    req.status = "rejected"
    req.admin_notes = notes
    db.commit()
    return {"message": "Payout request rejected", "id": req.id}


@router.put("/admin/commissions/{commission_id}/approve")
def approve_commission(
    commission_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    commission = db.query(Commission).filter(Commission.id == commission_id).first()
    if not commission:
        raise HTTPException(status_code=404, detail="Commission not found")
    commission.status = "approved"
    commission.approved_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Commission approved for payout"}


@router.put("/admin/commissions/{commission_id}/pay")
def mark_commission_paid(
    commission_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    commission = db.query(Commission).filter(Commission.id == commission_id).first()
    if not commission:
        raise HTTPException(status_code=404, detail="Commission not found")
    commission.status = "paid"
    commission.paid_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Commission marked as paid"}


# ── Public: Affiliate Application ────────────────────────────────────────────

import random
import string


class AffiliateApply(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    company: Optional[str] = None
    website: Optional[str] = None
    how_promote: Optional[str] = None
    # "external" (anyone) or "shop_owner" (existing ExiusCart customer — higher rates)
    affiliate_type: str = "external"
    # "one_time" ($75 flat) or "recurring" (50% of subscription, monthly, 12mo cap) —
    # chosen once here and locked forever; never exposed as editable on any affiliate-facing endpoint.
    commission_model: str = "one_time"


def _generate_referral_code(name: str, db: Session) -> str:
    """Generate a unique referral code like JOHN8F2A."""
    prefix = ''.join(c for c in name.upper() if c.isalpha())[:4].ljust(4, 'X')
    for _ in range(20):
        suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
        code = f"{prefix}{suffix}"
        if not db.query(Affiliate).filter(Affiliate.referral_code == code).first():
            return code
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=10))


@router.post("/affiliates/apply", status_code=201)
def apply_as_affiliate(
    data: AffiliateApply,
    db: Session = Depends(get_db),
):
    """
    Public endpoint — anyone can apply to become an affiliate.
    Shop owners must apply with their ExiusCart account email — they get higher rates.
    Commission tiers (per calendar month of paid referrals):
      External:    1-10 → 20%,  11+ → 35%
      Shop owner:  1-10 → 25%,  11+ → 40%
    """
    if data.commission_model not in ("one_time", "recurring"):
        raise HTTPException(status_code=422, detail="commission_model must be 'one_time' or 'recurring'.")

    existing = db.query(Affiliate).filter(Affiliate.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="This email is already registered as an affiliate.")

    # Shop owner path — verify they have an active ExiusCart account
    if data.affiliate_type == "shop_owner":
        user = db.query(User).filter(User.email == data.email, User.is_active == True).first()
        if not user:
            raise HTTPException(
                status_code=400,
                detail="No active ExiusCart account found with this email. "
                       "Please use the email you registered your shop with.",
            )
        shop = db.query(Shop).filter(Shop.owner_id == user.id).first()
        if not shop:
            raise HTTPException(
                status_code=400,
                detail="No shop found for this account. "
                       "Please register your shop on ExiusCart first.",
            )
        base_rate = 25.00
        tier2_rate = 40.00
    else:
        base_rate = 20.00
        tier2_rate = 35.00

    referral_code = _generate_referral_code(data.name, db)
    affiliate = Affiliate(
        name=data.name,
        email=data.email,
        phone=data.phone,
        company=data.company,
        website=data.website,
        how_promote=data.how_promote,
        referral_code=referral_code,
        affiliate_type=data.affiliate_type,
        status="pending",
        commission_rate=base_rate,
        commission_rate_tier2=tier2_rate,
        tier_threshold=10,
        commission_model=data.commission_model,
    )
    db.add(affiliate)
    db.commit()
    db.refresh(affiliate)

    # Send pending-review confirmation email (fire-and-forget, don't fail if email fails)
    try:
        send_affiliate_pending_email(to=data.email, full_name=data.name)
    except Exception:
        pass

    return {
        "message": "Your affiliate application has been submitted! We'll review it and get back to you within 24 hours.",
        "referral_code": referral_code,
        "affiliate_type": data.affiliate_type,
        "commission_model": data.commission_model,
    }


# ── Shopping: Admin product management ───────────────────────────────────────

from slugify import slugify
import uuid as _uuid


def _slugify_unique(name: str) -> str:
    base = slugify(name)
    return f"{base}-{_uuid.uuid4().hex[:6]}"


# ── Prodora catalogue IDs (CJ001, AL001, DG001, ...) ─────────────────────────
# Every catalogue product and digital bundle gets a readable ID made of its
# supplier's prefix and a running number for that supplier. Assigned once and
# never reused, so the ID stays the same even if an earlier product is deleted.

_SUPPLIER_LABELS = {
    "cj": "CJ Dropshipping", "aliexpress": "AliExpress", "hypersku": "HyperSKU", "eprolo": "EPROLO",
    "1688": "1688", "printful": "Printful", "printify": "Printify", "gelato": "Gelato",
    "manual": "Manual", "digital": "Digital",
}
_SUPPLIER_PREFIX = {
    "cj": "CJ", "aliexpress": "AL", "hypersku": "HS", "eprolo": "EP", "1688": "AB",
    "printful": "PF", "printify": "PY", "gelato": "GL", "manual": "MN", "digital": "DG",
}


def _code_prefix(key: str) -> str:
    return _SUPPLIER_PREFIX.get(key) or (re.sub(r"[^A-Za-z]", "", key)[:2].upper() or "XX")


def _supplier_key(product: Product, link_type: Optional[str]) -> str:
    if link_type:
        return link_type.lower()
    name = (product.supplier_name or "").lower()
    url = (getattr(product, "source_url", None) or "").lower()
    sku = (product.sku or "").upper()
    if "aliexpress" in name or "aliexpress." in url or sku.startswith("AE-"):
        return "aliexpress"
    # Real CJ SKUs look like CJYD3005432 / CJJT2956901 (CJ + 2 letters + digits).
    if "cj" in name or "cjdropshipping.com" in url or re.fullmatch(r"CJ[A-Z]{2}\d{6,}", sku):
        return "cj"
    return "manual"


def _ensure_prodora_codes(db: Session) -> None:
    """Gives every catalogue product / digital bundle that has no ID yet the
    next free one for its supplier, oldest first. Safe to call any time."""
    from app.models.prodora_digital import ProdoraDigitalBundle

    products = (
        db.query(Product)
        .filter(Product.shop_id.is_(None))
        .order_by(Product.id.asc())
        .all()
    )
    link_types: dict = {}
    if products:
        rows = db.query(DropshipProductLink.product_id, DropshipProductLink.supplier_type).filter(
            DropshipProductLink.product_id.in_([p.id for p in products]),
            DropshipProductLink.is_primary == True,
        ).all()
        link_types = {pid: stype for pid, stype in rows}
    bundles = db.query(ProdoraDigitalBundle).order_by(ProdoraDigitalBundle.id.asc()).all()

    highest: dict = {}

    def note(code: Optional[str]) -> None:
        m = re.match(r"^([A-Z]+)(\d+)$", code or "")
        if m:
            highest[m.group(1)] = max(highest.get(m.group(1), 0), int(m.group(2)))

    for p in products:
        note(p.prodora_code)
    for b in bundles:
        note(b.code)

    def take(prefix: str) -> str:
        highest[prefix] = highest.get(prefix, 0) + 1
        return f"{prefix}{highest[prefix]:03d}"

    changed = False
    for p in products:
        prefix = _code_prefix(_supplier_key(p, link_types.get(p.id)))
        # Give a product an ID when it has none, or when its ID's prefix no longer
        # matches its supplier (e.g. a CJ product first numbered as Manual).
        if not p.prodora_code or not re.fullmatch(rf"{prefix}\d+", p.prodora_code):
            p.prodora_code = take(prefix)
            changed = True
    for b in bundles:
        if not b.code:
            b.code = take("DG")
            changed = True
    if changed:
        db.flush()


def _shopping_product_out(p: Product) -> dict:
    return {
        "id": p.id,
        "code": p.prodora_code,
        "name": p.name,
        "description": p.description,
        "price": float(p.price),
        "cost_price": float(p.cost_price) if p.cost_price else None,
        "currency": "USD",
        "image_url": p.image_url,
        "images": [img.url for img in sorted(p.images, key=lambda i: i.sort_order)] if p.images else [],
        "video_url": p.video_url,
        "videos": [v.url for v in p.videos] if p.videos else [],
        "source_url": getattr(p, "source_url", None),
        "is_active": p.is_active,
        "is_featured": p.is_featured,
        "is_bestseller": bool(p.is_bestseller),
        "is_trending": p.is_trending,
        "stock": p.quantity,
        "sku": p.sku,
        "category_id": p.category_id,
        "category_name": p.category.name if p.category else None,
        "shop_id": p.shop_id,
        "shop_name": p.shop.name if p.shop else None,
        "created_at": p.created_at,
        "variants": [{"color": v.color, "color_hex": v.color_hex} for v in p.variants] if p.variants else [],
        "winning_score": p.winning_score,
        "trend_percent": float(p.trend_percent) if p.trend_percent is not None else None,
        "competition_level": p.competition_level,
        "saturation_level": p.saturation_level,
        "orders_count": p.orders_count,
        "supplier_name": p.supplier_name,
        "supplier_rating": float(p.supplier_rating) if p.supplier_rating is not None else None,
        "fulfillment_rate": float(p.fulfillment_rate) if p.fulfillment_rate is not None else None,
        "processing_time": p.processing_time,
        "shipping_time": p.shipping_time,
        "warehouse_country": p.warehouse_country,
        "shipping_cost": float(p.shipping_cost) if p.shipping_cost is not None else None,
        "demand_trend_json": p.demand_trend_json,
        "orders_trend_json": p.orders_trend_json,
        "top_countries_json": p.top_countries_json,
        "ad_facebook_url": p.ad_facebook_url,
        "ad_tiktok_url": p.ad_tiktok_url,
        "ad_instagram_url": p.ad_instagram_url,
        "ad_pinterest_url": p.ad_pinterest_url,
        "specs_json": p.specs_json,
        "tags": p.tags,
    }


class ShoppingProductVariantIn(BaseModel):
    color: Optional[str] = None
    color_hex: Optional[str] = None


# Optional Prodora "winning product" fields — always admin-entered, never
# fabricated. Frontend hides each block/row when its field is null.
class ShoppingProductExtras(BaseModel):
    images: Optional[List[str]] = None
    videos: Optional[List[str]] = None
    variants: Optional[List[ShoppingProductVariantIn]] = None
    winning_score: Optional[int] = None
    trend_percent: Optional[float] = None
    competition_level: Optional[str] = None
    saturation_level: Optional[str] = None
    orders_count: Optional[int] = None
    supplier_name: Optional[str] = None
    supplier_rating: Optional[float] = None
    fulfillment_rate: Optional[float] = None
    processing_time: Optional[str] = None
    shipping_time: Optional[str] = None
    warehouse_country: Optional[str] = None
    shipping_cost: Optional[float] = None
    demand_trend_json: Optional[str] = None
    orders_trend_json: Optional[str] = None
    top_countries_json: Optional[str] = None
    ad_facebook_url: Optional[str] = None
    ad_tiktok_url: Optional[str] = None
    ad_instagram_url: Optional[str] = None
    ad_pinterest_url: Optional[str] = None
    specs_json: Optional[str] = None
    tags: Optional[str] = None


class ShoppingProductCreate(ShoppingProductExtras):
    name: str
    description: Optional[str] = None
    price: float                          # selling price in USD shown to dropshippers
    cost_price: Optional[float] = None   # buying/supplier price in USD
    sku: Optional[str] = None
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    source_url: Optional[str] = None     # supplier page (AliExpress, CJ, etc.)
    category_name: Optional[str] = None  # free-text, auto-creates category in admin shop
    is_featured: bool = False
    is_bestseller: bool = False
    is_trending: bool = False
    is_active: bool = True


class ShoppingProductUpdate(ShoppingProductExtras):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    cost_price: Optional[float] = None
    sku: Optional[str] = None
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    source_url: Optional[str] = None
    category_name: Optional[str] = None
    is_featured: Optional[bool] = None
    is_bestseller: Optional[bool] = None
    is_trending: Optional[bool] = None
    is_active: Optional[bool] = None


@router.get("/admin/shopping/products")
def admin_list_shopping_products(
    search: Optional[str] = None,
    shop_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    query = (
        db.query(Product)
        .options(joinedload(Product.category))
        .filter(Product.shop_id.is_(None))
        .order_by(Product.is_trending.desc(), Product.is_featured.desc(), Product.created_at.desc())
    )
    if search:
        q = f"%{search}%"
        query = query.filter(Product.name.ilike(q))
    if shop_id:
        query = query.filter(Product.shop_id == shop_id)
    return [_shopping_product_out(p) for p in query.limit(200).all()]


@router.get("/admin/prodora/catalog")
def admin_prodora_catalog(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    """Everything on Prodora in one list — supplier products and digital
    bundles — oldest first, each with its catalogue ID (CJ001, AL001, DG001)."""
    from app.models.prodora_digital import ProdoraDigitalBundle

    _ensure_prodora_codes(db)
    db.commit()

    query = (
        db.query(Product)
        .options(joinedload(Product.category))
        .filter(Product.shop_id.is_(None))
    )
    bundle_query = db.query(ProdoraDigitalBundle)
    if search:
        q = f"%{search}%"
        query = query.filter((Product.name.ilike(q)) | (Product.prodora_code.ilike(q)))
        bundle_query = bundle_query.filter((ProdoraDigitalBundle.name.ilike(q)) | (ProdoraDigitalBundle.code.ilike(q)))
    products = query.all()

    link_types: dict = {}
    if products:
        rows = db.query(DropshipProductLink.product_id, DropshipProductLink.supplier_type).filter(
            DropshipProductLink.product_id.in_([p.id for p in products]),
            DropshipProductLink.is_primary == True,
        ).all()
        link_types = {pid: stype for pid, stype in rows}

    from app.models.prodora import ProdoraImportLog
    import_counts = dict(
        db.query(ProdoraImportLog.source_product_id, func.count(ProdoraImportLog.id))
        .filter(ProdoraImportLog.source_product_id.isnot(None))
        .group_by(ProdoraImportLog.source_product_id).all()
    )

    result = []
    for p in products:
        key = _supplier_key(p, link_types.get(p.id))
        out = _shopping_product_out(p)
        out.update({
            "kind": "product", "supplier_key": key, "supplier_label": _SUPPLIER_LABELS.get(key, key.title()),
            "views": p.view_count or 0, "imports": import_counts.get(p.id, 0),
        })
        result.append(out)
    for b in bundle_query.all():
        result.append({
            "kind": "digital", "id": b.id, "code": b.code, "supplier_key": "digital", "supplier_label": "Digital",
            "name": b.name, "description": b.description, "price": float(b.price), "cost_price": None,
            "currency": "USD", "image_url": b.cover_image_url, "images": [], "videos": [], "video_url": None,
            "source_url": None, "is_active": b.is_active, "is_featured": False, "is_trending": bool(b.is_trending), "is_bestseller": bool(b.is_bestseller),
            "sku": None, "category_name": None, "created_at": b.created_at, "variants": [],
            "views": None, "imports": None,
        })

    def created_key(row: dict) -> float:
        c = row.get("created_at")
        return c.timestamp() if c else 0.0

    result.sort(key=lambda r: (created_key(r), r["kind"] == "digital", r["id"]))
    return result


def _get_or_create_category(db: Session, shop_id: int, name: str):
    from app.models.product import Category
    cat_slug = slugify(name)
    cat = db.query(Category).filter(Category.shop_id == shop_id, Category.slug == cat_slug).first()
    if not cat:
        cat = Category(name=name.strip().title(), slug=cat_slug, shop_id=shop_id)
        db.add(cat)
        db.flush()
    return cat


@router.post("/admin/shopping/upload-image")
async def admin_upload_shopping_image(
    file: UploadFile,
    _: User = Depends(require_superuser),
):
    """Upload a product image to R2 and return the public URL."""
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File must be under 10 MB")
    ext = (file.filename or "img").rsplit(".", 1)[-1].lower()
    from app.core.storage import upload_shop_image
    url = upload_shop_image(contents, 0, "catalog", ext, content_type=file.content_type or "image/jpeg")
    return {"url": url}


SHOPPING_EXTRA_SCALAR_FIELDS = [
    "winning_score", "trend_percent", "competition_level", "saturation_level",
    "orders_count", "supplier_name", "supplier_rating", "fulfillment_rate",
    "processing_time", "shipping_time", "warehouse_country", "shipping_cost",
    "demand_trend_json", "orders_trend_json", "top_countries_json", "ad_facebook_url", "ad_tiktok_url",
    "ad_instagram_url", "ad_pinterest_url", "specs_json", "tags",
]


def _apply_shopping_extras(db: Session, product: Product, payload: dict) -> None:
    """Applies the optional Prodora research fields — winning metrics, supplier
    info, ad links, gallery images, variants. `payload` is a model_dump(exclude_unset=True)
    dict so only fields the caller actually sent get touched."""
    from app.models.product_fields import ProductImage, ProductVideo
    from app.models.product_variant import ProductVariant
    from app.core.video_oembed import fetch_oembed

    for field in SHOPPING_EXTRA_SCALAR_FIELDS:
        if field in payload:
            setattr(product, field, payload[field])

    if payload.get("images") is not None:
        db.query(ProductImage).filter(ProductImage.product_id == product.id).delete()
        for i, url in enumerate([u for u in payload["images"] if u][:6]):
            db.add(ProductImage(product_id=product.id, url=url, sort_order=i, is_primary=(i == 0)))

    if payload.get("videos") is not None:
        # Same oEmbed resolution as the seller-facing video endpoint
        # (product_fields.py add_video) — thumbnail/title/embed come from
        # YouTube/TikTok's own oEmbed lookup, never entered by hand. A link
        # that fails to resolve is dropped rather than blocking the whole
        # save, since videos here are just one field among many.
        db.query(ProductVideo).filter(ProductVideo.product_id == product.id).delete()
        sort_order = 0
        for url in [u.strip() for u in payload["videos"] if u and u.strip()][:6]:
            info = fetch_oembed(url)
            if not info:
                continue
            db.add(ProductVideo(
                product_id=product.id,
                url=url,
                platform=info["platform"],
                thumbnail_url=info["thumbnail_url"],
                title=info["title"],
                embed_html=info["embed_html"],
                sort_order=sort_order,
            ))
            sort_order += 1

    if payload.get("variants") is not None:
        db.query(ProductVariant).filter(ProductVariant.product_id == product.id).delete()
        for v in payload["variants"]:
            color = v.get("color") if isinstance(v, dict) else None
            if color:
                db.add(ProductVariant(product_id=product.id, color=color, color_hex=v.get("color_hex")))


_DESCRIPTION_IMG_RE = re.compile(r"<img\b[^>]*>", re.IGNORECASE)
_EMPTY_PARA_RE = re.compile(r"<p>(\s|&nbsp;|<br\s*/?>)*</p>", re.IGNORECASE)


def _strip_description_images(html: Optional[str]) -> Optional[str]:
    """Supplier-sourced descriptions (CJ, Prodora, etc.) often embed the
    product's own photos as <img> tags throughout the description HTML —
    redundant, since those same photos already come through separately as
    real ProductImage rows (see `images` in _cj_import_one / ShoppingProductExtras).
    Left in, they just don't render anywhere that treats description as
    plain text (Custom Website's storefront strips all HTML for XSS safety,
    and eBay/Daraz have their own plain-text limits) — so the seller sees a
    "missing images" gap that isn't real, the images just never left the
    description. Strip them here, once, at the only place descriptions
    enter the system, rather than leaving every consumer to work around it."""
    if not html:
        return html
    cleaned = _DESCRIPTION_IMG_RE.sub("", html)
    cleaned = _EMPTY_PARA_RE.sub("", cleaned)
    return cleaned.strip() or None


_DESCRIPTION_IMG_SRC_RE = re.compile(r'<img\b[^>]*\bsrc=["\']([^"\']+)["\']', re.IGNORECASE)


def _preserve_unique_description_images(db: Session, product: Product, raw_description: Optional[str], already_saved: set) -> None:
    """_strip_description_images removes <img> tags from the description
    text, but some suppliers (CJ especially) embed images there that never
    appear in the separate product photo set — size charts, feature
    call-outs. Stripping those unconditionally would silently delete real
    content. `already_saved` is whatever this same request is already
    saving to the gallery (e.g. ShoppingProductExtras.images); combined
    with the product's existing ProductImage rows, anything left over is a
    genuinely new image and gets appended to the gallery instead of being
    thrown away. True duplicates are correctly skipped either way."""
    urls = _DESCRIPTION_IMG_SRC_RE.findall(raw_description or "")
    if not urls:
        return
    from app.models.product_fields import ProductImage
    existing = db.query(ProductImage).filter(ProductImage.product_id == product.id).all()
    seen = already_saved | {img.url for img in existing}
    next_sort = max((img.sort_order for img in existing), default=-1) + 1
    for url in urls:
        if url in seen:
            continue
        db.add(ProductImage(product_id=product.id, url=url, sort_order=next_sort, is_primary=False))
        seen.add(url)
        next_sort += 1


def _truncate_description(html: Optional[str], word_limit: int) -> Optional[str]:
    """Supplier descriptions can run far longer than any plan's word limit
    (see DESCRIPTION_WORDS_DEFAULT/PREMIUM in product_fields.py — the same
    limits create_product/update_product enforce for sellers typing their
    own description). Cutting arbitrary HTML at a word boundary risks
    leaving unclosed tags, so truncation only kicks in when actually over
    the limit, and falls back to plain text wrapped in one <p> rather than
    trying to preserve the original markup. Descriptions already under the
    limit are returned untouched, formatting intact. Uses the free-tier
    limit — imports land in the system shop, which has no plan of its own,
    so the safest bound (the lowest any destination shop could have) applies."""
    if not html:
        return html
    text_only = re.sub(r"<[^>]*>", " ", html).replace("&nbsp;", " ")
    words = [w for w in text_only.split() if w]
    if len(words) <= word_limit:
        return html
    return f"<p>{' '.join(words[:word_limit])}…</p>"


# The Prodora catalogue belongs to the platform, not to a shop: its products,
# categories, supplier links and supplier connections all have shop_id NULL.
# This stand-in only carries the two values the import code reads from a shop
# (id is None, so "shop_id == shop.id" means "shop_id IS NULL").
_CATALOGUE = SimpleNamespace(id=None, currency="USD", name="Prodora catalogue")


# ── Admin — Website blog (exiuscart.com/blog) ────────────────────────────────
# The marketing site's own blog, written from the admin panel instead of
# hardcoded into apps/exiuscart-website. Reuses the exact same BlogPost
# model, slug generation, and public read API (/public/store/{shop_slug}/blog)
# that seller storefronts already use — this just points that same machinery
# at a dedicated system shop instead of a real seller's, same pattern as
# the catalogue constant above. The website reads posts from
# GET /public/store/exiuscart-website/blog with zero backend changes needed.

from app.models.blog import BlogPost
from app.api.v1.endpoints.blog import _post_out as _blog_post_out, _generate_blog_slug


# Each site has its own blog. A post carries a `site` tag (no shop involved) and is
# read publicly through /public/store/<site>-website/blog (see blog.py).
_BLOG_SITES = ("exiuscart", "prodora", "affiliate")

# Internal shops that are not real customers. They are left out of the admin's
# pending-approval list, store list and counts, and never get a trial subscription.
# (The blog ones only remain here in case a leftover row could not be deleted.)
SYSTEM_SHOP_SLUGS = ("exiuscart-website", "exiuscart-dropshipping-system", "prodora-website", "affiliate-website")


def _check_blog_site(site: str) -> None:
    if site not in _BLOG_SITES:
        raise HTTPException(status_code=422, detail="Unknown site. Use exiuscart, prodora or affiliate.")


class WebsiteBlogPostIn(BaseModel):
    title: str
    excerpt: Optional[str] = None
    content: Optional[str] = None
    cover_image_url: Optional[str] = None
    author_name: Optional[str] = None
    tags: Optional[str] = None
    cta_text: Optional[str] = None
    cta_url: Optional[str] = None


@router.get("/admin/website-blog")
def admin_list_website_blog_posts(
    status_filter: Optional[str] = None,
    site: str = "exiuscart",
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_superuser),
):
    _check_blog_site(site)
    q = db.query(BlogPost).filter(BlogPost.site == site)
    if status_filter:
        q = q.filter(BlogPost.status == status_filter)
    posts = q.order_by(BlogPost.created_at.desc()).all()
    db.commit()
    return {"posts": [_blog_post_out(p) for p in posts]}


@router.get("/admin/website-blog/{post_id}")
def admin_get_website_blog_post(
    post_id: int,
    site: str = "exiuscart",
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_superuser),
):
    _check_blog_site(site)
    post = db.query(BlogPost).filter(BlogPost.id == post_id, BlogPost.site == site).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    db.commit()
    return _blog_post_out(post)


@router.post("/admin/website-blog", status_code=201)
def admin_create_website_blog_post(
    data: WebsiteBlogPostIn,
    site: str = "exiuscart",
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_superuser),
):
    _check_blog_site(site)
    if not data.title.strip():
        raise HTTPException(status_code=422, detail="Title is required.")
    post = BlogPost(
        site=site,
        title=data.title.strip(),
        slug=_generate_blog_slug(data.title),
        excerpt=data.excerpt,
        content=data.content,
        cover_image_url=data.cover_image_url,
        author_name=data.author_name or "ExiusCart Team",
        tags=data.tags,
        cta_text=data.cta_text,
        cta_url=data.cta_url,
        status="draft",
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return _blog_post_out(post)


@router.put("/admin/website-blog/{post_id}")
def admin_update_website_blog_post(
    post_id: int,
    data: WebsiteBlogPostIn,
    site: str = "exiuscart",
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_superuser),
):
    _check_blog_site(site)
    post = db.query(BlogPost).filter(BlogPost.id == post_id, BlogPost.site == site).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    post.title = data.title.strip() or post.title
    post.excerpt = data.excerpt
    post.content = data.content
    post.cover_image_url = data.cover_image_url
    post.author_name = data.author_name
    post.tags = data.tags
    post.cta_text = data.cta_text
    post.cta_url = data.cta_url
    db.commit()
    db.refresh(post)
    return _blog_post_out(post)


@router.delete("/admin/website-blog/{post_id}")
def admin_delete_website_blog_post(
    post_id: int,
    site: str = "exiuscart",
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_superuser),
):
    _check_blog_site(site)
    post = db.query(BlogPost).filter(BlogPost.id == post_id, BlogPost.site == site).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    db.delete(post)
    db.commit()
    return {"deleted": True}


class WebsiteBlogPublishIn(BaseModel):
    published: bool


@router.post("/admin/website-blog/{post_id}/publish")
def admin_publish_website_blog_post(
    post_id: int,
    data: WebsiteBlogPublishIn,
    site: str = "exiuscart",
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_superuser),
):
    _check_blog_site(site)
    post = db.query(BlogPost).filter(BlogPost.id == post_id, BlogPost.site == site).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if data.published:
        if not (post.content or "").strip():
            raise HTTPException(status_code=422, detail="Can't publish an empty post — add some content first.")
        post.status = "published"
        if not post.published_at:
            post.published_at = datetime.now(timezone.utc)
    else:
        post.status = "draft"
    db.commit()
    db.refresh(post)
    return _blog_post_out(post)


@router.post("/admin/website-blog/upload-image")
async def admin_upload_website_blog_image(
    file: UploadFile,
    _: User = Depends(require_superuser),
):
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image must be under 10 MB.")
    ext = (file.filename or "img").rsplit(".", 1)[-1].lower()
    from app.core.storage import upload_shop_image
    url = upload_shop_image(contents, 0, "website-blog", ext, content_type=file.content_type or "image/jpeg")
    return {"url": url}


@router.post("/admin/shopping/products", status_code=201)
def admin_create_shopping_product(
    data: ShoppingProductCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_superuser),
):
    shop = _CATALOGUE

    cat_id = None
    if data.category_name:
        cat_id = _get_or_create_category(db, shop.id, data.category_name).id

    product = Product(
        name=data.name,
        slug=_slugify_unique(data.name),
        description=_truncate_description(_strip_description_images(data.description), DESCRIPTION_WORDS_DEFAULT),
        price=data.price,
        cost_price=data.cost_price,
        sku=data.sku,
        image_url=data.image_url,
        video_url=data.video_url,
        source_url=data.source_url,
        quantity=0,
        category_id=cat_id,
        shop_id=shop.id,
        is_featured=data.is_featured,
        is_bestseller=data.is_bestseller,
        is_trending=data.is_trending,
        is_active=data.is_active,
    )
    db.add(product)
    db.flush()
    _apply_shopping_extras(db, product, data.model_dump(exclude_unset=True))
    _preserve_unique_description_images(db, product, data.description, set(data.images or []))
    _ensure_prodora_codes(db)
    db.commit()
    product = db.query(Product).options(
        joinedload(Product.shop), joinedload(Product.category)
    ).filter(Product.id == product.id).first()
    return _shopping_product_out(product)


@router.put("/admin/shopping/products/{product_id}")
def admin_update_shopping_product(
    product_id: int,
    data: ShoppingProductUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    payload = data.model_dump(exclude_unset=True)
    raw_description = payload.get("description")
    for field, value in payload.items():
        if field == "category_name":
            if value:
                product.category_id = _get_or_create_category(db, product.shop_id, value).id
            else:
                product.category_id = None
        elif field == "description":
            product.description = _truncate_description(_strip_description_images(value), DESCRIPTION_WORDS_DEFAULT)
        elif field in ("name", "price", "cost_price", "sku",
                       "image_url", "video_url", "source_url",
                       "is_featured", "is_bestseller", "is_trending", "is_active"):
            setattr(product, field, value)
    _apply_shopping_extras(db, product, payload)
    if raw_description is not None:
        _preserve_unique_description_images(db, product, raw_description, set(payload.get("images") or []))
    db.commit()
    product = db.query(Product).options(
        joinedload(Product.shop), joinedload(Product.category)
    ).filter(Product.id == product_id).first()
    return _shopping_product_out(product)


@router.delete("/admin/shopping/products/{product_id}", status_code=204)
def admin_delete_shopping_product(
    product_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(product)
    db.commit()


@router.post("/admin/shopping/backfill-descriptions")
def admin_backfill_shopping_descriptions(
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_superuser),
):
    """
    One-time cleanup for Prodora catalog products saved before the
    strip/truncate pipeline existed (_strip_description_images /
    _truncate_description, already applied on every create/update since —
    see admin_create_shopping_product, admin_update_shopping_product,
    _cj_import_one). Re-runs that same logic retroactively on whatever's
    already stored, so old rows stop showing embedded CJ images and
    oversized text. Any embedded image not already in the product's photo
    gallery is preserved there (_preserve_unique_description_images)
    rather than discarded. Idempotent — already-clean descriptions are
    untouched.
    """
    shop = _CATALOGUE
    products = db.query(Product).filter(Product.shop_id == shop.id).all()
    updated = 0
    for p in products:
        if not p.description:
            continue
        cleaned = _truncate_description(_strip_description_images(p.description), DESCRIPTION_WORDS_DEFAULT)
        if cleaned != p.description:
            _preserve_unique_description_images(db, p, p.description, set())
            p.description = cleaned
            updated += 1
    db.commit()
    return {"updated": updated, "total": len(products)}


@router.get("/admin/shopping/shops")
def admin_list_shops_for_product(
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    """Returns active shops for the product-add shop selector."""
    shops = db.query(Shop).filter(Shop.is_active == True).order_by(Shop.name).all()
    return [{"id": s.id, "name": s.name, "currency": s.currency} for s in shops]


@router.get("/admin/shopping/categories")
def admin_list_categories(
    shop_id: Optional[int] = None,
    prodora: bool = False,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    query = db.query(Category)
    if shop_id:
        query = query.filter(Category.shop_id == shop_id)
    if prodora:
        # Only the internal Prodora catalogue shop's categories — not every
        # seller's own product categories.
        query = query.filter(Category.shop_id.is_(None))
    cats = query.order_by(Category.name).all()
    counts = dict(
        db.query(Product.category_id, func.count(Product.id))
        .filter(Product.category_id.in_([c.id for c in cats] or [0]))
        .group_by(Product.category_id).all()
    )
    return [
        {
            "id": c.id, "name": c.name, "slug": c.slug, "shop_id": c.shop_id,
            "image_url": c.image_url, "product_count": int(counts.get(c.id, 0)),
        }
        for c in cats
    ]


class ShoppingCategoryIn(BaseModel):
    name: str
    image_url: Optional[str] = None


def _category_out(c: Category, product_count: int = 0) -> dict:
    return {
        "id": c.id, "name": c.name, "slug": c.slug, "shop_id": c.shop_id,
        "image_url": c.image_url, "product_count": product_count,
        "managed": bool(c.prodora_managed),
    }


# The Prodora Marketplace's category tiles are exactly the categories that
# have an image here (and at least one active product), so managing them is
# scoped to the internal Prodora system shop, like the products themselves.
@router.post("/admin/shopping/categories", status_code=201)
def admin_create_category(
    data: ShoppingCategoryIn,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_superuser),
):
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Category name is required.")
    shop = _CATALOGUE
    slug = slugify(name)
    if db.query(Category).filter(Category.shop_id == shop.id, Category.slug == slug).first():
        raise HTTPException(status_code=409, detail="A category with that name already exists.")
    cat = Category(name=name, slug=slug, shop_id=shop.id, image_url=(data.image_url or None), prodora_managed=True)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return _category_out(cat)


@router.put("/admin/shopping/categories/{category_id}")
def admin_update_category(
    category_id: int,
    data: ShoppingCategoryIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found.")
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Category name is required.")
    slug = slugify(name)
    if slug != cat.slug and db.query(Category).filter(
        Category.shop_id == cat.shop_id, Category.slug == slug, Category.id != cat.id,
    ).first():
        raise HTTPException(status_code=409, detail="A category with that name already exists.")
    cat.name = name
    cat.slug = slug
    cat.image_url = data.image_url or None
    cat.prodora_managed = True  # saving a category from the admin page lists it in Prodora
    db.commit()
    db.refresh(cat)
    n = db.query(func.count(Product.id)).filter(Product.category_id == cat.id).scalar() or 0
    return _category_out(cat, int(n))


@router.delete("/admin/shopping/categories/{category_id}")
def admin_delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found.")
    n = db.query(func.count(Product.id)).filter(Product.category_id == cat.id).scalar() or 0
    if n:
        raise HTTPException(
            status_code=409,
            detail=f"This category still has {n} product{'s' if n != 1 else ''}. Move or delete them first.",
        )
    db.delete(cat)
    db.commit()
    return {"ok": True}


# ── Admin — CJ Dropshipping as a source for the Prodora catalog ─────────────
# Reuses the same DropshipConnection model and CJ helper functions (token
# handling, price parsing) already built for sellers, just scoped to the
# platform itself (a connection with no shop) instead of a real seller.

class CJConnectAdminIn(BaseModel):
    api_key: str


class CJImportAdminIn(BaseModel):
    cj_pid: str
    price: Optional[float] = None
    category_name: Optional[str] = None


def _get_system_cj_connection(db: Session, shop: Shop) -> DropshipConnection:
    conn = db.query(DropshipConnection).filter(
        DropshipConnection.shop_id == shop.id,
        DropshipConnection.supplier_type == "cj",
        DropshipConnection.is_active == True,
    ).first()
    if not conn:
        raise HTTPException(status_code=400, detail="CJ Dropshipping is not connected.")
    return conn


@router.get("/admin/shopping/cj/status")
def admin_cj_status(
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_superuser),
):
    shop = _CATALOGUE
    conn = db.query(DropshipConnection).filter(
        DropshipConnection.shop_id == shop.id,
        DropshipConnection.supplier_type == "cj",
        DropshipConnection.is_active == True,
    ).first()
    return {"connected": conn is not None}


@router.post("/admin/shopping/cj/connect")
async def admin_connect_cj(
    data: CJConnectAdminIn,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_superuser),
):
    shop = _CATALOGUE
    token_data = await _cj_get_token(data.api_key)

    enc_key = encrypt(data.api_key)
    expires = datetime.fromisoformat(token_data["accessTokenExpiryDate"].replace("Z", "+00:00"))

    existing = db.query(DropshipConnection).filter(
        DropshipConnection.shop_id == shop.id,
        DropshipConnection.supplier_type == "cj",
    ).first()
    if existing:
        existing.api_key = enc_key
        existing.access_token = token_data["accessToken"]
        existing.token_expires_at = expires
        existing.is_active = True
    else:
        db.add(DropshipConnection(
            shop_id=shop.id,
            supplier_type="cj",
            api_key=enc_key,
            access_token=token_data["accessToken"],
            token_expires_at=expires,
        ))
    db.commit()
    return {"connected": True}


@router.get("/admin/shopping/cj/search")
async def admin_cj_search(
    q: str = "",
    page: int = 1,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_superuser),
):
    shop = _CATALOGUE
    conn = _get_system_cj_connection(db, shop)
    token = await _cj_ensure_token(conn, db)

    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(f"{CJ_BASE}/product/list", params={
            "productNameEn": q,
            "pageNum": page,
            "pageSize": 20,
        }, headers={"CJ-Access-Token": token})

    data = r.json()
    if not data.get("result"):
        raise HTTPException(status_code=502, detail=f"CJ API error: {data.get('message', 'Unknown error')}")

    cj_list = data.get("data", {}).get("list") or []
    products = [
        {
            "pid": p.get("pid") or p.get("productId", ""),
            "name": p.get("productNameEn") or p.get("productName", ""),
            "image": p.get("productImage") or p.get("productImageUrl", ""),
            "cost_price": _parse_cj_price(p.get("sellPrice") or p.get("minSellPrice")),
            "category": p.get("categoryName", ""),
        }
        for p in cj_list
    ]
    return {"products": products, "total": data.get("data", {}).get("total", 0), "page": page}


@router.get("/admin/shopping/cj/trending")
async def admin_cj_trending(
    page: int = 1,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_superuser),
):
    """CJ's own curated hot-products feed (searchType=2 on /product/list) —
    real data CJ maintains, not scraped. Verified against their live API docs."""
    shop = _CATALOGUE
    conn = _get_system_cj_connection(db, shop)
    token = await _cj_ensure_token(conn, db)

    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(f"{CJ_BASE}/product/list", params={
            "searchType": 2,
            "pageNum": page,
            "pageSize": 20,
        }, headers={"CJ-Access-Token": token})

    data = r.json()
    if not data.get("result"):
        raise HTTPException(status_code=502, detail=f"CJ API error: {data.get('message', 'Unknown error')}")

    cj_list = data.get("data", {}).get("list") or []
    products = [
        {
            "pid": p.get("pid") or p.get("productId", ""),
            "name": p.get("productNameEn") or p.get("productName", ""),
            "image": p.get("productImage") or p.get("productImageUrl", ""),
            "cost_price": _parse_cj_price(p.get("sellPrice") or p.get("minSellPrice")),
            "category": p.get("categoryName", ""),
        }
        for p in cj_list
    ]
    return {"products": products, "total": data.get("data", {}).get("total", 0), "page": page}


@router.get("/admin/shopping/cj/categories")
async def admin_cj_categories(
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_superuser),
):
    """CJ's real 3-level category tree (verified via /product/getCategory) —
    flattened to the leaf (3rd level) categories, since only those carry a
    categoryId usable to filter /product/list."""
    shop = _CATALOGUE
    conn = _get_system_cj_connection(db, shop)
    token = await _cj_ensure_token(conn, db)

    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(f"{CJ_BASE}/product/getCategory", headers={"CJ-Access-Token": token})
    data = r.json()
    if not data.get("result"):
        raise HTTPException(status_code=502, detail=f"CJ API error: {data.get('message', 'Unknown error')}")

    categories = []
    for lvl1 in (data.get("data") or []):
        first_name = lvl1.get("categoryFirstName", "")
        for lvl2 in (lvl1.get("categoryFirstList") or []):
            second_name = lvl2.get("categorySecondName", "")
            for lvl3 in (lvl2.get("categorySecondList") or []):
                cid = lvl3.get("categoryId")
                cname = lvl3.get("categoryName")
                if cid and cname:
                    categories.append({"id": cid, "name": cname, "path": f"{first_name} > {second_name} > {cname}"})
    return {"categories": categories}


@router.get("/admin/shopping/cj/by-category")
async def admin_cj_by_category(
    category_id: str,
    page: int = 1,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_superuser),
):
    shop = _CATALOGUE
    conn = _get_system_cj_connection(db, shop)
    token = await _cj_ensure_token(conn, db)

    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(f"{CJ_BASE}/product/list", params={
            "categoryId": category_id,
            "pageNum": page,
            "pageSize": 20,
        }, headers={"CJ-Access-Token": token})

    data = r.json()
    if not data.get("result"):
        raise HTTPException(status_code=502, detail=f"CJ API error: {data.get('message', 'Unknown error')}")

    cj_list = data.get("data", {}).get("list") or []
    products = [
        {
            "pid": p.get("pid") or p.get("productId", ""),
            "name": p.get("productNameEn") or p.get("productName", ""),
            "image": p.get("productImage") or p.get("productImageUrl", ""),
            "cost_price": _parse_cj_price(p.get("sellPrice") or p.get("minSellPrice")),
            "category": p.get("categoryName", ""),
        }
        for p in cj_list
    ]
    return {"products": products, "total": data.get("data", {}).get("total", 0), "page": page}


@router.get("/admin/shopping/cj/my-products")
async def admin_cj_my_products(
    page: int = 1,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_superuser),
):
    """The curated shortlist from CJ's own site (Product Sourcing -> My
    Product) — already vetted, so no search-relevance issues like /cj/search."""
    shop = _CATALOGUE
    conn = _get_system_cj_connection(db, shop)
    token = await _cj_ensure_token(conn, db)

    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(f"{CJ_BASE}/product/myProduct/query", params={
            "pageNum": page,
            "pageSize": 20,
        }, headers={"CJ-Access-Token": token})

    data = r.json()
    if not data.get("result"):
        raise HTTPException(status_code=502, detail=f"CJ API error: {data.get('message', 'Unknown error')}")

    d = data.get("data") or {}
    cj_list = d.get("content") or d.get("list") or []
    products = [
        {
            "pid": p.get("productId") or p.get("pid", ""),
            "name": p.get("nameEn") or p.get("productNameEn") or p.get("productName", ""),
            "image": p.get("bigImage") or p.get("productImage", ""),
            "cost_price": _parse_cj_price(p.get("sellPrice")),
            "category": p.get("categoryName", ""),
        }
        for p in cj_list
    ]
    total = d.get("totalRecords") or d.get("total") or 0
    return {"products": products, "total": total, "page": page}


async def _cj_import_one(db: Session, shop: Shop, token: str, cj_pid: str, price: Optional[float] = None, category_name: Optional[str] = None) -> Product:
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(f"{CJ_BASE}/product/query", params={"pid": cj_pid}, headers={"CJ-Access-Token": token})
    cj = r.json()
    if not cj.get("result"):
        raise HTTPException(status_code=502, detail="Failed to fetch product from CJ. Please try again.")

    p = cj.get("data", {})
    name = (p.get("productNameEn") or p.get("productName") or "CJ Product").strip()
    cost = _parse_cj_price(p.get("sellPrice") or p.get("suggestSellPrice"))
    final_price = price if price else round(cost * 2, 2)

    images = []
    for img in (p.get("productImageSet") or p.get("imageSet") or []):
        url = img if isinstance(img, str) else (img.get("imageUrl") or img.get("url") or "")
        if url:
            images.append(url)
    if not images and p.get("productImage"):
        images.append(p["productImage"])

    cat_id = None
    cat_name = category_name or p.get("categoryName")
    if cat_name:
        cat_id = _get_or_create_category(db, shop.id, cat_name).id

    product = Product(
        name=name,
        slug=_slugify_unique(name),
        description=_truncate_description(_strip_description_images(p.get("description")), DESCRIPTION_WORDS_DEFAULT) or name,
        price=final_price,
        cost_price=cost,
        sku=p.get("productSku") or cj_pid[:50],
        image_url=images[0] if images else None,
        source_url=f"https://cjdropshipping.com/product-detail.html?pid={cj_pid}",
        quantity=0,
        category_id=cat_id,
        shop_id=shop.id,
        is_featured=False,
        is_trending=False,
        is_active=True,
        # Real fields straight from CJ's own response — not guessed.
        supplier_name=p.get("supplierName") or "CJ Dropshipping",
        warehouse_country=(p.get("variants") or [{}])[0].get("areaCountryCode") or None,
    )
    db.add(product)
    db.flush()

    from app.models.product_fields import ProductImage
    from app.models.product_variant import ProductVariant

    for i, url in enumerate(images[:6]):
        db.add(ProductImage(product_id=product.id, url=url, sort_order=i, is_primary=(i == 0)))

    _preserve_unique_description_images(db, product, p.get("description"), set(images[:6]))

    # CJ variant names are a free-text combo (e.g. "Blue Triangle-25X23CM"),
    # not a clean color field — stored as a readable label, no fabricated hex.
    seen_variants = set()
    for v in (p.get("variants") or []):
        label = (v.get("variantKey") or v.get("variantNameEn") or "").strip()
        if label and label not in seen_variants:
            seen_variants.add(label)
            db.add(ProductVariant(product_id=product.id, color=label[:100], sku=v.get("variantSku")))

    # CJ's freight-calculate API needs a variant vid, not the product's own
    # pid — same link the seller-side CJ import saves (dropshipping.py) so
    # this catalog product can later get a real per-country shipping quote
    # instead of the admin-typed flat shipping_cost estimate.
    variants = p.get("variants") or []
    variant_vid = (variants[0] if variants else {}).get("vid")
    if variant_vid:
        db.add(DropshipProductLink(
            shop_id=shop.id,
            product_id=product.id,
            supplier_type="cj",
            supplier_product_id=cj_pid,
            supplier_sku=variant_vid,
            supplier_product_name=name,
            cost_price=cost,
            is_primary=True,
        ))

    return product


@router.post("/admin/shopping/cj/import", status_code=201)
async def admin_cj_import(
    body: CJImportAdminIn,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_superuser),
):
    shop = _CATALOGUE
    conn = _get_system_cj_connection(db, shop)
    token = await _cj_ensure_token(conn, db)

    product = await _cj_import_one(db, shop, token, body.cj_pid, body.price, body.category_name)
    _ensure_prodora_codes(db)
    db.commit()
    background_tasks.add_task(_run_meta_ads_auto_attach, [product.id])
    product = db.query(Product).options(
        joinedload(Product.shop), joinedload(Product.category)
    ).filter(Product.id == product.id).first()
    return _shopping_product_out(product)


class CJBulkImportIn(BaseModel):
    cj_pids: List[str]
    category_name: Optional[str] = None  # overrides the supplier's own category


@router.post("/admin/shopping/cj/import-bulk", status_code=201)
async def admin_cj_import_bulk(
    body: CJBulkImportIn,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_superuser),
):
    """Imports several CJ products in one call — for the Trending/My CJ
    Products tabs' multi-select. Each pid succeeds or fails independently
    so one bad pid doesn't block the rest of the batch."""
    shop = _CATALOGUE
    conn = _get_system_cj_connection(db, shop)
    token = await _cj_ensure_token(conn, db)

    imported, failed = [], []
    for pid in body.cj_pids[:50]:
        try:
            product = await _cj_import_one(db, shop, token, pid, None, body.category_name)
            _ensure_prodora_codes(db)
            db.commit()
            imported.append(product.id)
        except Exception:
            db.rollback()
            failed.append(pid)
    if imported:
        background_tasks.add_task(_run_meta_ads_auto_attach, list(imported))
    return {"imported": imported, "failed": failed}


# ── Admin — AliExpress as a source for the Prodora catalog ──────────────────
# Reuses the same DropshipConnection + OAuth flow already built for regular
# sellers (dropshipping.py). The platform's connection has no shop (shop_id NULL)
# and is started from GET /admin/shopping/aliexpress/authorize below. The
# import endpoint is just the import step, mirroring
# admin_cj_import above — paste a link instead of picking from search,
# since AliExpress doesn't expose a catalog worth building a search UI
# against (see _aliexpress_fetch_product's docstring in dropshipping.py).

from app.api.v1.endpoints.dropshipping import (
    _parse_aliexpress_product_id, _aliexpress_ensure_token, _aliexpress_fetch_product,
    _aliexpress_search_products,
)


@router.get("/admin/shopping/aliexpress/status")
def admin_aliexpress_status(
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_superuser),
):
    """Whether the platform's AliExpress account is connected. Connecting goes
    through GET /admin/shopping/aliexpress/authorize."""
    shop = _CATALOGUE
    conn = db.query(DropshipConnection).filter(
        DropshipConnection.shop_id == shop.id,
        DropshipConnection.supplier_type == "aliexpress",
        DropshipConnection.is_active == True,
    ).first()
    return {"connected": conn is not None}


@router.get("/admin/shopping/aliexpress/authorize")
def admin_aliexpress_authorize(
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    """Start the AliExpress OAuth flow for the Prodora catalogue. Same flow a
    seller uses, but the resulting connection belongs to the platform (no shop)."""
    from app.api.v1.endpoints.dropshipping import ALIEXPRESS_APP_KEY, ALIEXPRESS_AUTHORIZE_URL, _aliexpress_callback_url

    if not ALIEXPRESS_APP_KEY:
        raise HTTPException(
            status_code=503,
            detail="AliExpress integration isn't configured yet — ExiusCart's app registration is still pending.",
        )
    if db.query(DropshipConnection).filter(
        DropshipConnection.shop_id.is_(None), DropshipConnection.supplier_type == "aliexpress",
        DropshipConnection.is_active == True,
    ).first():
        raise HTTPException(status_code=400, detail="Already connected to AliExpress")

    state = secrets.token_urlsafe(32)
    pending = db.query(DropshipConnection).filter(
        DropshipConnection.shop_id.is_(None), DropshipConnection.supplier_type == "aliexpress",
        DropshipConnection.is_active == False,
    ).first()
    if pending:
        pending.oauth_state = state
    else:
        db.add(DropshipConnection(shop_id=None, supplier_type="aliexpress", is_active=False, oauth_state=state))
    db.commit()

    params = {
        "response_type": "code",
        "force_auth": "true",
        "redirect_uri": _aliexpress_callback_url(),
        "client_id": ALIEXPRESS_APP_KEY,
        "state": state,
    }
    return {"authorize_url": f"{ALIEXPRESS_AUTHORIZE_URL}?{urlencode(params)}"}


@router.get("/admin/shopping/aliexpress/search")
async def admin_aliexpress_search(
    q: str = "",
    page: int = 1,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_superuser),
):
    """Real catalog search (aliexpress.ds.text.search), not the curated-feed
    system — that one needs business-team-granted feed names, this doesn't."""
    if not q.strip():
        return {"products": [], "total": 0, "page": page}
    shop = _CATALOGUE
    conn = db.query(DropshipConnection).filter(
        DropshipConnection.shop_id == shop.id, DropshipConnection.supplier_type == "aliexpress", DropshipConnection.is_active == True,
    ).first()
    if not conn:
        raise HTTPException(status_code=400, detail="AliExpress is not connected. Connect it from Add Products first.")
    token = await _aliexpress_ensure_token(conn, db)

    result = _aliexpress_search_products(token, q.strip(), page=page, currency=shop.currency or "USD")
    return {**result, "page": page}


class AliexpressImportAdminIn(BaseModel):
    product_url: str
    price: Optional[float] = None
    category_name: Optional[str] = None


@router.post("/admin/shopping/aliexpress/import", status_code=201)
async def admin_aliexpress_import(
    body: AliexpressImportAdminIn,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_superuser),
):
    shop = _CATALOGUE
    conn = db.query(DropshipConnection).filter(
        DropshipConnection.shop_id == shop.id, DropshipConnection.supplier_type == "aliexpress", DropshipConnection.is_active == True,
    ).first()
    if not conn:
        raise HTTPException(status_code=400, detail="AliExpress is not connected. Connect it from Add Products first.")
    token = await _aliexpress_ensure_token(conn, db)

    product_id = _parse_aliexpress_product_id(body.product_url)
    if not product_id:
        raise HTTPException(status_code=400, detail="Couldn't find a product ID in that link — paste the full AliExpress product page URL.")

    detail = _aliexpress_fetch_product(token, product_id, shop.currency or "USD")
    if not detail["variants"]:
        raise HTTPException(status_code=400, detail="This product has no purchasable variants — it may be unavailable for dropshipping.")

    primary = detail["variants"][0]
    final_price = body.price if body.price else round(primary["price"] * 2, 2)
    name = detail["name"]

    cat_id = None
    if body.category_name:
        cat_id = _get_or_create_category(db, shop.id, body.category_name).id

    product = Product(
        name=name,
        slug=_slugify_unique(name),
        description=_truncate_description(_strip_description_images(detail["description"]), DESCRIPTION_WORDS_DEFAULT) or name,
        price=final_price,
        cost_price=primary["price"] or None,
        sku=f"AE-{product_id}",
        image_url=detail["images"][0] if detail["images"] else None,
        source_url=body.product_url,
        quantity=0,
        category_id=cat_id,
        shop_id=shop.id,
        is_featured=False,
        is_trending=False,
        is_active=True,
        supplier_name="AliExpress",
    )
    db.add(product)
    db.flush()

    from app.models.product_fields import ProductImage
    from app.models.product_variant import ProductVariant

    for i, url in enumerate(detail["images"][:6]):
        db.add(ProductImage(product_id=product.id, url=url, sort_order=i, is_primary=(i == 0)))

    _preserve_unique_description_images(db, product, detail["description"], set(detail["images"][:6]))

    for v in detail["variants"]:
        label_parts = [p for p in (v["color"], v["size"]) if p]
        db.add(ProductVariant(
            product_id=product.id,
            color=(v["color"] or (" / ".join(label_parts) if label_parts else None) or "")[:100] or None,
            size=v["size"],
            sku=str(v["sku_id"]),
        ))

    # AliExpress order placement needs the specific sku_id, not the bare
    # product_id — same reasoning as CJ's variant vid link above.
    db.add(DropshipProductLink(
        shop_id=shop.id,
        product_id=product.id,
        supplier_type="aliexpress",
        supplier_product_id=product_id,
        supplier_product_url=body.product_url,
        supplier_sku=str(primary["sku_id"]),
        supplier_product_name=name,
        cost_price=primary["price"] or None,
        is_primary=True,
    ))

    db.flush()
    _ensure_prodora_codes(db)
    db.commit()
    background_tasks.add_task(_run_meta_ads_auto_attach, [product.id])
    product = db.query(Product).options(
        joinedload(Product.shop), joinedload(Product.category)
    ).filter(Product.id == product.id).first()
    return _shopping_product_out(product)


# ── Admin — Meta Ad Library search (real ads, Facebook + Instagram) ─────────
# Shared core lives in app/core/meta_ad_library.py — the seller-facing
# equivalent (endpoints/ad_intelligence.py) calls the exact same function,
# not a second copy of this httpx request.
from app.core.meta_ad_library import search_meta_ad_library


@router.get("/admin/shopping/meta-ads/search")
async def admin_meta_ads_search(
    q: str,
    country: str = "US",
    _: User = Depends(require_superuser),
):
    ads = await search_meta_ad_library(q, country)
    return {"ads": ads}


async def _run_meta_ads_auto_attach(product_ids: list[int]):
    """Runs after the request already returned — searches Meta Ad Library
    once per product, throttled, and attaches the first match's snapshot
    URL. Throttled (not fired all at once) since Meta's Ad Library API rate
    limit isn't publicly documented (only that error code 613 exists) —
    safer to go slow than to get the token flagged mid-batch on a large run.
    A single product's failure (no match, a transient error) just gets
    skipped and logged, never aborts the rest of the batch."""
    import asyncio
    from app.core import meta_ad_library as _mal
    if not _mal.META_AD_LIBRARY_TOKEN:
        logger.info("[Meta Ads auto-attach] skipped: META_AD_LIBRARY_TOKEN is not set")
        return
    db = SessionLocal()
    attached = 0
    try:
        for product_id in product_ids:
            product = db.query(Product).filter(Product.id == product_id).first()
            if not product or product.ad_facebook_url:
                continue
            try:
                ads = await search_meta_ad_library(product.name, "US", limit=1)
                if ads:
                    product.ad_facebook_url = ads[0]["snapshot_url"]
                    db.commit()
                    attached += 1
            except Exception as e:
                logger.warning(f"[Meta Ads auto-attach] product={product_id} failed: {e}")
            await asyncio.sleep(2)  # throttle — see docstring
    finally:
        logger.info(f"[Meta Ads auto-attach] batch of {len(product_ids)} done, {attached} attached")
        db.close()


@router.post("/admin/shopping/meta-ads/auto-attach")
def admin_meta_ads_auto_attach(
    background_tasks: BackgroundTasks,
    limit: int = 50,
    product_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    """Queues a throttled background search for products missing a Facebook
    ad link — returns immediately so the admin isn't stuck waiting (a run
    of, say, 1000 products takes ~30+ minutes at the throttled rate)."""
    from app.core import meta_ad_library as _mal
    if not _mal.META_AD_LIBRARY_TOKEN:
        raise HTTPException(status_code=400, detail={
            "error": "meta_not_configured",
            "message": "Meta Ad Library isn't connected yet, so no ads can be searched. It needs META_AD_LIBRARY_TOKEN from a verified Meta developer account.",
        })
    query = db.query(Product).filter(Product.shop_id.is_(None), Product.ad_facebook_url.is_(None))
    if product_id is not None:
        query = query.filter(Product.id == product_id)
    products = query.order_by(Product.created_at.desc()).limit(limit).all()
    product_ids = [p.id for p in products]
    background_tasks.add_task(_run_meta_ads_auto_attach, product_ids)
    return {"queued": len(product_ids)}


# ── NexCode Nova — One-time Client Codes ─────────────────────────────────────

import uuid as _uuid
import secrets as _secrets


def _generate_nexcode() -> str:
    """NEXC-XXXX-XXXX-XXXX format, 16 chars of randomness."""
    part = lambda: _secrets.token_hex(2).upper()
    return f"NEXC-{part()}-{part()}-{part()}"


class NexCodeCreate(BaseModel):
    client_email: Optional[str] = None
    plan_type: str = "scale"
    duration_months: Optional[int] = None   # None = lifetime
    max_uses: int = 1
    max_shops: int = 1
    notes: Optional[str] = None
    code_expires_days: Optional[int] = None  # days until code itself expires


@router.get("/admin/nexcodes")
def list_nexcodes(
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    codes = db.query(PartnerLicense).filter(
        PartnerLicense.partner_name == "nexcodenova"
    ).order_by(PartnerLicense.created_at.desc()).all()

    return [
        {
            "id": c.id,
            "code": c.code,
            "client_email": c.allowed_email,
            "plan_type": c.plan_type,
            "duration_months": c.duration_months,
            "max_uses": c.max_uses,
            "used_count": c.used_count,
            "max_shops": c.max_shops,
            "is_active": c.is_active,
            "notes": c.notes,
            "code_expires_at": c.code_expires_at,
            "created_at": c.created_at,
            "is_used_up": c.used_count >= c.max_uses,
        }
        for c in codes
    ]


@router.post("/admin/nexcodes", status_code=201)
def create_nexcode(
    data: NexCodeCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    code_value = _generate_nexcode()
    # Ensure uniqueness (extremely unlikely collision but handle it)
    while db.query(PartnerLicense).filter(PartnerLicense.code == code_value).first():
        code_value = _generate_nexcode()

    expires_at = None
    if data.code_expires_days:
        expires_at = datetime.now(timezone.utc) + timedelta(days=data.code_expires_days)

    license = PartnerLicense(
        code=code_value,
        partner_name="nexcodenova",
        plan_type=data.plan_type,
        duration_months=data.duration_months,
        max_uses=data.max_uses,
        used_count=0,
        allowed_email=data.client_email or None,
        max_shops=data.max_shops,
        is_active=True,
        notes=data.notes,
        code_expires_at=expires_at,
    )
    db.add(license)
    db.commit()
    db.refresh(license)

    return {
        "id": license.id,
        "code": license.code,
        "client_email": license.allowed_email,
        "plan_type": license.plan_type,
        "duration_months": license.duration_months,
        "max_uses": license.max_uses,
        "used_count": license.used_count,
        "max_shops": license.max_shops,
        "is_active": license.is_active,
        "notes": license.notes,
        "code_expires_at": license.code_expires_at,
        "created_at": license.created_at,
        "is_used_up": False,
    }


@router.put("/admin/nexcodes/{code_id}/toggle")
def toggle_nexcode(
    code_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    license = db.query(PartnerLicense).filter(
        PartnerLicense.id == code_id,
        PartnerLicense.partner_name == "nexcodenova",
    ).first()
    if not license:
        raise HTTPException(status_code=404, detail="Code not found")
    license.is_active = not license.is_active
    db.commit()
    return {"id": license.id, "is_active": license.is_active}


# ── Admin Settings ────────────────────────────────────────────────────────────

def _get_or_create_settings(db: Session) -> AdminSettings:
    settings = db.query(AdminSettings).filter(AdminSettings.id == 1).first()
    if not settings:
        settings = AdminSettings(id=1)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def _settings_out(s: AdminSettings) -> dict:
    return {
        "platform_name": s.platform_name,
        "support_email": s.support_email,
        "contact_phone": s.contact_phone,
        "website_url": s.website_url,
        "platform_description": s.platform_description,
        "notify_new_store": s.notify_new_store,
        "notify_payment_received": s.notify_payment_received,
        "notify_payment_pending": s.notify_payment_pending,
        "notify_subscription_expiring": s.notify_subscription_expiring,
        "notify_support_tickets": s.notify_support_tickets,
        "alert_system_errors": s.alert_system_errors,
        "alert_high_traffic": s.alert_high_traffic,
        "alert_failed_logins": s.alert_failed_logins,
        "notification_email_primary": s.notification_email_primary,
        "notification_email_secondary": s.notification_email_secondary,
        "require_2fa_admins": s.require_2fa_admins,
        "require_2fa_store_owners": s.require_2fa_store_owners,
        "session_timeout_minutes": s.session_timeout_minutes,
        "max_active_sessions": s.max_active_sessions,
        "lemonsqueezy_api_key": ("*" * 12 + s.lemonsqueezy_api_key[-4:]) if s.lemonsqueezy_api_key and len(s.lemonsqueezy_api_key) > 4 else s.lemonsqueezy_api_key,
        "lemonsqueezy_store_id": s.lemonsqueezy_store_id,
        "lemonsqueezy_webhook_secret": ("*" * 12) if s.lemonsqueezy_webhook_secret else "",
        "bank_transfer_enabled": s.bank_transfer_enabled,
        "bank_name": s.bank_name,
        "account_name": s.account_name,
        "account_number": s.account_number,
        "iban": s.iban,
        "swift_code": s.swift_code,
        "branch": s.branch,
        "invoice_prefix": s.invoice_prefix,
        "vat_number": s.vat_number,
        "vat_rate_aed": s.vat_rate_aed,
        "vat_rate_usd": s.vat_rate_usd,
        "auto_generate_invoices": s.auto_generate_invoices,
    }


class SettingsUpdate(BaseModel):
    platform_name: Optional[str] = None
    support_email: Optional[str] = None
    contact_phone: Optional[str] = None
    website_url: Optional[str] = None
    platform_description: Optional[str] = None
    notify_new_store: Optional[bool] = None
    notify_payment_received: Optional[bool] = None
    notify_payment_pending: Optional[bool] = None
    notify_subscription_expiring: Optional[bool] = None
    notify_support_tickets: Optional[bool] = None
    alert_system_errors: Optional[bool] = None
    alert_high_traffic: Optional[bool] = None
    alert_failed_logins: Optional[bool] = None
    notification_email_primary: Optional[str] = None
    notification_email_secondary: Optional[str] = None
    require_2fa_admins: Optional[bool] = None
    require_2fa_store_owners: Optional[bool] = None
    session_timeout_minutes: Optional[int] = None
    max_active_sessions: Optional[int] = None
    lemonsqueezy_api_key: Optional[str] = None
    lemonsqueezy_store_id: Optional[str] = None
    lemonsqueezy_webhook_secret: Optional[str] = None
    bank_transfer_enabled: Optional[bool] = None
    bank_name: Optional[str] = None
    account_name: Optional[str] = None
    account_number: Optional[str] = None
    iban: Optional[str] = None
    swift_code: Optional[str] = None
    branch: Optional[str] = None
    invoice_prefix: Optional[str] = None
    vat_number: Optional[str] = None
    vat_rate_aed: Optional[float] = None
    vat_rate_usd: Optional[float] = None
    auto_generate_invoices: Optional[bool] = None


@router.get("/admin/settings")
def get_settings(
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    return _settings_out(_get_or_create_settings(db))


@router.put("/admin/settings")
def update_settings(
    data: SettingsUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    settings = _get_or_create_settings(db)
    for field, value in data.model_dump(exclude_unset=True).items():
        # Skip masked values (don't overwrite with asterisks)
        if value and isinstance(value, str) and set(value) == {"*"}:
            continue
        setattr(settings, field, value)
    db.commit()
    db.refresh(settings)
    return _settings_out(settings)


@router.delete("/admin/nexcodes/{code_id}", status_code=204)
def delete_nexcode(
    code_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    license = db.query(PartnerLicense).filter(
        PartnerLicense.id == code_id,
        PartnerLicense.partner_name == "nexcodenova",
    ).first()
    if not license:
        raise HTTPException(status_code=404, detail="Code not found")
    db.delete(license)
    db.commit()
