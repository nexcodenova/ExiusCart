from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from app.core.database import get_db
from app.models.user import User
from app.models.shop import Shop
from app.models.customer import Customer
from app.models.order import Order
from app.models.subscription import Subscription
from app.schemas.customer import CustomerCreate, CustomerResponse, CustomerUpdate
from app.api.v1.deps import get_current_user

router = APIRouter()

CUSTOMER_LIMITS: dict = {
    "free_trial":    100,
    "thedersi_basic": 100,
    "starter":       5_000,
    "thedersi_pro":  5_000,
    "premium":       None,   # unlimited
    "lifetime":      None,
}


@router.post("/shops/{shop_id}/customers", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
async def create_customer(
    shop_id: int,
    customer_data: CustomerCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    # ── Plan-based customer limit check ──────────────────────────────────────
    sub = db.query(Subscription).filter(Subscription.shop_id == shop_id).order_by(Subscription.id.desc()).first()
    plan_type = sub.plan_type if sub else "free_trial"
    limit = CUSTOMER_LIMITS.get(plan_type)
    if limit is not None:
        count = db.query(func.count(Customer.id)).filter(Customer.shop_id == shop_id).scalar() or 0
        if count >= limit:
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "customer_limit_reached",
                    "limit": limit,
                    "used": count,
                    "plan": plan_type,
                    "message": f"Customer limit of {limit} reached on your {plan_type} plan. Upgrade to add more customers.",
                },
            )
    # ─────────────────────────────────────────────────────────────────────────

    new_customer = Customer(
        **customer_data.model_dump(),
        shop_id=shop_id
    )
    db.add(new_customer)
    db.commit()
    db.refresh(new_customer)
    return new_customer


@router.get("/shops/{shop_id}/customers")
async def get_customers(
    shop_id: int,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Customer).filter(Customer.shop_id == shop_id)

    if search:
        query = query.filter(
            (Customer.name.ilike(f"%{search}%")) |
            (Customer.phone.ilike(f"%{search}%")) |
            (Customer.email.ilike(f"%{search}%"))
        )

    customers = query.offset(skip).limit(limit).all()
    if not customers:
        return []

    # Aggregate order stats per customer in one query (exclude cancelled orders)
    customer_ids = [c.id for c in customers]
    stats_rows = (
        db.query(
            Order.customer_id,
            func.count(Order.id).label("total_orders"),
            func.coalesce(func.sum(Order.total), 0).label("total_spent"),
            func.max(Order.created_at).label("last_order"),
        )
        .filter(
            Order.customer_id.in_(customer_ids),
            Order.status != "cancelled",
        )
        .group_by(Order.customer_id)
        .all()
    )
    stats = {r.customer_id: r for r in stats_rows}

    VIP_THRESHOLD = 50000  # spend above this = VIP
    result = []
    for c in customers:
        s = stats.get(c.id)
        total_spent = float(s.total_spent) if s else 0.0
        result.append({
            "id": c.id,
            "name": c.name,
            "phone": c.phone or "",
            "email": c.email,
            "address": c.address,
            "totalOrders": s.total_orders if s else 0,
            "totalSpent": total_spent,
            "lastOrder": s.last_order.isoformat() if s and s.last_order else None,
            "joinedDate": c.created_at.isoformat() if c.created_at else None,
            "isVip": total_spent >= VIP_THRESHOLD,
        })
    return result


@router.get("/shops/{shop_id}/customers/{customer_id}", response_model=CustomerResponse)
async def get_customer(
    shop_id: int,
    customer_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    customer = db.query(Customer).filter(
        Customer.id == customer_id,
        Customer.shop_id == shop_id
    ).first()

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@router.put("/shops/{shop_id}/customers/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    shop_id: int,
    customer_id: int,
    customer_data: CustomerUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    customer = db.query(Customer).filter(
        Customer.id == customer_id,
        Customer.shop_id == shop_id
    ).first()

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    update_data = customer_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(customer, field, value)

    db.commit()
    db.refresh(customer)
    return customer


@router.delete("/shops/{shop_id}/customers/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer(
    shop_id: int,
    customer_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    customer = db.query(Customer).filter(
        Customer.id == customer_id,
        Customer.shop_id == shop_id
    ).first()

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    db.delete(customer)
    db.commit()
