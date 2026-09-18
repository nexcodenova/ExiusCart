from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import List, Optional
from datetime import datetime, timedelta, timezone
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
    "free_trial":            100,
    "thedersi_free_forever": 100,
    "thedersi_lite":         500,
    "launch":                5_000,
    "growth":                25_000,
    "scale":                 None,   # unlimited
    "lifetime":              None,
}

# Spend above this (in the shop's own currency, unconverted) = VIP. Shared by
# the list endpoint's per-row status and the stats endpoint's segment counts.
VIP_THRESHOLD = 50000


def _customer_status(is_active: bool, is_vip: bool, total_orders: int) -> str:
    if not is_active:
        return "inactive"
    if is_vip:
        return "vip"
    if total_orders == 0:
        return "new"
    return "returning"


def _customer_dict(c: Customer, total_orders: int, total_spent: float, last_order) -> dict:
    is_vip = total_spent >= VIP_THRESHOLD
    return {
        "id": c.id,
        "name": c.name,
        "phone": c.phone or "",
        "email": c.email,
        "address": c.address,
        "city": c.city,
        "country": c.country,
        "notes": c.notes,
        "tags": c.tags or [],
        "source": c.source,
        "isActive": c.is_active,
        "totalOrders": total_orders,
        "totalSpent": total_spent,
        "lastOrder": last_order.isoformat() if last_order else None,
        "joinedDate": c.created_at.isoformat() if c.created_at else None,
        "isVip": is_vip,
        "status": _customer_status(c.is_active, is_vip, total_orders),
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
        shop_id=shop_id,
        source="manual",
    )
    db.add(new_customer)
    db.commit()
    db.refresh(new_customer)
    return new_customer


@router.get("/shops/{shop_id}/customers")
async def get_customers(
    shop_id: int,
    search: Optional[str] = None,
    source: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    sort: str = "newest",
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Customer).filter(Customer.shop_id == shop_id)

    if search:
        term = search.strip()
        conditions = [
            Customer.name.ilike(f"%{term}%"),
            Customer.phone.ilike(f"%{term}%"),
            Customer.email.ilike(f"%{term}%"),
        ]
        # Also match a pasted customer ID like "#CUS-000125" or a bare number.
        id_part = term.lstrip("#").upper()
        if id_part.startswith("CUS-"):
            id_part = id_part[4:]
        id_part = id_part.lstrip("0") or "0"
        if id_part.isdigit():
            conditions.append(Customer.id == int(id_part))
        query = query.filter(or_(*conditions))
    if source:
        query = query.filter(Customer.source == source)

    all_customers = query.all()
    empty_counts = {"all": 0, "vip": 0, "new": 0, "returning": 0, "inactive": 0}
    if not all_customers:
        return {"items": [], "total": 0, "counts": empty_counts, "sources": []}

    # Aggregate order stats per customer in one query (exclude cancelled orders)
    customer_ids = [c.id for c in all_customers]
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

    counts = dict(empty_counts)
    counts["all"] = len(all_customers)
    dicts = []
    for c in all_customers:
        s = stats.get(c.id)
        total_orders = s.total_orders if s else 0
        total_spent = float(s.total_spent) if s else 0.0
        last_order = s.last_order if s else None
        d = _customer_dict(c, total_orders, total_spent, last_order)
        counts[d["status"]] += 1
        dicts.append(d)

    # Real source values actually present for this shop — drives the "All
    # customers" filter dropdown without ever inventing an option nobody has.
    sources = sorted({c.source for c in all_customers if c.source})

    if status_filter and status_filter in ("vip", "new", "returning", "inactive"):
        dicts = [d for d in dicts if d["status"] == status_filter]

    sort_options = {
        "newest":      (lambda d: d["joinedDate"] or "", True),
        "oldest":      (lambda d: d["joinedDate"] or "", False),
        "spent_desc":  (lambda d: d["totalSpent"], True),
        "spent_asc":   (lambda d: d["totalSpent"], False),
        "orders_desc": (lambda d: d["totalOrders"], True),
        "name_asc":    (lambda d: d["name"].lower(), False),
    }
    key_fn, reverse = sort_options.get(sort, sort_options["newest"])
    dicts.sort(key=key_fn, reverse=reverse)

    total = len(dicts)
    page = dicts[skip: skip + limit]
    return {"items": page, "total": total, "counts": counts, "sources": sources}


@router.get("/shops/{shop_id}/customers/stats")
async def get_customer_stats(
    shop_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Real month-over-month deltas for the KPI cards — every number here is
    recomputed as of two points in time (now, and 30 days ago) from actual
    Customer/Order rows, never a made-up trend."""
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=30)

    customers = db.query(Customer.id, Customer.created_at, Customer.is_active).filter(Customer.shop_id == shop_id).all()
    customer_ids = [c.id for c in customers]

    def _pct_change(current: float, prior: float) -> Optional[float]:
        if prior <= 0:
            return None
        return round((current - prior) / prior * 100, 1)

    if not customer_ids:
        empty = {"total": 0, "vip": 0, "revenue": 0.0, "avg_spent": 0.0}
        return {
            "now": empty, "prior": empty,
            "changes": {"total_customers": None, "vip_customers": None, "total_revenue": None, "avg_spent": None},
            "daily": [],
        }

    order_rows = (
        db.query(Order.customer_id, Order.total, Order.created_at)
        .filter(Order.customer_id.in_(customer_ids), Order.status != "cancelled")
        .all()
    )

    def _snapshot(as_of: Optional[datetime]):
        spent_by_customer: dict = {}
        for o in order_rows:
            if as_of and o.created_at and o.created_at > as_of:
                continue
            spent_by_customer[o.customer_id] = spent_by_customer.get(o.customer_id, 0.0) + float(o.total or 0)
        eligible = [c for c in customers if not as_of or not c.created_at or c.created_at <= as_of]
        total_customers = len(eligible)
        vip_count = sum(1 for c in eligible if spent_by_customer.get(c.id, 0.0) >= VIP_THRESHOLD)
        revenue = sum(spent_by_customer.values())
        avg_spent = revenue / total_customers if total_customers else 0.0
        return {"total": total_customers, "vip": vip_count, "revenue": round(revenue, 2), "avg_spent": round(avg_spent, 2)}

    now_snap = _snapshot(None)
    prior_snap = _snapshot(cutoff)

    # Last 14 days, per-day new customers + revenue — real sparkline data,
    # not an interpolated or fabricated curve.
    daily: list = []
    for i in range(13, -1, -1):
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        new_customers = sum(1 for c in customers if c.created_at and day_start <= c.created_at < day_end)
        day_revenue = sum(float(o.total or 0) for o in order_rows if o.created_at and day_start <= o.created_at < day_end)
        daily.append({"date": day_start.date().isoformat(), "new_customers": new_customers, "revenue": round(day_revenue, 2)})

    return {
        "now": now_snap,
        "prior": prior_snap,
        "changes": {
            "total_customers": _pct_change(now_snap["total"], prior_snap["total"]),
            "vip_customers": _pct_change(now_snap["vip"], prior_snap["vip"]),
            "total_revenue": _pct_change(now_snap["revenue"], prior_snap["revenue"]),
            "avg_spent": _pct_change(now_snap["avg_spent"], prior_snap["avg_spent"]),
        },
        "daily": daily,
    }


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
