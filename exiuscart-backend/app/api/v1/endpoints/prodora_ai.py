"""Prodora AI: ask for products in plain words, get ranked cards with real scores, launch one in a click.

  POST /shopping/ai/search            "products for US pet owners under $30" -> filters -> scored cards
  POST /shopping/ai/launch/{id}       bring the product into the seller's store as a draft, priced and written

What makes this more than a chat box: the AI only understands the sentence (app/intel/query.py). Our own code
searches the catalogue and works out every score from data we hold (app/intel/scores.py), each with its source,
and anything we cannot measure says "not measured". Launching reuses Price Coach, so the draft is written and
priced the same way and shows up in the seller's Price Coach list.

Growth and Scale only. Business refusals are never a 401 or 403: the Prodora site signs a seller out on those.
"""
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.api.v1.endpoints.shopping import (INTEL_PLANS, _find_eligible_subscription, get_prodora_user, import_shopping_product)
from app.core.database import get_db
from app.core.intel import record_event
from app.intel import coach, query, scores
from app.models.coach import CoachItem
from app.models.dropship import DropshipProductLink
from app.models.intel import PlatformEvent, ProductIntelResult
from app.models.product import Category, Product
from app.models.prodora import ProdoraImportLog
from app.models.shop import Shop
from app.models.user import User

router = APIRouter()

SEARCH_EVENT = "prodora_ai_search"
CANDIDATES = 300
VERDICT_LABEL = {"TEST": "Test candidate", "WATCH": "Watch", "AVOID": "Low margin"}
STALE_DAYS = 7


def daily_limit() -> int:
    try:
        return max(1, int(os.getenv("AI_SEARCH_DAILY_LIMIT", "40")))
    except ValueError:
        return 40


def _today_start() -> datetime:
    return datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)


def _plan(db: Session, user: User) -> Optional[str]:
    sub = _find_eligible_subscription(db, user)
    return sub.plan_type if sub else None


def _latest_results(db: Session, ids: list) -> dict:
    """The newest US analysis for each product, in one query."""
    if not ids:
        return {}
    rows = (db.query(ProductIntelResult).filter(ProductIntelResult.product_id.in_(ids), ProductIntelResult.market == "US")
            .order_by(ProductIntelResult.id.desc()).all())
    out: dict = {}
    for r in rows:
        out.setdefault(r.product_id, r)
    return out


def _relevance(p: Product, keywords: list) -> int:
    name, cat, desc = (p.name or "").lower(), (p.category.name if p.category else "").lower(), (p.description or "").lower()
    return sum(3 * (k in name) + 2 * (k in cat) + (k in desc) for k in keywords)


def _card(p: Product, row: Optional[ProductIntelResult]) -> dict:
    prod = {"price": float(p.price) if p.price is not None else None, "cost_price": float(p.cost_price) if p.cost_price is not None else None,
            "shipping_cost": float(p.shipping_cost) if p.shipping_cost is not None else None, "shipping_time": p.shipping_time,
            "supplier_rating": float(p.supplier_rating) if p.supplier_rating is not None else None,
            "fulfillment_rate": float(p.fulfillment_rate) if p.fulfillment_rate is not None else None}
    s = scores.compute(prod, {"snapshot": row.snapshot, "evaluation": row.evaluation} if row else None)
    captured = ((row.snapshot or {}).get("captured_at") if row else None)
    stale = False
    if captured:
        try:
            when = datetime.fromisoformat(captured)
            stale = (datetime.now(timezone.utc) - (when if when.tzinfo else when.replace(tzinfo=timezone.utc))).days >= STALE_DAYS
        except ValueError:
            pass
    return {
        "id": p.id, "name": p.name, "image_url": p.image_url, "category": p.category.name if p.category else None, "supplier": p.supplier_name,
        "selling_price": prod["price"], "supplier_cost": prod["cost_price"], "shipping_cost": prod["shipping_cost"],
        "verdict": s["verdict"], "verdict_label": VERDICT_LABEL.get(s["verdict"] or ""), "confidence": s["confidence"], "headline": s["headline"],
        "scores": s["scores"], "overall": s["overall"], "measured": s["measured"], "of": s["of"], "saturation": s["saturation"],
        "competitors": s["competitor_count"], "why": s["why"],
        "checked": bool(row), "checked_at": captured, "stale": stale,
        "can_launch": bool(row),
    }


class SearchIn(BaseModel):
    query: str = Field(min_length=2, max_length=300)
    limit: int = Field(default=12, ge=1, le=30)


@router.post("/shopping/ai/search")
def ai_search(body: SearchIn, db: Session = Depends(get_db), user: User = Depends(get_prodora_user)):
    plan = _plan(db, user)
    if plan not in INTEL_PLANS:
        return {"locked": True, "plan": plan, "required_plan": "growth"}
    used = db.query(PlatformEvent).filter(PlatformEvent.event_type == SEARCH_EVENT, PlatformEvent.user_id == user.id,
                                          PlatformEvent.created_at >= _today_start()).count()
    if used >= daily_limit():
        raise HTTPException(status_code=429, detail=f"You have used today's {daily_limit()} AI searches. They reset tomorrow.")

    f = query.parse(body.query)
    q = (db.query(Product).outerjoin(Category, Product.category_id == Category.id).options(joinedload(Product.category))
         .filter(Product.is_active == True, Product.shop_id.is_(None),  # noqa: E712 - the Prodora catalogue belongs to no shop
                 or_(Product.product_type == "physical", Product.product_type.is_(None))))
    if f["keywords"]:
        conds = []
        for k in f["keywords"]:
            like = f"%{k}%"
            conds += [Product.name.ilike(like), Category.name.ilike(like), Product.description.ilike(like)]
        q = q.filter(or_(*conds))
    if f["max_price"] is not None:
        q = q.filter(Product.price <= f["max_price"])
    if f["min_price"] is not None:
        q = q.filter(Product.price >= f["min_price"])
    candidates = q.order_by(Product.is_trending.desc(), Product.id.desc()).limit(CANDIDATES).all()

    results = _latest_results(db, [p.id for p in candidates])
    cards = []
    for p in candidates:
        c = _card(p, results.get(p.id))
        c["_rel"] = _relevance(p, f["keywords"])
        margin = c["scores"]["margin"].get("pct")
        if f["min_margin_pct"] is not None and (margin is None or margin < f["min_margin_pct"]):
            continue
        cards.append(c)
    # Checked products first: they have a real market verdict and can be launched. Within each group, the best overall
    # score, then how well the words matched. An unchecked product never outranks a checked one on a rough catalogue margin.
    cards.sort(key=lambda c: (c["checked"], c["overall"] if c["overall"] is not None else -1, c["_rel"]), reverse=True)
    for c in cards:
        c.pop("_rel", None)

    record_event(db, SEARCH_EVENT, user_id=user.id, entity_type="prodora_ai", payload={"query": body.query[:200], "method": f["method"], "matches": len(cards)})
    return {"locked": False, "understood": query.describe(f), "method": f["method"], "total": len(cards), "checked_count": sum(1 for c in cards if c["checked"]),
            "results": cards[: body.limit], "searches_left": max(daily_limit() - used - 1, 0)}


class LaunchIn(BaseModel):
    price: Optional[float] = None


@router.post("/shopping/ai/launch/{product_id}")
def ai_launch(product_id: int, body: LaunchIn, db: Session = Depends(get_db), user: User = Depends(get_prodora_user)):
    """One click: the catalogue product becomes a hidden draft in the seller's own store, priced from its market
    check with a title and description written for it. The seller reviews and publishes it in the store."""
    plan = _plan(db, user)
    if plan not in INTEL_PLANS:
        return {"locked": True, "plan": plan, "required_plan": "growth"}
    source = db.query(Product).filter(Product.id == product_id, Product.is_active == True, Product.shop_id.is_(None)).first()  # noqa: E712
    if not source:
        raise HTTPException(status_code=404, detail="Product not found")
    row = coach._latest_result(db, source.id)
    if not row:
        raise HTTPException(status_code=409, detail={"error": "not_analysed", "message": "This product has not had its market check yet, so it cannot be launched. We check new products every day."})

    shop = db.query(Shop).filter(Shop.owner_id == user.id, Shop.is_active == True).order_by(Shop.id.asc()).first()  # noqa: E712
    if not shop:
        raise HTTPException(status_code=404, detail="No active ExiusCart shop found for this account")
    already = (db.query(ProdoraImportLog).filter(ProdoraImportLog.shop_id == shop.id, ProdoraImportLog.source_product_id == source.id).order_by(ProdoraImportLog.id.desc()).first())
    if already and already.product_id and db.query(Product.id).filter(Product.id == already.product_id, Product.shop_id == shop.id).first():
        raise HTTPException(status_code=409, detail={"error": "already_in_store", "message": "This product is already in your store.", "product_id": already.product_id})

    try:
        imported = import_shopping_product(product_id, db, user)
    except HTTPException as e:
        if e.status_code in (401, 403):        # the Prodora site would sign the seller out on these
            raise HTTPException(status_code=409, detail=e.detail)
        raise
    new = db.query(Product).filter(Product.id == imported["product_id"]).first()
    link = db.query(DropshipProductLink).filter(DropshipProductLink.product_id == source.id, DropshipProductLink.is_primary == True).first()  # noqa: E712
    # the import copies the sale side; the cost side is needed for honest numbers later
    new.is_active = False
    new.shipping_cost = source.shipping_cost
    new.warehouse_country = source.warehouse_country
    new.supplier_name = source.supplier_name
    db.add(ProductIntelResult(product_id=new.id, market="US", snapshot=row.snapshot, evaluation=row.evaluation, verdict=row.verdict, confidence=row.confidence, created_by_user_id=user.id))
    item = CoachItem(shop_id=shop.id, user_id=user.id, source_url=source.source_url or "", supplier_type=(link.supplier_type if link else "cj"),
                     supplier_ref=(link.supplier_product_id if link and link.supplier_product_id else f"prodora-{source.id}"), product_id=new.id,
                     status="checked", verdict=row.verdict, confidence=row.confidence, original_name=(source.name or "")[:255],
                     competitor_count=(row.evaluation or {}).get("competitor_count"),
                     margin_pct=((row.evaluation or {}).get("economics") or {}).get("contribution_margin_pct"), checked_at=datetime.now(timezone.utc))
    db.add(item)
    db.commit()
    db.refresh(item)
    try:
        res = coach.launch(db, shop, item, user.id, body.price)
    except coach.CoachError as e:
        raise HTTPException(status_code=e.status if e.status not in (401, 403) else 409, detail={"error": e.code, "message": e.message})
    record_event(db, "prodora_ai_launch", user_id=user.id, shop_id=shop.id, entity_type="prodora_product", entity_id=source.id,
                 payload={"new_product_id": new.id, "price": res["price"], "ai_written": res["ai_written"]})
    return {"locked": False, "product_id": new.id, "coach_item_id": item.id, "price": res["price"], "ai_written": res["ai_written"],
            "below_target": res["below_target"], "supplier_connected": res["supplier_connected"], "name": new.name,
            "edit_path": f"/dashboard/products?edit={new.id}", "coach_path": f"/dashboard/price-coach/{item.id}"}
