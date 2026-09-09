"""
Storefront Insights — on-site visitor tracking (ExiusCart's own, Custom
Website channel only) + Microsoft Clarity connect/summary.

Scope, stated plainly: the tracking endpoint here can only ever see what
ExiusCart itself renders. Shopify/eBay/Daraz/TikTok/etc. own their own
frontend — there is no way to observe on-page behavior on those channels
through their seller APIs. This is deliberately scoped to Custom Website
storefronts, not "all channels."

Clarity's Data Export API (learn.microsoft.com/en-us/clarity/setup-and-installation/
clarity-data-export-api) is real but tightly rate-limited — 10 requests/day
per project, max 3 days of data per call — so the summary endpoint below
caches its result and only refetches once it's stale, rather than hitting
Clarity on every dashboard load.
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import func as sql_func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.encryption import encrypt, decrypt
from app.core.rate_limit import limiter
from app.models.shop import Shop
from app.models.product import Product
from app.models.storefront_event import StorefrontEvent
from app.models.order import Order, OrderItem
from app.models.user import User
from app.api.v1.deps import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


def _shop_or_404(shop_id: int, user: User, db: Session) -> Shop:
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


# ── Public: storefront event tracking ────────────────────────────────────────

class TrackEventIn(BaseModel):
    event: str  # view | search | add_to_cart
    product_id: Optional[int] = None
    query: Optional[str] = None


@router.post("/public/store/{shop_slug}/track")
@limiter.limit("60/minute")
def track_storefront_event(request: Request, shop_slug: str, data: TrackEventIn, db: Session = Depends(get_db)):
    shop = db.query(Shop).filter(Shop.slug == shop_slug, Shop.is_active == True).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Store not found")

    if data.event not in ("view", "search", "add_to_cart"):
        raise HTTPException(status_code=422, detail="event must be view, search, or add_to_cart")
    if data.event in ("view", "add_to_cart") and not data.product_id:
        raise HTTPException(status_code=422, detail="product_id is required for this event")
    if data.event == "search" and not (data.query or "").strip():
        raise HTTPException(status_code=422, detail="query is required for search events")

    db.add(StorefrontEvent(
        shop_id=shop.id,
        event_type=data.event,
        product_id=data.product_id,
        query=(data.query or "").strip()[:500] or None,
    ))
    db.commit()
    return {"ok": True}


# ── Dashboard: product funnel + search terms ─────────────────────────────────

@router.get("/shops/{shop_id}/storefront-insights/funnel")
def product_funnel(
    shop_id: int, days: int = 30,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    """Per-product views -> add-to-cart -> orders, from ExiusCart's own
    tracking (not Clarity — Clarity has no idea what a product is)."""
    _shop_or_404(shop_id, current_user, db)
    since = datetime.now(timezone.utc) - timedelta(days=days)

    views = dict(
        db.query(StorefrontEvent.product_id, sql_func.count(StorefrontEvent.id))
        .filter(StorefrontEvent.shop_id == shop_id, StorefrontEvent.event_type == "view",
                StorefrontEvent.created_at >= since, StorefrontEvent.product_id.isnot(None))
        .group_by(StorefrontEvent.product_id).all()
    )
    carts = dict(
        db.query(StorefrontEvent.product_id, sql_func.count(StorefrontEvent.id))
        .filter(StorefrontEvent.shop_id == shop_id, StorefrontEvent.event_type == "add_to_cart",
                StorefrontEvent.created_at >= since, StorefrontEvent.product_id.isnot(None))
        .group_by(StorefrontEvent.product_id).all()
    )
    orders = dict(
        db.query(OrderItem.product_id, sql_func.count(sql_func.distinct(OrderItem.order_id)))
        .join(Order, Order.id == OrderItem.order_id)
        .filter(Order.shop_id == shop_id, Order.created_at >= since, OrderItem.product_id.isnot(None))
        .group_by(OrderItem.product_id).all()
    )

    product_ids = set(views) | set(carts) | set(orders)
    if not product_ids:
        return {"products": [], "days": days}

    names = dict(db.query(Product.id, Product.name).filter(Product.id.in_(product_ids)).all())
    rows = []
    for pid in product_ids:
        v, c, o = views.get(pid, 0), carts.get(pid, 0), orders.get(pid, 0)
        rows.append({
            "product_id": pid,
            "name": names.get(pid, "(deleted product)"),
            "views": v,
            "add_to_cart": c,
            "orders": o,
            "view_to_cart_rate": round(c / v * 100, 1) if v else None,
            "cart_to_order_rate": round(o / c * 100, 1) if c else None,
        })
    rows.sort(key=lambda r: r["views"], reverse=True)
    return {"products": rows, "days": days}


@router.get("/shops/{shop_id}/storefront-insights/search-terms")
def search_terms(
    shop_id: int, days: int = 30, limit: int = 50,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    """Top on-site search terms, flagged with how many products actually
    match the term by name — a term with 0-1 matches and real search volume
    is a real content gap, not just noise. Feeds into AI SEO Tools rather
    than duplicating them: this surfaces the gap, the existing product-
    description generator fixes it."""
    _shop_or_404(shop_id, current_user, db)
    since = datetime.now(timezone.utc) - timedelta(days=days)

    rows = (
        db.query(StorefrontEvent.query, sql_func.count(StorefrontEvent.id).label("count"))
        .filter(StorefrontEvent.shop_id == shop_id, StorefrontEvent.event_type == "search",
                StorefrontEvent.created_at >= since, StorefrontEvent.query.isnot(None))
        .group_by(StorefrontEvent.query)
        .order_by(sql_func.count(StorefrontEvent.id).desc())
        .limit(limit)
        .all()
    )

    results = []
    for query, count in rows:
        match_count = db.query(sql_func.count(Product.id)).filter(
            Product.shop_id == shop_id, Product.name.ilike(f"%{query}%"),
        ).scalar() or 0
        results.append({"query": query, "search_count": count, "matching_products": match_count})
    return {"terms": results, "days": days}


# ── Microsoft Clarity connect + summary ──────────────────────────────────────

class ClarityConnectIn(BaseModel):
    project_id: str
    api_token: str


@router.get("/shops/{shop_id}/clarity/status")
def clarity_status(shop_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    shop = _shop_or_404(shop_id, current_user, db)
    return {"connected": bool(shop.clarity_project_id and shop.clarity_api_token_enc), "project_id": shop.clarity_project_id}


@router.post("/shops/{shop_id}/clarity/connect")
def connect_clarity(
    shop_id: int, body: ClarityConnectIn,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    shop = _shop_or_404(shop_id, current_user, db)
    if not body.project_id.strip() or not body.api_token.strip():
        raise HTTPException(status_code=422, detail="Both the Project ID and API token are required.")
    shop.clarity_project_id = body.project_id.strip()
    shop.clarity_api_token_enc = encrypt(body.api_token.strip())
    db.commit()
    return {"connected": True}


@router.delete("/shops/{shop_id}/clarity/connect")
def disconnect_clarity(shop_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    shop = _shop_or_404(shop_id, current_user, db)
    shop.clarity_project_id = None
    shop.clarity_api_token_enc = None
    db.commit()
    return {"connected": False}


# In-process cache — Clarity allows only 10 API calls/project/day, so this
# is deliberately not re-fetched on every dashboard load. Good enough for a
# single-instance deploy; would need a real cache (Redis) behind more than
# one backend process.
_clarity_cache: dict = {}
_CLARITY_CACHE_TTL_HOURS = 3


@router.get("/shops/{shop_id}/clarity/summary")
def clarity_summary(shop_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    shop = _shop_or_404(shop_id, current_user, db)
    if not shop.clarity_project_id or not shop.clarity_api_token_enc:
        raise HTTPException(status_code=400, detail={
            "error": "clarity_not_connected",
            "message": "Connect Microsoft Clarity first — free at clarity.microsoft.com.",
        })

    cached = _clarity_cache.get(shop_id)
    now = datetime.now(timezone.utc)
    if cached and (now - cached["fetched_at"]) < timedelta(hours=_CLARITY_CACHE_TTL_HOURS):
        return {**cached["data"], "cached": True}

    # UNVERIFIED against a live call — Clarity's own docs confirm the
    # endpoint, Bearer auth, and that projectId/numOfDays are "the basic
    # parameters," but not definitively whether they're query params vs a
    # POST body. Sent as query params here (GET); needs checking against a
    # real Project ID + token before fully trusting it, same discipline as
    # every other endpoint this session built from a docs summary rather
    # than a full spec.
    token = decrypt(shop.clarity_api_token_enc)
    try:
        with httpx.Client(timeout=15) as client:
            r = client.get(
                "https://www.clarity.ms/export-data/api/v1/project-live-insights",
                params={"projectId": shop.clarity_project_id, "numOfDays": 3},
                headers={"Authorization": f"Bearer {token}"},
            )
        data = r.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Microsoft Clarity API error: {str(e)}")

    if r.status_code >= 300:
        raise HTTPException(status_code=502, detail=f"Microsoft Clarity rejected this request: {data}")

    result = {"raw": data, "clarity_url": f"https://clarity.microsoft.com/projects/view/{shop.clarity_project_id}/dashboard"}
    _clarity_cache[shop_id] = {"fetched_at": now, "data": result}
    return {**result, "cached": False}
