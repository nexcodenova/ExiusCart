from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date, datetime, timezone
import secrets

from app.core.database import get_db
from app.api.v1.deps import get_current_user
from app.api.v1.endpoints.usage import check_and_log_email
from app.models.user import User
from app.models.shop import Shop
from app.models.quotation import Quotation
from app.models.subscription import Subscription
from app.core.email import send_quotation_email, send_payment_reminder_email
from pydantic import BaseModel

router = APIRouter()


# ── Schemas ────────────────────────────────────────────────────────────────────

class QuotationRow(BaseModel):
    type: str = 'item'                      # 'item' | 'section'
    section_title: Optional[str] = None     # for section rows
    product_id: Optional[int] = None
    name: Optional[str] = None
    description: Optional[str] = None
    unit: Optional[str] = None              # pcs, hrs, days, months, etc.
    sku: Optional[str] = None
    quantity_available: Optional[int] = None
    qty: float = 1
    unit_price: float = 0
    total: float = 0
    is_optional: bool = False


class QuotationCreate(BaseModel):
    customer_name: str
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_company: Optional[str] = None
    items: list[QuotationRow]
    subtotal: float
    discount: float = 0
    tax: float = 0
    tax_rate: float = 0
    tax_type: str = 'fixed'
    total: float
    notes: Optional[str] = None
    terms: Optional[str] = None
    payment_schedule: Optional[list] = None
    company_address: Optional[str] = None
    company_trn: Optional[str] = None
    company_bank: Optional[str] = None
    valid_until: date


class QuotationStatusUpdate(BaseModel):
    status: str


# ── Helpers ────────────────────────────────────────────────────────────────────

def _get_shop(shop_id: int, user: User, db: Session) -> Shop:
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


def _get_plan(shop_id: int, db: Session) -> str | None:
    sub = db.query(Subscription).filter(Subscription.shop_id == shop_id).first()
    return sub.plan_type if sub else None


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
        "customer_company": getattr(q, 'customer_company', None),
        "items": q.items,
        "subtotal": float(q.subtotal),
        "discount": float(q.discount),
        "tax": float(q.tax),
        "tax_rate": float(q.tax_rate or 0),
        "tax_type": q.tax_type or 'fixed',
        "total": float(q.total),
        "notes": q.notes,
        "terms": q.terms,
        "payment_schedule": q.payment_schedule,
        "company_address": q.company_address,
        "company_trn": q.company_trn,
        "company_bank": q.company_bank,
        "client_token": q.client_token,
        "client_accepted_at": q.client_accepted_at.isoformat() if q.client_accepted_at else None,
        "client_accepted_name": q.client_accepted_name,
        "status": q.status,
        "valid_until": q.valid_until.isoformat() if q.valid_until else None,
        "created_at": q.created_at.isoformat() if q.created_at else None,
        "currency": shop.currency if shop else "USD",
        "reminder_count": q.reminder_count or 0,
        "last_reminded_at": q.last_reminded_at.isoformat() if q.last_reminded_at else None,
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
        tax_rate=data.tax_rate,
        tax_type=data.tax_type,
        total=data.total,
        notes=data.notes,
        terms=data.terms,
        payment_schedule=data.payment_schedule,
        company_address=data.company_address,
        company_trn=data.company_trn,
        company_bank=data.company_bank,
        valid_until=data.valid_until,
        client_token=secrets.token_urlsafe(32),
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
    plan = _get_plan(shop_id, db)

    q = db.query(Quotation).filter(Quotation.id == quote_id, Quotation.shop_id == shop_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Quotation not found")
    if not q.customer_email:
        raise HTTPException(status_code=400, detail="This quotation has no customer email address")

    check_and_log_email(shop_id, "quotation", plan, q.customer_email, q.id, db)

    client_link = f"https://store.exiuscart.com/q/{q.client_token}" if q.client_token else None

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
        client_link=client_link,
        shop_id=shop_id,
    )
    return {"sent": True}


@router.post("/shops/{shop_id}/quotations/{quote_id}/reminder")
def send_reminder(
    shop_id: int,
    quote_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = _get_shop(shop_id, current_user, db)

    q = db.query(Quotation).filter(Quotation.id == quote_id, Quotation.shop_id == shop_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Quotation not found")
    if not q.customer_email:
        raise HTTPException(status_code=400, detail="This quotation has no customer email address")
    if q.status not in ("pending",):
        raise HTTPException(status_code=400, detail="Reminders can only be sent for pending quotations")

    q.reminder_count = (q.reminder_count or 0) + 1
    q.last_reminded_at = datetime.now(timezone.utc)
    db.commit()

    client_link = f"https://store.exiuscart.com/q/{q.client_token}" if q.client_token else None

    send_payment_reminder_email(
        to_email=q.customer_email,
        customer_name=q.customer_name,
        shop_name=shop.name,
        shop_logo_url=shop.logo_url,
        quote_number=q.quote_number,
        total=float(q.total),
        valid_until=q.valid_until.strftime("%B %d, %Y") if q.valid_until else "",
        reminder_count=q.reminder_count,
        currency=shop.currency or "USD",
        client_link=client_link,
        shop_id=shop_id,
    )
    return {"sent": True, "reminder_count": q.reminder_count}
