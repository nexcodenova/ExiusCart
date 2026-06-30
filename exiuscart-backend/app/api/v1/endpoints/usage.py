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
        "free_trial":     50,
        "thedersi_basic": 50,
        "starter":        1000,
        "thedersi_pro":   None,   # unlimited
        "premium":        None,
    },
    "quotation": {
        "free_trial":     10,
        "thedersi_basic": 10,
        "starter":        100,
        "thedersi_pro":   None,
        "premium":        None,
    },
    "marketing": {
        "free_trial":     0,
        "thedersi_basic": 0,
        "starter":        200,
        "thedersi_pro":   None,
        "premium":        None,
    },
}

ORDER_LIMITS: dict = {
    "free_trial":     50,
    "thedersi_basic": 50,
    "starter":        1000,
    "thedersi_pro":   None,
    "premium":        None,
}

PRODUCT_LIMITS: dict = {
    "free_trial":     25,
    "thedersi_basic": 25,
    "starter":        1000,
    "thedersi_pro":   1000,
    "premium":        None,
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
) -> None:
    """Raise 429 if monthly limit reached; otherwise log the send."""
    limit = _get_limit(EMAIL_LIMITS[email_type], plan)

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

    # Order count this month
    order_used = db.query(func.count(Order.id)).filter(
        Order.shop_id == shop_id,
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
