"""
Usage tracking — per-shop monthly limits for emails, orders, and products.
All counters reset on the 1st of each calendar month.
"""
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.shop import Shop
from app.models.subscription import Subscription
from app.models.order import Order
from app.models.product import Product
from app.models.email_usage_log import EmailUsageLog

router = APIRouter()

# ── Plan limits ───────────────────────────────────────────────────────────────

EMAIL_LIMITS: dict[str, dict] = {
    "invoice": {
        "free_trial":            50,
        "thedersi_free_forever": 50,
        "thedersi_lite":         250,
        "launch":                1000,
        "growth":                5000,
        "scale":                 None,
    },
    "quotation": {
        "free_trial":            10,
        "thedersi_free_forever": 10,
        "thedersi_lite":         50,
        "launch":                100,    # TheDersi Pro shares this plan_type but gets its
        "growth":                1000,   # own 500/mo override — see is_thedersi_pro_shop
        "scale":                 None,   # check in quotations.py's send endpoint.
    },
    "marketing": {
        "free_trial":            0,
        "thedersi_free_forever": 10,
        "thedersi_lite":         100,
        "launch":                250,
        "growth":                1000,
        "scale":                 None,
    },
}

# Note: TheDersi Pro (plan_type="launch") shows Launch's own limits here —
# this is a usage-dashboard *display* table, not an enforcement gate (that's
# MONTHLY_ORDER_LIMITS in app/core/thedersi.py, which does special-case
# Pro's unlimited orders via is_thedersi_pro_shop()). Not worth threading a
# shop-aware override through every display table for a usage-page number.
ORDER_LIMITS: dict = {
    "free_trial":            50,
    "thedersi_free_forever": 25,
    "thedersi_lite":         500,
    "launch":                1000,
    "growth":                5000,
    "scale":                 None,
}

PRODUCT_LIMITS: dict = {
    "free_trial":            25,
    "thedersi_free_forever": 25,
    "thedersi_lite":         500,
    "launch":                1000,
    "growth":                10000,
    "scale":                 None,
}


def _get_limit(table: dict, plan: str | None) -> int | None:
    return table.get(plan or "free_trial", table.get("free_trial"))


def _month_start() -> datetime:
    now = datetime.now(timezone.utc)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _reset_label() -> str:
    now = datetime.now(timezone.utc)
    first_next = (now.replace(day=1) + timedelta(days=32)).replace(
        day=1, hour=0, minute=0, second=0, microsecond=0
    )
    return first_next.strftime("%b 1")


# ── Public helpers (called from orders.py / quotations.py) ────────────────────

def check_and_log_email(
    shop_id: int,
    email_type: str,
    plan: str | None,
    recipient: str,
    reference_id: int | None,
    db: Session,
    limit_override: int | None = None,
) -> None:
    """Raise 429 if monthly limit reached; otherwise log the send.

    limit_override lets a caller give a shop its own number instead of the
    plan's shared default — e.g. TheDersi Pro shares plan_type="launch" with
    real Launch customers but gets its own quotation-email allowance.
    """
    limit = limit_override if limit_override is not None else _get_limit(EMAIL_LIMITS[email_type], plan)

    if limit == 0:
        raise HTTPException(
            status_code=403,
            detail=f"Your plan does not include {email_type} emails. Upgrade to enable this.",
        )

    if limit is not None:
        used = db.query(func.count(EmailUsageLog.id)).filter(
            EmailUsageLog.shop_id == shop_id,
            EmailUsageLog.email_type == email_type,
            EmailUsageLog.sent_at >= _month_start(),
        ).scalar() or 0
        if used >= limit:
            raise HTTPException(
                status_code=429,
                detail=f"Monthly {email_type} email limit of {limit} reached. Upgrade your plan to continue.",
            )

    db.add(EmailUsageLog(
        shop_id=shop_id,
        email_type=email_type,
        recipient_email=recipient,
        reference_id=reference_id,
    ))
    db.commit()


# ── Usage endpoint ────────────────────────────────────────────────────────────

@router.get("/shops/{shop_id}/usage")
def get_usage(
    shop_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    sub = db.query(Subscription).filter(Subscription.shop_id == shop_id).first()
    plan = sub.plan_type if sub else None

    month_start = _month_start()

    # Email counts by type
    rows = db.query(
        EmailUsageLog.email_type,
        func.count(EmailUsageLog.id),
    ).filter(
        EmailUsageLog.shop_id == shop_id,
        EmailUsageLog.sent_at >= month_start,
    ).group_by(EmailUsageLog.email_type).all()
    email_used = {et: cnt for et, cnt in rows}

    # Order count this month — POS orders are unlimited and not counted
    order_used = db.query(func.count(Order.id)).filter(
        Order.shop_id == shop_id,
        Order.source != "pos",
        Order.created_at >= month_start,
    ).scalar() or 0

    # Active product count
    product_used = db.query(func.count(Product.id)).filter(
        Product.shop_id == shop_id,
        Product.is_active == True,
    ).scalar() or 0

    return {
        "plan": plan,
        "reset_label": _reset_label(),
        "emails": {
            "invoice":   {"used": email_used.get("invoice", 0),   "limit": _get_limit(EMAIL_LIMITS["invoice"],   plan)},
            "quotation": {"used": email_used.get("quotation", 0), "limit": _get_limit(EMAIL_LIMITS["quotation"], plan)},
            "marketing": {"used": email_used.get("marketing", 0), "limit": _get_limit(EMAIL_LIMITS["marketing"], plan)},
        },
        "orders":   {"used": order_used,   "limit": _get_limit(ORDER_LIMITS,   plan)},
        "products": {"used": product_used, "limit": _get_limit(PRODUCT_LIMITS, plan)},
    }
