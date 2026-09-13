"""
Discount code validation — one real chokepoint shared by the storefront
checkout and POS (and anywhere else that later needs it), so "is this code
valid right now, for this order" is answered exactly once, not re-implemented
per caller. Raises a clear HTTPException on any invalid state (unknown code,
inactive, outside its date window, usage limit reached, order below its
minimum) rather than silently applying nothing.

v1 is direct-store + POS only — see models/discount.py.
"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.discount import Discount


def find_active_discount(db: Session, shop_id: int, code: str) -> Discount:
    normalized = (code or "").strip().upper()
    if not normalized:
        raise HTTPException(status_code=422, detail="Enter a discount code.")

    discount = db.query(Discount).filter(
        Discount.shop_id == shop_id, Discount.code == normalized,
    ).first()
    if not discount:
        raise HTTPException(status_code=404, detail={"error": "discount_not_found", "message": "That discount code doesn't exist."})
    if not discount.is_active:
        raise HTTPException(status_code=400, detail={"error": "discount_inactive", "message": "This discount code is no longer active."})

    now = datetime.now(timezone.utc)
    if discount.starts_at and now < discount.starts_at:
        raise HTTPException(status_code=400, detail={"error": "discount_not_started", "message": "This discount code isn't active yet."})
    if discount.ends_at and now > discount.ends_at:
        raise HTTPException(status_code=400, detail={"error": "discount_expired", "message": "This discount code has expired."})
    if discount.usage_limit is not None and discount.times_used >= discount.usage_limit:
        raise HTTPException(status_code=400, detail={"error": "discount_limit_reached", "message": "This discount code has reached its usage limit."})

    return discount


def compute_discount_amount(discount: Discount, subtotal: Decimal) -> Decimal:
    if discount.min_order_amount is not None and subtotal < Decimal(str(discount.min_order_amount)):
        raise HTTPException(status_code=400, detail={
            "error": "discount_min_not_met",
            "message": f"This code needs an order of at least {discount.min_order_amount:g} to apply.",
        })

    if discount.discount_type == "percentage":
        amount = subtotal * Decimal(str(discount.value)) / Decimal("100")
    else:
        amount = Decimal(str(discount.value))

    # Never let a discount make the order negative, and never exceed the
    # subtotal it's discounting off of.
    return min(amount, subtotal)


def validate_and_compute_discount(db: Session, shop_id: int, code: str, subtotal: Decimal) -> tuple[Discount, Decimal]:
    discount = find_active_discount(db, shop_id, code)
    amount = compute_discount_amount(discount, subtotal)
    return discount, amount


def record_discount_usage(db: Session, discount: Discount) -> None:
    """Call once, after the order this discount applied to is actually
    committed — not at validation time, so an abandoned/failed checkout
    never burns a use."""
    discount.times_used = (discount.times_used or 0) + 1
