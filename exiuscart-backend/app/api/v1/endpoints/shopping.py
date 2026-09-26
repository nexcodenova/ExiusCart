"""
Prodora storefront endpoints. Product browsing requires a Prodora access
token — issued only to ExiusCart accounts on an active (or trialling)
Launch, Growth or Scale subscription (see POST /shopping/request-access).
"""
from typing import Optional
from datetime import timedelta, datetime, timezone
import uuid
import httpx
from slugify import slugify
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from app.core.database import get_db
from app.core.security import create_access_token, decode_token
from app.models.product import Product, Category
from app.models.product_fields import ProductImage, ProductVideo
from app.models.shop import Shop
from app.models.user import User
from app.models.subscription import Subscription
from app.models.dropship import DropshipConnection, DropshipProductLink
from app.models.prodora import ProdoraImportLog
from app.core.intel import record_event, record_supplier_snapshot
from app.models.intel import ProductIntelResult
from app.api.v1.endpoints.dropshipping import _cj_ensure_token, CJ_BASE

router = APIRouter()

# Plans that grant Prodora access. Free trial and TheDersi plans are
# deliberately excluded — Prodora is a real, paid-plan perk, all three tiers.
PRODORA_ELIGIBLE_PLANS = ("launch", "growth", "scale")

# Launch is capped monthly; Growth gets a higher cap; Scale stays unlimited
# (None). 50/200 picked as generous enough for a real small store's normal
# pace at each tier, with Scale as the real "no ceiling" option.
PRODORA_MONTHLY_IMPORT_LIMIT = {"launch": 100, "growth": 500, "scale": None}

# The Competition analysis (market prices, real profit, verdict) is a Growth and
# Scale feature. Launch sees that it exists and what unlocks it, never the data.
INTEL_PLANS = ("growth", "scale")
INTEL_STALE_DAYS = 7

_security = HTTPBearer()


class ProdoraAccessRequest(BaseModel):
    email: EmailStr


def _find_eligible_subscription(db: Session, user: User) -> Optional[Subscription]:
    shop = (
        db.query(Shop)
        .filter(Shop.owner_id == user.id, Shop.is_active == True)
        .order_by(Shop.id.asc())
        .first()
    )
    if not shop:
        return None

    # TheDersi's Pro tier shares plan_type="launch" — the exact same value a
    # real, paying ExiusCart Launch customer has — so checking plan_type
    # alone would silently let TheDersi sellers into Prodora too, even
    # though it's exclusive to direct ExiusCart customers. Official is the
    # one TheDersi tier that's exempt — it gets full Scale access, Prodora
    # included.
    from app.core.thedersi import is_thedersi_restricted_shop
    if is_thedersi_restricted_shop(shop.id, db):
        return None

    # A trial is a real plan with everything included (Launch 7 days free,
    # Growth/Scale $1 for 7 days), so trial subscriptions get Prodora too —
    # as long as the trial hasn't run out.
    now = datetime.now(timezone.utc)
    candidates = (
        db.query(Subscription)
        .filter(
            Subscription.shop_id == shop.id,
            Subscription.status.in_(("active", "trial", "trial_dollar")),
            Subscription.plan_type.in_(PRODORA_ELIGIBLE_PLANS),
        )
        .order_by(Subscription.created_at.desc())
        .all()
    )
    for sub in candidates:
        if sub.status == "active":
            return sub
        end = sub.trial_dollar_ends_at if sub.status == "trial_dollar" else sub.trial_ends_at
        if end is None or end > now:
            return sub
    return None


async def get_prodora_user(
    credentials: HTTPAuthorizationCredentials = Depends(_security),
    db: Session = Depends(get_db),
) -> User:
    """Re-verifies plan eligibility on every call — a lapsed/downgraded
    subscription loses Prodora access immediately, not just at token expiry."""
    payload = decode_token(credentials.credentials)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == int(user_id)).first() if user_id else None
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid session")

    if not _find_eligible_subscription(db, user):
        raise HTTPException(
            status_code=403,
            detail="Prodora is available to direct ExiusCart Launch, Growth, and Scale users (including during your trial).",
        )
    return user


@router.post("/shopping/request-access")
def request_prodora_access(body: ProdoraAccessRequest, db: Session = Depends(get_db)):
    """
    Email-only access gate. Only ExiusCart accounts with an active or trialling Launch,
    Growth, or Scale subscription receive a token — TheDersi
    accounts (except TheDersi's own Official tier) are rejected with a
    clear reason.
    """
    user = db.query(User).filter(func.lower(User.email) == body.email.lower()).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="No ExiusCart account found with this email.",
        )

    if not _find_eligible_subscription(db, user):
        raise HTTPException(
            status_code=403,
            detail="Prodora is available to direct ExiusCart Launch, Growth, and Scale users (including during your trial).",
        )

    token = create_access_token(data={"sub": str(user.id)}, expires_delta=timedelta(hours=24))
    return {"access_token": token, "name": user.full_name or user.email}


_PLAN_NAMES = {"launch": "Launch", "growth": "Growth", "scale": "Scale"}


@router.get("/shopping/me")
def prodora_me(db: Session = Depends(get_db), user: User = Depends(get_prodora_user)):
    """
    The signed-in seller's Prodora standing: plan, trial end and this month's
    import allowance. Powers the account menu and the Instructions page.
    """
    from app.api.v1.endpoints.usage import PRODUCT_LIMITS

    sub = _find_eligible_subscription(db, user)
    shop = (
        db.query(Shop)
        .filter(Shop.owner_id == user.id, Shop.is_active == True)
        .order_by(Shop.id.asc())
        .first()
    )
    plan = sub.plan_type if sub else None
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    next_month = (month_start + timedelta(days=32)).replace(day=1)

    imports_used = 0
    store_products = 0
    if shop:
        imports_used = db.query(ProdoraImportLog).filter(
            ProdoraImportLog.shop_id == shop.id,
            ProdoraImportLog.created_at >= month_start,
        ).count()
        store_products = db.query(func.count(Product.id)).filter(
            Product.shop_id == shop.id, Product.is_active == True,
        ).scalar() or 0

    trial_end = None
    if sub and sub.status in ("trial", "trial_dollar"):
        trial_end = sub.trial_dollar_ends_at if sub.status == "trial_dollar" else sub.trial_ends_at

    return {
        "name": user.full_name or user.email,
        "email": user.email,
        "plan_type": plan,
        "plan_name": _PLAN_NAMES.get(plan or "", "Free"),
        "status": sub.status if sub else None,
        "trial_ends_at": trial_end.isoformat() if trial_end else None,
        "imports": {
            "used": imports_used,
            "limit": PRODORA_MONTHLY_IMPORT_LIMIT.get(plan or "", 0),
            "resets_at": next_month.isoformat(),
        },
        "store_products": {"used": store_products, "limit": PRODUCT_LIMITS.get(plan or "")},
    }


def _product_out(p: Product) -> dict:
    selling = float(p.price)
    buying = float(p.cost_price) if p.cost_price else None
    discount_pct = None
    if buying and selling and buying > 0 and selling < buying:
        discount_pct = round((1 - selling / buying) * 100)
    return {
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "price": selling,
        "cost_price": buying,
        "discount_pct": discount_pct,
        "currency": "USD",
        "image_url": p.image_url,
        "images": [img.url for img in sorted(p.images, key=lambda i: i.sort_order)] if p.images else [],
        "video_url": getattr(p, "video_url", None),
        "videos": [{"url": v.url, "platform": v.platform, "thumbnail_url": v.thumbnail_url, "title": v.title, "embed_html": v.embed_html} for v in p.videos] if p.videos else [],
        "source_url": getattr(p, "source_url", None),
        "is_trending": p.is_trending,
        "is_featured": p.is_featured,
        "is_bestseller": bool(p.is_bestseller),
        "stock": p.quantity,
        "sku": p.sku,
        "category_name": p.category.name if p.category else None,
        "category_slug": p.category.slug if p.category else None,
        "category_id": p.category_id,
        "variants": [{"color": v.color, "color_hex": v.color_hex} for v in p.variants] if p.variants else [],
        "winning_score": p.winning_score,
        "trend_percent": float(p.trend_percent) if p.trend_percent is not None else None,
        "competition_level": p.competition_level,
        "saturation_level": p.saturation_level,
        "orders_count": p.orders_count,
        "supplier_name": p.supplier_name,
        "supplier_rating": float(p.supplier_rating) if p.supplier_rating is not None else None,
        "fulfillment_rate": float(p.fulfillment_rate) if p.fulfillment_rate is not None else None,
        "processing_time": p.processing_time,
        "shipping_time": p.shipping_time,
        "warehouse_country": p.warehouse_country,
        "shipping_cost": float(p.shipping_cost) if p.shipping_cost is not None else None,
        "demand_trend_json": p.demand_trend_json,
        "orders_trend_json": p.orders_trend_json,
        "top_countries_json": p.top_countries_json,
        "ad_facebook_url": p.ad_facebook_url,
        "ad_tiktok_url": p.ad_tiktok_url,
        "ad_instagram_url": p.ad_instagram_url,
        "ad_pinterest_url": p.ad_pinterest_url,
        "specs_json": p.specs_json,
        "tags": p.tags,
    }


@router.get("/shopping/products")
def list_shopping_products(
    search: Optional[str] = None,
    category: Optional[str] = None,      # category slug
    trending: Optional[bool] = None,
    featured: Optional[bool] = None,
    bestseller: Optional[bool] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_prodora_user),
):
    """
    Product listing for the Prodora storefront. Requires a valid Prodora
    access token (see POST /shopping/request-access).
    Only returns active products from active shops.
    """
    query = (
        db.query(Product)
        .outerjoin(Category, Product.category_id == Category.id)
        .options(
            joinedload(Product.shop),
            joinedload(Product.category),
        )
        .filter(
            Product.is_active == True,
            Product.shop_id.is_(None),  # the Prodora catalogue belongs to no shop
        )
    )

    if search:
        # Every word must match somewhere (name, description, tags, SKU,
        # supplier or category), in any order: "phone cleaner" finds
        # "Mobile Phone Screen Cleaner". LIKE wildcards typed by the user are
        # escaped so "50%" or "a_b" search literally.
        from sqlalchemy import or_
        for word in search.split():
            like = "%" + word.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
            query = query.filter(or_(
                Product.name.ilike(like, escape="\\"),
                Product.description.ilike(like, escape="\\"),
                Product.tags.ilike(like, escape="\\"),
                Product.sku.ilike(like, escape="\\"),
                Product.supplier_name.ilike(like, escape="\\"),
                Category.name.ilike(like, escape="\\"),
            ))

    if category:
        query = query.filter(Category.slug == category)

    if trending is True:
        query = query.filter(Product.is_trending == True)

    if featured is True:
        query = query.filter(Product.is_featured == True)

    if bestseller is True:
        query = query.filter(Product.is_bestseller == True)

    # Trending first, then featured, then newest
    products = query.order_by(
        Product.is_trending.desc(),
        Product.is_featured.desc(),
        Product.created_at.desc(),
    ).limit(100).all()

    out = [_product_out(p) for p in products]
    # Growth and Scale also see each product's verdict on the cards. One small
    # query for all of them (the newest analysis per product), and nothing at
    # all for Launch, so the data is never sent to a plan that can't see it.
    sub = _find_eligible_subscription(db, user)
    if out and sub and sub.plan_type in INTEL_PLANS:
        ids = [p["id"] for p in out]
        newest = (db.query(func.max(ProductIntelResult.id))
                  .filter(ProductIntelResult.market == "US", ProductIntelResult.product_id.in_(ids))
                  .group_by(ProductIntelResult.product_id))
        rows = db.query(ProductIntelResult.product_id, ProductIntelResult.verdict, ProductIntelResult.confidence).filter(ProductIntelResult.id.in_(newest)).all()
        by_id = {pid: (v, c) for pid, v, c in rows}
        for p in out:
            if p["id"] in by_id:
                p["intel_verdict"], p["intel_confidence"] = by_id[p["id"]]
    return out


@router.get("/shopping/products/{product_id}")
def get_shopping_product(
    product_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_prodora_user),
):
    product = (
        db.query(Product)
        .options(
            joinedload(Product.shop),
            joinedload(Product.category),
        )
        .filter(
            Product.id == product_id,
            Product.is_active == True,
            Product.shop_id.is_(None),  # the Prodora catalogue belongs to no shop
        )
        .first()
    )
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    # Every open of the product page counts, not one per device. Shown as
    # "Views" on the admin All Products list.
    product.view_count = (product.view_count or 0) + 1
    db.commit()
    record_event(db, "prodora_product_viewed", user_id=user.id, entity_type="prodora_product", entity_id=product.id)
    return _product_out(product)


@router.get("/shopping/products/{product_id}/related")
def get_related_shopping_products(
    product_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_prodora_user),
):
    """Same-category products, excluding this one, for the 'Related Winning
    Products' rail — reuses the same active/shop filter as the main listing."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product or not product.category_id:
        return []

    rows = (
        db.query(Product)
        .options(joinedload(Product.shop), joinedload(Product.category))
        .filter(
            Product.category_id == product.category_id,
            Product.id != product_id,
            Product.is_active == True,
            Product.shop_id.is_(None),  # the Prodora catalogue belongs to no shop
        )
        .order_by(Product.is_trending.desc(), Product.created_at.desc())
        .limit(8)
        .all()
    )
    return [_product_out(p) for p in rows]


def _seller_intel_view(row: ProductIntelResult) -> dict:
    """What a Growth/Scale seller may see of an analysis: the verdict and its
    evidence, never the operator side (paid-usage counts, which keys are set up,
    who ran it). Only sources that actually answered are named."""
    snap, ev = row.snapshot or {}, row.evaluation or {}
    captured = snap.get("captured_at")
    stale = False
    try:
        when = datetime.fromisoformat(captured) if captured else None
        stale = bool(when and (datetime.now(timezone.utc) - (when if when.tzinfo else when.replace(tzinfo=timezone.utc))).days >= INTEL_STALE_DAYS)
    except ValueError:
        pass
    listings = snap.get("listings") or []
    by_market: dict = {}
    for l in listings:
        by_market[l["marketplace"]] = by_market.get(l["marketplace"], 0) + 1
    econ = ev.get("economics") or {}
    rng = ev.get("price_range") or {}
    return {
        "verdict": ev.get("verdict"), "headline": ev.get("headline"), "confidence": ev.get("confidence"),
        "reasons_for": ev.get("reasons_for") or [], "concerns": ev.get("concerns") or [],
        "captured_at": captured, "stale": stale, "market": snap.get("market", "US"),
        "product_type": (snap.get("fingerprint") or {}).get("product_type"),
        "target_margin_pct": ev.get("target_margin_pct"), "basis_price": ev.get("basis_price"),
        "price": {"market": rng.get("market"), "low": rng.get("low"), "high": rng.get("high"), "floor": rng.get("floor"), "note": rng.get("note")},
        "economics": {"lines": econ.get("lines") or [], "profit": econ.get("contribution_profit"), "margin_pct": econ.get("contribution_margin_pct"),
                      "break_even_cac": econ.get("break_even_cac"), "break_even_roas": econ.get("break_even_roas"),
                      "assumptions": econ.get("assumptions") or [], "advertising_included": econ.get("advertising_included", False)},
        "checked": [{"source": s["source"], "count": s["count"]} for s in snap.get("sources", []) if s.get("status") == "ok"],
        "competitor_count": len(listings), "by_marketplace": by_market, "match_method": snap.get("match_method"),
        "competitors": [{"marketplace": l["marketplace"], "title": l["title"], "price": l["price"], "url": l.get("url"),
                         "rating": l.get("rating"), "review_count": l.get("review_count")} for l in listings[:15]],
        "not_measured": ev.get("not_measured") or [],
    }


@router.get("/shopping/products/{product_id}/intelligence")
def get_shopping_product_intelligence(
    product_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_prodora_user),
):
    """The Competition section of a Prodora product page.

    Always answers 200 (never 403): the Prodora site signs a seller out on a 403,
    and being on the Launch plan is not a reason to be signed out. Instead the
    response says `locked` and what unlocks it."""
    product = db.query(Product).filter(Product.id == product_id, Product.is_active == True, Product.shop_id.is_(None)).first()  # noqa: E712
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    sub = _find_eligible_subscription(db, user)
    plan = sub.plan_type if sub else None
    row = (db.query(ProductIntelResult)
           .filter(ProductIntelResult.product_id == product_id, ProductIntelResult.market == "US")
           .order_by(ProductIntelResult.id.desc()).first())
    if plan not in INTEL_PLANS:
        return {"locked": True, "plan": plan, "required_plan": "growth", "available": row is not None}
    if not row:
        return {"locked": False, "available": False}
    record_event(db, "prodora_intel_viewed", user_id=user.id, entity_type="prodora_product", entity_id=product_id,
                 payload={"verdict": row.verdict})
    return {"locked": False, "available": True, "analysis": _seller_intel_view(row)}


@router.post("/shopping/products/{product_id}/import")
def import_shopping_product(
    product_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_prodora_user),
):
    """
    One-click import: copies a Prodora catalog product into the calling
    seller's own ExiusCart shop as a real, editable product — pre-filled
    with name, price, description, and photo. Previously "Add to My
    ExiusCart Store" was just a link to log in; the seller had to rebuild
    the whole listing by hand.
    """
    source = (
        db.query(Product)
        .options(joinedload(Product.category))
        .filter(
            Product.id == product_id,
            Product.is_active == True,
            Product.shop_id.is_(None),  # the Prodora catalogue belongs to no shop
        )
        .first()
    )
    if not source:
        raise HTTPException(status_code=404, detail="Product not found")

    shop = (
        db.query(Shop)
        .filter(Shop.owner_id == user.id, Shop.is_active == True)
        .order_by(Shop.id.asc())
        .first()
    )
    if not shop:
        raise HTTPException(status_code=404, detail="No active ExiusCart shop found for this account")

    sub = _find_eligible_subscription(db, user)
    monthly_limit = PRODORA_MONTHLY_IMPORT_LIMIT.get(sub.plan_type if sub else "", 0)
    if monthly_limit is not None:
        month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        used = db.query(ProdoraImportLog).filter(
            ProdoraImportLog.shop_id == shop.id,
            ProdoraImportLog.created_at >= month_start,
        ).count()
        if used >= monthly_limit:
            raise HTTPException(status_code=403, detail={
                "error": "prodora_import_limit_reached",
                "limit": monthly_limit,
                "message": f"You've used all {monthly_limit} Prodora imports for this month on your {(sub.plan_type if sub else '').title()} plan. Upgrade your plan for a higher monthly import limit.",
            })

    # Match by category name into the seller's own categories — the source
    # category_id belongs to the curated catalog shop, not this seller's
    # shop, so it can't be copied directly (categories are shop-scoped).
    category_id = None
    if source.category:
        match = db.query(Category).filter(
            Category.shop_id == shop.id, Category.name == source.category.name
        ).first()
        if match:
            category_id = match.id

    # The catalogue keeps the full description; trim it to THIS seller's plan
    # limit (Launch 350, Growth 500, Scale 1,000 words) so a Scale seller keeps
    # more and nobody lands over their own limit.
    from app.api.v1.endpoints.admin import _truncate_description
    from app.api.v1.endpoints.product_fields import _description_word_limit
    seller_description = _truncate_description(source.description, _description_word_limit(shop.id, db))

    new_product = Product(
        shop_id=shop.id,
        category_id=category_id,
        name=source.name,
        description=seller_description,
        price=source.price,
        cost_price=source.cost_price,
        sku=f"{(source.sku or 'PRODORA')}-{uuid.uuid4().hex[:6]}",
        quantity=0,
        low_stock_threshold=5,
        slug=f"{slugify(source.name)}-{uuid.uuid4().hex[:6]}",
        image_url=source.image_url,
        video_url=source.video_url,
        source_url=source.source_url,
    )
    db.add(new_product)
    db.flush()

    if source.images:
        for img in sorted(source.images, key=lambda i: i.sort_order):
            db.add(ProductImage(product_id=new_product.id, url=img.url, sort_order=img.sort_order, is_primary=img.is_primary))
    elif source.image_url:
        db.add(ProductImage(product_id=new_product.id, url=source.image_url, sort_order=0, is_primary=True))

    # Full video gallery, not just the legacy single video_url column above —
    # oEmbed data (thumbnail/title/embed_html) already resolved when the
    # catalog product was created, so this is a straight copy, no new
    # network calls needed.
    if source.videos:
        for v in sorted(source.videos, key=lambda v: v.sort_order):
            db.add(ProductVideo(
                product_id=new_product.id, url=v.url, platform=v.platform,
                thumbnail_url=v.thumbnail_url, title=v.title, embed_html=v.embed_html,
                sort_order=v.sort_order,
            ))

    # Auto-carry the supplier link if this seller can actually use it — the
    # source Prodora catalog product already has a real DropshipProductLink
    # (CJ or AliExpress) from admin's own import. A seller who has ALREADY
    # connected that same supplier to their own shop gets the identical
    # link created for their new product too, same fields a direct import
    # would set (dropshipping.py's own connect flow), so ordering/auto-
    # fulfillment works immediately — no manual re-linking needed. A seller
    # with no matching connection gets nothing here (there's genuinely
    # nothing to link to yet — auto-ordering has to be billed to their own
    # supplier account, not admin's, so this can't wire itself up before
    # they connect one).
    source_link = (
        db.query(DropshipProductLink)
        .filter(DropshipProductLink.product_id == source.id, DropshipProductLink.is_primary == True)
        .first()
    )
    if source_link:
        seller_connection = (
            db.query(DropshipConnection)
            .filter(
                DropshipConnection.shop_id == shop.id,
                DropshipConnection.supplier_type == source_link.supplier_type,
                DropshipConnection.is_active == True,
            )
            .first()
        )
        if seller_connection:
            db.add(DropshipProductLink(
                shop_id=shop.id,
                product_id=new_product.id,
                supplier_type=source_link.supplier_type,
                supplier_product_id=source_link.supplier_product_id,
                supplier_product_url=source_link.supplier_product_url,
                supplier_sku=source_link.supplier_sku,
                supplier_product_name=source_link.supplier_product_name,
                cost_price=source_link.cost_price,
                shipping_estimate_days=source_link.shipping_estimate_days,
                warehouse=source_link.warehouse,
                is_primary=True,
            ))
            # quantity=0 above only made sense when there was no supplier
            # to fulfill from — a product that's actually linked to a real,
            # connected supplier shouldn't show as out-of-stock the moment
            # it's imported. Same "always available, supplier fulfills per
            # order" sentinel used for Printful/other dropship products
            # elsewhere in this file — not a live stock check against the
            # source_link, which isn't guaranteed fresh at this point.
            new_product.quantity = 999999
            new_product.low_stock_threshold = 0

    db.add(ProdoraImportLog(shop_id=shop.id, product_id=new_product.id, source_product_id=source.id))
    db.commit()
    db.refresh(new_product)
    # The event stream and supplier price history start filling from the very
    # first import (both are best-effort and can never fail the import).
    record_event(db, "prodora_product_imported", user_id=user.id, shop_id=shop.id, entity_type="prodora_product",
                 entity_id=source.id, payload={"new_product_id": new_product.id, "supplier": source.supplier_name,
                                               "linked_supplier": bool(source_link and seller_connection)})
    if source_link:
        record_supplier_snapshot(db, source_link.supplier_type, source_link.supplier_product_id, cost=source_link.cost_price,
                                 shipping=source.shipping_cost, product_id=source.id, source="import")
    return {"product_id": new_product.id, "name": new_product.name, "shop_id": shop.id}


@router.get("/shopping/products/{product_id}/shipping-estimate")
async def shopping_shipping_estimate(
    product_id: int,
    country_code: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_prodora_user),
):
    """
    Real per-country shipping cost for a Prodora catalog product, straight
    from CJ's own freight-calculate API — same mechanism a connected
    seller's own shop uses (dropshipping.py: cj_shipping_estimate), just
    running on the system shop's CJ connection instead of a per-seller one.
    404s (not a hard error) for products with no CJ link — imported before
    this was captured, or not CJ-sourced at all — so the frontend can fall
    back to the admin-entered flat shipping_cost for those.
    """
    link = (
        db.query(DropshipProductLink)
        .filter(
            DropshipProductLink.product_id == product_id,
            DropshipProductLink.supplier_type == "cj",
            DropshipProductLink.shop_id.is_(None),  # a catalogue product's link
        )
        .first()
    )
    if not link or not link.supplier_sku:
        raise HTTPException(status_code=404, detail="No live shipping estimate available for this product.")

    conn = db.query(DropshipConnection).filter(
        DropshipConnection.shop_id == link.shop_id,
        DropshipConnection.supplier_type == "cj",
        DropshipConnection.is_active == True,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="No live shipping estimate available for this product.")

    token = await _cj_ensure_token(conn, db)
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(f"{CJ_BASE}/logistic/freightCalculate", json={
                "startCountryCode": "CN",
                "endCountryCode": country_code.upper(),
                "products": [{"vid": link.supplier_sku, "quantity": 1}],
            }, headers={"CJ-Access-Token": token})
        data = r.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"CJ API error: {str(e)}")

    if not data.get("result"):
        raise HTTPException(status_code=502, detail=data.get("message", "CJ could not calculate shipping for this destination."))

    options = []
    for opt in (data.get("data") or []):
        options.append({
            "logistic_name": opt.get("logisticName") or opt.get("logisticAging") or opt.get("name") or "Standard Shipping",
            "price": float(opt.get("logisticPrice") or opt.get("price") or 0),
            "days": opt.get("logisticAging") or opt.get("aging") or None,
        })

    return {"country_code": country_code.upper(), "options": options}


@router.get("/shopping/categories")
def list_shopping_categories(db: Session = Depends(get_db), _: User = Depends(get_prodora_user)):
    """
    Returns all categories that have at least one active product in an active shop.
    """
    rows = (
        db.query(Category, func.count(Product.id))
        .join(Product, Product.category_id == Category.id)
        .filter(
            Product.is_active == True,
            Product.shop_id.is_(None),  # the Prodora catalogue belongs to no shop
            Category.prodora_managed == True,  # only categories an admin added
        )
        .group_by(Category.id)
        .order_by(Category.name)
        .all()
    )
    # image_url is set by an admin (Admin > Prodora > Categories); the Marketplace
    # only shows a category tile when one is set.
    # product_count ranks the "Top selling categories" in the Prodora filter
    # (most products first); it is not shown to sellers.
    return [
        {"id": c.id, "name": c.name, "slug": c.slug, "image_url": c.image_url, "product_count": int(n)}
        for c, n in rows
    ]
