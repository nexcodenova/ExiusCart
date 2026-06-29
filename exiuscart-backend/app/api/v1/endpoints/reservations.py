import uuid
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.api.v1.deps import get_current_user
from app.models.reservation import Reservation
from app.models.product import Product
from app.models.order import Order, OrderItem
from app.models.customer import Customer
from app.api.v1.endpoints.channels import _bg_push_stock

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
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    r = db.query(Reservation).filter(
        Reservation.id == reservation_id, Reservation.shop_id == shop_id
    ).first()
    if not r:
        raise HTTPException(404, "Reservation not found")

    old_status = r.status
    old_type = r.reservation_type

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
    stock_changed = False
    if body.reservation_type is not None and body.reservation_type != old_type:
        r.reservation_type = body.reservation_type
        if body.reservation_type == "confirmed":
            # Upgrading soft_hold → confirmed: commit stock, clear expiry
            r.expires_at = None
            if r.product_id and old_status == "active":
                product = db.query(Product).filter(
                    Product.id == r.product_id, Product.shop_id == shop_id
                ).first()
                if product:
                    product.quantity = max(0, (product.quantity or 0) - r.quantity)
                    stock_changed = True
        elif body.reservation_type == "soft_hold":
            if not r.expires_at:
                r.expires_at = datetime.utcnow() + timedelta(days=2)
            # Downgrading confirmed → soft_hold: restore stock
            if old_type == "confirmed" and r.product_id and old_status == "active":
                product = db.query(Product).filter(
                    Product.id == r.product_id, Product.shop_id == shop_id
                ).first()
                if product:
                    product.quantity = (product.quantity or 0) + r.quantity
                    stock_changed = True

    # Also restore stock if cancelling an active confirmed reservation
    if body.status in ("cancelled", "expired") and old_status == "active" and old_type == "confirmed":
        if r.product_id:
            product = db.query(Product).filter(
                Product.id == r.product_id, Product.shop_id == shop_id
            ).first()
            if product:
                product.quantity = (product.quantity or 0) + r.quantity
                stock_changed = True

    db.commit()
    db.refresh(r)

    if stock_changed and r.product_id:
        background_tasks.add_task(_bg_push_stock, r.product_id, shop_id)

    return _serialize(r)


class FulfillBody(BaseModel):
    unit_price: Optional[float] = None  # if omitted, product.price is used


@router.post("/shops/{shop_id}/reservations/{reservation_id}/fulfill")
def fulfill_reservation(
    shop_id: int,
    reservation_id: int,
    body: FulfillBody,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Convert an active reservation into a POS order, reduce stock, and mark it fulfilled."""
    r = db.query(Reservation).filter(
        Reservation.id == reservation_id, Reservation.shop_id == shop_id
    ).first()
    if not r:
        raise HTTPException(404, "Reservation not found")
    if r.status != "active":
        raise HTTPException(400, "Only active reservations can be fulfilled")

    # Resolve product and unit price
    product = None
    if r.product_id:
        product = db.query(Product).filter(
            Product.id == r.product_id, Product.shop_id == shop_id
        ).first()

    unit_price = body.unit_price if body.unit_price is not None else (
        float(product.price) if product else 0.0
    )
    subtotal = unit_price * r.quantity

    # Get or create customer
    customer_id = None
    if r.customer_phone or r.customer_email or r.customer_name:
        existing = None
        if r.customer_phone:
            existing = db.query(Customer).filter(
                Customer.shop_id == shop_id,
                Customer.phone == r.customer_phone,
            ).first()
        if not existing and r.customer_email:
            existing = db.query(Customer).filter(
                Customer.shop_id == shop_id,
                Customer.email == r.customer_email,
            ).first()
        if existing:
            customer_id = existing.id
        else:
            new_customer = Customer(
                shop_id=shop_id,
                name=r.customer_name or "Walk-in Customer",
                phone=r.customer_phone,
                email=r.customer_email,
            )
            db.add(new_customer)
            db.flush()
            customer_id = new_customer.id

    # Create POS order (delivered + paid immediately)
    timestamp = datetime.now().strftime("%Y%m%d%H%M")
    order_number = f"ORD-{timestamp}-{uuid.uuid4().hex[:4].upper()}"
    notes = f"Fulfilled from reservation #{r.id}"
    if r.lpo_number:
        notes += f" | LPO: {r.lpo_number}"
    if r.advance_amount:
        notes += f" | Advance received: {r.advance_amount}"

    order = Order(
        order_number=order_number,
        shop_id=shop_id,
        customer_id=customer_id,
        source="pos",
        status="delivered",
        payment_status="paid",
        subtotal=subtotal,
        tax_amount=0,
        discount_amount=0,
        total=subtotal,
        notes=notes,
    )
    db.add(order)
    db.flush()

    # Create order item and reduce stock (only when product is linked)
    if product:
        db.add(OrderItem(
            order_id=order.id,
            product_id=product.id,
            product_name=product.name,
            quantity=r.quantity,
            unit_price=unit_price,
            total_price=unit_price * r.quantity,
        ))
        # confirmed reservations already deducted stock on confirmation — don't double-deduct
        if r.reservation_type == "soft_hold":
            product.quantity = max(0, (product.quantity or 0) - r.quantity)

    # Mark reservation fulfilled
    r.status = "fulfilled"
    db.commit()

    # Push updated stock to TheDersi (and any other connected channels)
    if product:
        background_tasks.add_task(_bg_push_stock, product.id, shop_id)

    return {"order_id": order.id, "order_number": order_number}


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
