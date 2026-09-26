"""Price Coach: a seller pastes a supplier link inside their own store, sees what the
market charges and what they would really earn, then launches a draft.

Growth and Scale only. Launch gets a locked answer (200, never a 403, so the store
does not treat it as a broken session) that says what unlocks it. All the logic lives
in app/intel/coach.py; this file is the thin HTTP layer."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.api.v1.endpoints.shopping import INTEL_PLANS, _seller_intel_view, eligible_subscription_for_shop
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.core.shop_access import get_shop_for_member
from app.intel import coach
from app.models.coach import CoachItem
from app.models.dropship import DropshipConnection
from app.models.product import Product
from app.models.shop import Shop
from app.models.user import User

router = APIRouter()

LIST_LIMIT = 50


def _shop(db: Session, shop_id: int, user: User) -> Shop:
    shop = get_shop_for_member(db, shop_id, user)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


def _plan(db: Session, shop: Shop) -> Optional[str]:
    sub = eligible_subscription_for_shop(db, shop)
    return sub.plan_type if sub else None


def _fail(e: coach.CoachError):
    raise HTTPException(status_code=e.status, detail={"error": e.code, "message": e.message})


def _item_out(db: Session, it: CoachItem) -> dict:
    p = db.query(Product).filter(Product.id == it.product_id).first() if it.product_id else None
    return {
        "id": it.id, "status": it.status, "error": it.error, "supplier": it.supplier_type, "source_url": it.source_url,
        "verdict": it.verdict, "confidence": it.confidence, "margin_pct": it.margin_pct, "competitor_count": it.competitor_count,
        "checked_at": it.checked_at.isoformat() if it.checked_at else None,
        "launched_price": it.launched_price, "launched_at": it.launched_at.isoformat() if it.launched_at else None,
        "created_at": it.created_at.isoformat() if it.created_at else None,
        "product": None if not p else {
            "id": p.id, "name": p.name, "original_name": it.original_name, "image_url": p.image_url,
            "cost": float(p.cost_price) if p.cost_price is not None else None,
            "shipping": float(p.shipping_cost) if p.shipping_cost is not None else None,
            "price": float(p.price) if p.price is not None else None, "is_active": bool(p.is_active),
        },
    }


def _detail(db: Session, shop: Shop, it: CoachItem, plan: Optional[str]) -> dict:
    out = _item_out(db, it)
    row = coach._latest_result(db, it.product_id) if it.product_id else None
    out["analysis"] = _seller_intel_view(row) if row else None
    out["supplier_connected"] = bool(db.query(DropshipConnection).filter(
        DropshipConnection.shop_id == shop.id, DropshipConnection.supplier_type == it.supplier_type, DropshipConnection.is_active == True).first())  # noqa: E712
    out["usage"] = coach.usage(db, shop.id, plan)
    return out


def _gate(db: Session, shop: Shop) -> str:
    plan = _plan(db, shop)
    if plan not in INTEL_PLANS:
        raise HTTPException(status_code=403, detail={"error": "plan_required", "message": "Price Coach is included in the Growth and Scale plans."})
    return plan


def _own_item(db: Session, shop: Shop, item_id: int) -> CoachItem:
    it = db.query(CoachItem).filter(CoachItem.id == item_id, CoachItem.shop_id == shop.id, CoachItem.status != "discarded").first()
    if not it:
        raise HTTPException(status_code=404, detail="That product is not in your Price Coach list.")
    return it


@router.get("/shops/{shop_id}/price-coach")
def price_coach_home(shop_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """The whole page in one call: plan state, this month's allowance and the list."""
    shop = _shop(db, shop_id, user)
    plan = _plan(db, shop)
    if plan not in INTEL_PLANS:
        return {"locked": True, "plan": plan, "required_plan": "growth", "limits": {p: coach.monthly_limit(p) for p in coach.PLANS}}
    items = (db.query(CoachItem).filter(CoachItem.shop_id == shop.id, CoachItem.status != "discarded")
             .order_by(CoachItem.id.desc()).limit(LIST_LIMIT).all())
    return {"locked": False, "plan": plan, "usage": coach.usage(db, shop.id, plan), "items": [_item_out(db, i) for i in items]}


class LinkIn(BaseModel):
    url: str = Field(min_length=1, max_length=2000)


@router.post("/shops/{shop_id}/price-coach/links", status_code=201)
@limiter.limit("15/minute")
def price_coach_add(request: Request, shop_id: int, body: LinkIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    shop = _shop(db, shop_id, user)
    plan = _gate(db, shop)
    try:
        res = coach.add_link(db, shop, user.id, body.url)
    except coach.CoachError as e:
        _fail(e)
    return {"existing": res["existing"], "item": _detail(db, shop, res["item"], plan)}


@router.get("/shops/{shop_id}/price-coach/{item_id}")
def price_coach_item(shop_id: int, item_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    shop = _shop(db, shop_id, user)
    plan = _gate(db, shop)
    return _detail(db, shop, _own_item(db, shop, item_id), plan)


class CheckIn(BaseModel):
    target_margin_pct: float = 30.0


@router.post("/shops/{shop_id}/price-coach/{item_id}/check")
@limiter.limit("20/minute")
def price_coach_check(request: Request, shop_id: int, item_id: int, body: CheckIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    shop = _shop(db, shop_id, user)
    plan = _gate(db, shop)
    it = _own_item(db, shop, item_id)
    try:
        res = coach.run_check(db, shop, it, user.id, plan, body.target_margin_pct)
    except coach.CoachError as e:
        _fail(e)
    out = _detail(db, shop, it, plan)
    out["charged"] = res["charged"]
    return out


class LaunchIn(BaseModel):
    price: Optional[float] = None


@router.post("/shops/{shop_id}/price-coach/{item_id}/launch")
@limiter.limit("10/minute")
def price_coach_launch(request: Request, shop_id: int, item_id: int, body: LaunchIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    shop = _shop(db, shop_id, user)
    plan = _gate(db, shop)
    it = _own_item(db, shop, item_id)
    try:
        res = coach.launch(db, shop, it, user.id, body.price)
    except coach.CoachError as e:
        _fail(e)
    out = _detail(db, shop, it, plan)
    out["launch"] = res
    return out


@router.delete("/shops/{shop_id}/price-coach/{item_id}", status_code=204)
def price_coach_discard(shop_id: int, item_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    shop = _shop(db, shop_id, user)
    _gate(db, shop)
    coach.discard(db, shop, _own_item(db, shop, item_id))
