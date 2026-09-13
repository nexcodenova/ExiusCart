from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import Optional
from datetime import datetime, timezone
from pydantic import BaseModel

from app.core.database import get_db
from app.models.user import User
from app.models.shop import Shop
from app.models.discount import Discount
from app.schemas.discount import DiscountCreate, DiscountUpdate, DiscountResponse
from app.core.discounts import validate_and_compute_discount
from app.api.v1.deps import get_current_user

router = APIRouter()


def _shop_or_404(shop_id: int, user: User, db: Session) -> Shop:
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


def _status_of(d: Discount) -> str:
    if not d.is_active:
        return "inactive"
    now = datetime.now(timezone.utc)
    if d.starts_at and now < d.starts_at:
        return "scheduled"
    if d.ends_at and now > d.ends_at:
        return "expired"
    if d.usage_limit is not None and d.times_used >= d.usage_limit:
        return "limit_reached"
    return "active"


def _out(d: Discount) -> dict:
    return {
        "id": d.id,
        "shop_id": d.shop_id,
        "code": d.code,
        "discount_type": d.discount_type,
        "value": float(d.value),
        "min_order_amount": float(d.min_order_amount) if d.min_order_amount is not None else None,
        "usage_limit": d.usage_limit,
        "times_used": d.times_used,
        "starts_at": d.starts_at.isoformat() if d.starts_at else None,
        "ends_at": d.ends_at.isoformat() if d.ends_at else None,
        "is_active": d.is_active,
        "status": _status_of(d),
        "created_at": d.created_at.isoformat() if d.created_at else None,
    }


@router.post("/shops/{shop_id}/discounts", status_code=status.HTTP_201_CREATED)
def create_discount(
    shop_id: int,
    data: DiscountCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _shop_or_404(shop_id, current_user, db)
    discount = Discount(
        shop_id=shop_id,
        code=data.code,
        discount_type=data.discount_type,
        value=data.value,
        min_order_amount=data.min_order_amount,
        usage_limit=data.usage_limit,
        starts_at=data.starts_at,
        ends_at=data.ends_at,
        is_active=data.is_active,
    )
    db.add(discount)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=f"A discount code '{data.code}' already exists.")
    db.refresh(discount)
    return _out(discount)


@router.get("/shops/{shop_id}/discounts")
def list_discounts(
    shop_id: int,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _shop_or_404(shop_id, current_user, db)
    query = db.query(Discount).filter(Discount.shop_id == shop_id)
    if search:
        query = query.filter(Discount.code.ilike(f"%{search.strip().upper()}%"))
    discounts = query.order_by(Discount.created_at.desc()).all()
    return [_out(d) for d in discounts]


@router.put("/shops/{shop_id}/discounts/{discount_id}")
def update_discount(
    shop_id: int,
    discount_id: int,
    data: DiscountUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _shop_or_404(shop_id, current_user, db)
    discount = db.query(Discount).filter(Discount.id == discount_id, Discount.shop_id == shop_id).first()
    if not discount:
        raise HTTPException(status_code=404, detail="Discount not found")

    update_data = data.model_dump(exclude_unset=True)
    if "code" in update_data and update_data["code"]:
        update_data["code"] = update_data["code"].strip().upper()
    for field, value in update_data.items():
        setattr(discount, field, value)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=f"A discount code '{update_data.get('code')}' already exists.")
    db.refresh(discount)
    return _out(discount)


class DiscountValidateIn(BaseModel):
    code: str
    subtotal: float


@router.post("/shops/{shop_id}/discounts/validate")
def validate_discount(
    shop_id: int,
    data: DiscountValidateIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Same real validation the storefront checkout runs — used by POS so
    a cashier can redeem a specific code, on top of the manual %/fixed
    discount POS already supports."""
    from decimal import Decimal
    _shop_or_404(shop_id, current_user, db)
    discount, amount = validate_and_compute_discount(db, shop_id, data.code, Decimal(str(data.subtotal)))
    return {
        "code": discount.code,
        "discount_type": discount.discount_type,
        "value": float(discount.value),
        "discount_amount": float(amount),
    }


@router.delete("/shops/{shop_id}/discounts/{discount_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_discount(
    shop_id: int,
    discount_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _shop_or_404(shop_id, current_user, db)
    discount = db.query(Discount).filter(Discount.id == discount_id, Discount.shop_id == shop_id).first()
    if not discount:
        raise HTTPException(status_code=404, detail="Discount not found")
    db.delete(discount)
    db.commit()
