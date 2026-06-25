from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.reservation import Reservation
from app.models.product import Product

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class ReservationCreate(BaseModel):
    customer_name: str
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    product_id: Optional[int] = None
    product_name: str
    quantity: int = 1
    reservation_type: str  # 'soft_hold' | 'confirmed'
    notes: Optional[str] = None
    lpo_number: Optional[str] = None
    advance_amount: Optional[float] = None


class ReservationUpdate(BaseModel):
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    quantity: Optional[int] = None
    reservation_type: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    lpo_number: Optional[str] = None
    advance_amount: Optional[float] = None


def _auto_expire(r: Reservation) -> Reservation:
    """Mark soft_hold as expired if past expires_at."""
    if (
        r.status == "active"
        and r.reservation_type == "soft_hold"
        and r.expires_at
        and r.expires_at < datetime.utcnow()
    ):
        r.status = "expired"
    return r


def _serialize(r: Reservation) -> dict:
    return {
        "id": r.id,
        "customer_name": r.customer_name,
        "customer_phone": r.customer_phone,
        "customer_email": r.customer_email,
        "product_id": r.product_id,
        "product_name": r.product_name,
        "quantity": r.quantity,
        "reservation_type": r.reservation_type,
        "status": r.status,
        "notes": r.notes,
        "expires_at": r.expires_at.isoformat() if r.expires_at else None,
        "lpo_number": r.lpo_number,
        "advance_amount": float(r.advance_amount) if r.advance_amount else None,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/shops/{shop_id}/reservations")
def list_reservations(
    shop_id: int,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = db.query(Reservation).filter(Reservation.shop_id == shop_id)
    rows = q.order_by(Reservation.created_at.desc()).all()

    # auto-expire soft holds in-memory and persist
    updated = []
    for r in rows:
        before = r.status
        _auto_expire(r)
        if r.status != before:
            updated.append(r)
    if updated:
        db.commit()

    if status:
        rows = [r for r in rows if r.status == status]

    return [_serialize(r) for r in rows]


@router.get("/shops/{shop_id}/reservations/summary")
def reservation_summary(
    shop_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    rows = db.query(Reservation).filter(Reservation.shop_id == shop_id).all()
    for r in rows:
        _auto_expire(r)
    db.commit()

    active = [r for r in rows if r.status == "active"]
    soft = [r for r in active if r.reservation_type == "soft_hold"]
    confirmed = [r for r in active if r.reservation_type == "confirmed"]
    expiring_today = [r for r in soft if r.expires_at and r.expires_at.date() == datetime.utcnow().date()]

    return {
        "total_active": len(active),
        "soft_holds": len(soft),
        "confirmed": len(confirmed),
        "expiring_today": len(expiring_today),
        "soft_hold_qty": sum(r.quantity for r in soft),
        "confirmed_qty": sum(r.quantity for r in confirmed),
    }


@router.post("/shops/{shop_id}/reservations", status_code=201)
def create_reservation(
    shop_id: int,
    body: ReservationCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if body.reservation_type not in ("soft_hold", "confirmed"):
        raise HTTPException(400, "reservation_type must be 'soft_hold' or 'confirmed'")
    if body.quantity < 1:
        raise HTTPException(400, "quantity must be at least 1")

    expires_at = datetime.utcnow() + timedelta(days=2) if body.reservation_type == "soft_hold" else None

    r = Reservation(
        shop_id=shop_id,
        customer_name=body.customer_name,
        customer_phone=body.customer_phone,
        customer_email=body.customer_email,
        product_id=body.product_id,
        product_name=body.product_name,
        quantity=body.quantity,
        reservation_type=body.reservation_type,
        status="active",
        notes=body.notes,
        expires_at=expires_at,
        lpo_number=body.lpo_number,
        advance_amount=body.advance_amount,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return _serialize(r)


@router.patch("/shops/{shop_id}/reservations/{reservation_id}")
def update_reservation(
    shop_id: int,
    reservation_id: int,
    body: ReservationUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    r = db.query(Reservation).filter(
        Reservation.id == reservation_id, Reservation.shop_id == shop_id
    ).first()
    if not r:
        raise HTTPException(404, "Reservation not found")

    if body.customer_name is not None:
        r.customer_name = body.customer_name
    if body.customer_phone is not None:
        r.customer_phone = body.customer_phone
    if body.customer_email is not None:
        r.customer_email = body.customer_email
    if body.quantity is not None:
        r.quantity = body.quantity
    if body.notes is not None:
        r.notes = body.notes
    if body.lpo_number is not None:
        r.lpo_number = body.lpo_number
    if body.advance_amount is not None:
        r.advance_amount = body.advance_amount
    if body.status is not None:
        r.status = body.status
    if body.reservation_type is not None:
        r.reservation_type = body.reservation_type
        # upgrading soft_hold → confirmed: clear expiry
        if body.reservation_type == "confirmed":
            r.expires_at = None
        elif body.reservation_type == "soft_hold" and not r.expires_at:
            r.expires_at = datetime.utcnow() + timedelta(days=2)

    db.commit()
    db.refresh(r)
    return _serialize(r)


@router.delete("/shops/{shop_id}/reservations/{reservation_id}", status_code=204)
def delete_reservation(
    shop_id: int,
    reservation_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    r = db.query(Reservation).filter(
        Reservation.id == reservation_id, Reservation.shop_id == shop_id
    ).first()
    if not r:
        raise HTTPException(404, "Reservation not found")
    db.delete(r)
    db.commit()
