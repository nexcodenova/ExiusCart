from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date, datetime, timezone
import uuid

from app.core.database import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.shop import Shop
from app.models.quotation import Quotation
from app.models.subscription import Subscription
from app.core.email import send_quotation_email
from pydantic import BaseModel

router = APIRouter()


# ── Schemas ────────────────────────────────────────────────────────────────────

class QuotationItem(BaseModel):
    product_id: Optional[int] = None
    name: str
    sku: Optional[str] = None
    quantity_available: Optional[int] = None
    qty: int
    unit_price: float
    total: float


class QuotationCreate(BaseModel):
    customer_name: str
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    items: list[QuotationItem]
    subtotal: float
    discount: float = 0
    tax: float = 0
    total: float
    notes: Optional[str] = None
    valid_until: date


class QuotationStatusUpdate(BaseModel):
    status: str


# ── Helpers ────────────────────────────────────────────────────────────────────

def _get_shop(shop_id: int, user: User, db: Session) -> Shop:
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


def _is_premium(shop: Shop, db: Session) -> bool:
    sub = db.query(Subscription).filter(
        Subscription.shop_id == shop.id,
        Subscription.status == "active",
    ).first()
    if not sub:
        return False
    return sub.plan_type in ("premium", "thedersi_pro")


def _next_quote_number(shop_id: int, db: Session) -> str:
    year = datetime.now(timezone.utc).year
    prefix = f"QT-{year}-"
    last = (
        db.query(Quotation)
        .filter(Quotation.shop_id == shop_id, Quotation.quote_number.like(f"{prefix}%"))
        .order_by(Quotation.id.desc())
        .first()
    )
    seq = 1
    if last:
        try:
            seq = int(last.quote_number.split("-")[-1]) + 1
        except ValueError:
            pass
    return f"{prefix}{seq:04d}"


def _serialize(q: Quotation) -> dict:
    shop = q.shop
    return {
        "id": q.id,
        "quote_number": q.quote_number,
        "shop_id": q.shop_id,
        "shop_name": shop.name if shop else "",
        "shop_logo": shop.logo_url if shop else None,
        "customer_name": q.customer_name,
        "customer_email": q.customer_email,
        "customer_phone": q.customer_phone,
        "items": q.items,
        "subtotal": float(q.subtotal),
        "discount": float(q.discount),
        "tax": float(q.tax),
        "total": float(q.total),
        "notes": q.notes,
        "status": q.status,
        "valid_until": q.valid_until.isoformat() if q.valid_until else None,
        "created_at": q.created_at.isoformat() if q.created_at else None,
        "currency": shop.currency if shop else "USD",
    }


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/shops/{shop_id}/quotations")
def list_quotations(
    shop_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_shop(shop_id, current_user, db)
    rows = db.query(Quotation).filter(Quotation.shop_id == shop_id).order_by(Quotation.id.desc()).all()
    return [_serialize(q) for q in rows]


@router.post("/shops/{shop_id}/quotations", status_code=status.HTTP_201_CREATED)
def create_quotation(
    shop_id: int,
    data: QuotationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_shop(shop_id, current_user, db)
    q = Quotation(
        quote_number=_next_quote_number(shop_id, db),
        shop_id=shop_id,
        customer_name=data.customer_name,
        customer_email=data.customer_email,
        customer_phone=data.customer_phone,
        items=[i.model_dump() for i in data.items],
        subtotal=data.subtotal,
        discount=data.discount,
        tax=data.tax,
        total=data.total,
        notes=data.notes,
        valid_until=data.valid_until,
    )
    db.add(q)
    db.commit()
    db.refresh(q)
    return _serialize(q)


@router.get("/shops/{shop_id}/quotations/{quote_id}")
def get_quotation(
    shop_id: int,
    quote_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_shop(shop_id, current_user, db)
    q = db.query(Quotation).filter(Quotation.id == quote_id, Quotation.shop_id == shop_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Quotation not found")
    return _serialize(q)


@router.patch("/shops/{shop_id}/quotations/{quote_id}/status")
def update_status(
    shop_id: int,
    quote_id: int,
    data: QuotationStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_shop(shop_id, current_user, db)
    q = db.query(Quotation).filter(Quotation.id == quote_id, Quotation.shop_id == shop_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Quotation not found")
    allowed = {"pending", "accepted", "rejected", "expired"}
    if data.status not in allowed:
        raise HTTPException(status_code=400, detail=f"Status must be one of {allowed}")
    q.status = data.status
    db.commit()
    return {"status": q.status}


@router.delete("/shops/{shop_id}/quotations/{quote_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quotation(
    shop_id: int,
    quote_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_shop(shop_id, current_user, db)
    q = db.query(Quotation).filter(Quotation.id == quote_id, Quotation.shop_id == shop_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Quotation not found")
    db.delete(q)
    db.commit()


@router.post("/shops/{shop_id}/quotations/{quote_id}/send")
def send_quotation(
    shop_id: int,
    quote_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = _get_shop(shop_id, current_user, db)

    if not _is_premium(shop, db):
        raise HTTPException(
            status_code=403,
            detail="Sending quotations by email is a Premium feature. Upgrade your plan to unlock it."
        )

    q = db.query(Quotation).filter(Quotation.id == quote_id, Quotation.shop_id == shop_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Quotation not found")
    if not q.customer_email:
        raise HTTPException(status_code=400, detail="This quotation has no customer email address")

    send_quotation_email(
        to_email=q.customer_email,
        customer_name=q.customer_name,
        shop_name=shop.name,
        shop_logo_url=shop.logo_url,
        quote_number=q.quote_number,
        items=q.items,
        subtotal=float(q.subtotal),
        discount=float(q.discount),
        tax=float(q.tax),
        total=float(q.total),
        valid_until=q.valid_until.strftime("%B %d, %Y") if q.valid_until else "",
        notes=q.notes,
        currency=shop.currency or "USD",
    )
    return {"sent": True}
