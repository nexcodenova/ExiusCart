"""
Customer Segments — a saved filter over Customer + real order stats, not a
static stored list. See CustomerSegment's own docstring for the `rules`
shape. Membership (`_matching_customers`) is computed fresh on every read:
tags/source are checked in SQL-friendly terms where possible, but order
count/LTV need a join+aggregate over Order first, so the simplest correct
approach — fetch shop customers with their real order stats in one batched
query, then filter in Python — is used rather than hand-rolling
JSON-array-containment SQL that would be Postgres-specific and harder to
verify than it's worth for typical per-shop customer counts.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.thedersi import is_thedersi_free_forever_shop
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.shop import Shop
from app.models.customer import Customer
from app.models.order import Order
from app.models.customer_segment import CustomerSegment
from app.core.shop_access import get_shop_for_member

router = APIRouter()


def _shop_or_404(shop_id: int, user: User, db: Session) -> Shop:
    shop = get_shop_for_member(db, shop_id, user)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


def _require_not_free_forever(shop_id: int, db: Session):
    # Everyone gets Customer Segments except TheDersi Free Forever
    # specifically — Lite/Pro/Official all still get it (and it's mostly
    # inert for Free Forever anyway, which has no Email/SMS/WhatsApp/Social
    # channel to actually message a segment with).
    if is_thedersi_free_forever_shop(shop_id, db):
        raise HTTPException(status_code=403, detail={
            "error": "not_available",
            "message": "Customer Segments is available on TheDersi Lite, Pro, and Official.",
        })


class SegmentRules(BaseModel):
    tags: list[str] = []
    sources: list[str] = []
    min_orders: int | None = None
    max_orders: int | None = None
    min_ltv: float | None = None
    max_ltv: float | None = None


class SegmentIn(BaseModel):
    name: str
    description: str | None = None
    rules: SegmentRules = SegmentRules()


def _customer_stats(shop_id: int, db: Session) -> dict[int, dict]:
    """{customer_id: {"order_count": int, "ltv": float}} for every customer
    in this shop with at least one non-cancelled order. Customers with zero
    orders are absent — a min_orders/min_ltv filter correctly excludes them,
    and callers wanting "0 orders" would need a dedicated rule this simple
    shape doesn't offer yet."""
    rows = db.query(
        Order.customer_id, func.count(Order.id), func.coalesce(func.sum(Order.total), 0),
    ).filter(
        Order.shop_id == shop_id, Order.status != "cancelled", Order.customer_id.isnot(None),
    ).group_by(Order.customer_id).all()
    return {cid: {"order_count": int(cnt), "ltv": float(ltv or 0)} for cid, cnt, ltv in rows}


def _matching_customers(shop_id: int, rules: dict, db: Session) -> list[dict]:
    query = db.query(Customer).filter(Customer.shop_id == shop_id, Customer.is_active == True)
    sources = rules.get("sources") or []
    if sources:
        query = query.filter(Customer.source.in_(sources))
    customers = query.all()

    stats = _customer_stats(shop_id, db)
    tags = set(rules.get("tags") or [])
    min_orders, max_orders = rules.get("min_orders"), rules.get("max_orders")
    min_ltv, max_ltv = rules.get("min_ltv"), rules.get("max_ltv")

    matched = []
    for c in customers:
        if tags and not (set(c.tags or []) & tags):
            continue
        st = stats.get(c.id, {"order_count": 0, "ltv": 0.0})
        if min_orders is not None and st["order_count"] < min_orders:
            continue
        if max_orders is not None and st["order_count"] > max_orders:
            continue
        if min_ltv is not None and st["ltv"] < min_ltv:
            continue
        if max_ltv is not None and st["ltv"] > max_ltv:
            continue
        matched.append({
            "id": c.id, "name": c.name, "email": c.email, "phone": c.phone,
            "tags": c.tags or [], "source": c.source,
            "order_count": st["order_count"], "ltv": st["ltv"],
        })
    matched.sort(key=lambda m: m["ltv"], reverse=True)
    return matched


def _segment_out(segment: CustomerSegment, member_count: int) -> dict:
    return {
        "id": segment.id, "name": segment.name, "description": segment.description,
        "rules": segment.rules, "member_count": member_count,
        "created_at": segment.created_at.isoformat() if segment.created_at else None,
        "updated_at": segment.updated_at.isoformat() if segment.updated_at else None,
    }


@router.get("/shops/{shop_id}/customer-segments")
def list_segments(shop_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _shop_or_404(shop_id, current_user, db)
    _require_not_free_forever(shop_id, db)
    segments = db.query(CustomerSegment).filter(CustomerSegment.shop_id == shop_id).order_by(CustomerSegment.created_at.desc()).all()
    return [_segment_out(s, len(_matching_customers(shop_id, s.rules or {}, db))) for s in segments]


@router.post("/shops/{shop_id}/customer-segments", status_code=201)
def create_segment(shop_id: int, data: SegmentIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _shop_or_404(shop_id, current_user, db)
    _require_not_free_forever(shop_id, db)
    if not data.name.strip():
        raise HTTPException(status_code=400, detail="Segment name is required.")
    segment = CustomerSegment(shop_id=shop_id, name=data.name.strip(), description=data.description, rules=data.rules.model_dump())
    db.add(segment)
    db.commit()
    db.refresh(segment)
    return _segment_out(segment, len(_matching_customers(shop_id, segment.rules or {}, db)))


@router.get("/shops/{shop_id}/customer-segments/{segment_id}")
def get_segment(shop_id: int, segment_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _shop_or_404(shop_id, current_user, db)
    _require_not_free_forever(shop_id, db)
    segment = db.query(CustomerSegment).filter(CustomerSegment.id == segment_id, CustomerSegment.shop_id == shop_id).first()
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    members = _matching_customers(shop_id, segment.rules or {}, db)
    return {**_segment_out(segment, len(members)), "members": members}


@router.put("/shops/{shop_id}/customer-segments/{segment_id}")
def update_segment(shop_id: int, segment_id: int, data: SegmentIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _shop_or_404(shop_id, current_user, db)
    _require_not_free_forever(shop_id, db)
    segment = db.query(CustomerSegment).filter(CustomerSegment.id == segment_id, CustomerSegment.shop_id == shop_id).first()
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    segment.name = data.name.strip() or segment.name
    segment.description = data.description
    segment.rules = data.rules.model_dump()
    segment.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(segment)
    return _segment_out(segment, len(_matching_customers(shop_id, segment.rules or {}, db)))


@router.delete("/shops/{shop_id}/customer-segments/{segment_id}", status_code=204)
def delete_segment(shop_id: int, segment_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _shop_or_404(shop_id, current_user, db)
    segment = db.query(CustomerSegment).filter(CustomerSegment.id == segment_id, CustomerSegment.shop_id == shop_id).first()
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    db.delete(segment)
    db.commit()


@router.get("/shops/{shop_id}/customer-segments/_meta/filter-options")
def segment_filter_options(shop_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Real tags and sources this shop's customers actually have — so the
    rule builder offers a picklist instead of a free-text field the seller
    has to guess spelling for."""
    _shop_or_404(shop_id, current_user, db)
    _require_not_free_forever(shop_id, db)
    customers = db.query(Customer.tags, Customer.source).filter(Customer.shop_id == shop_id).all()
    tags: set[str] = set()
    sources: set[str] = set()
    for tag_list, source in customers:
        for t in (tag_list or []):
            tags.add(t)
        if source:
            sources.add(source)
    return {"tags": sorted(tags), "sources": sorted(sources)}
