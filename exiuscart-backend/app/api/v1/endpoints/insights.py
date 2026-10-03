"""
Product Insights in the ExiusCart store (AI Commerce): for any of the seller's products,
quick research links (Google Trends, Amazon, eBay, TikTok, Meta Ad Library) and, on
Growth/Scale, the market check and "Who to target".

A product imported from Prodora brings Prodora's real market check (Amazon/eBay prices,
Google Trends, TikTok) with it, read live from the catalogue product, plus its saved
audience. The seller's own products get links and an AI audience they can generate.
"""
from urllib.parse import quote_plus

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.core.database import get_db
from app.models.product import Product
from app.models.user import User

router = APIRouter()
PLANS = ("growth", "scale")


def _product(db: Session, shop_id: int, product_id: int, user: User) -> Product:
    from app.core.shop_access import get_shop_for_member
    if not get_shop_for_member(db, shop_id, user):
        raise HTTPException(status_code=404, detail="Shop not found")
    p = db.query(Product).filter(Product.id == product_id, Product.shop_id == shop_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    return p


def _plan(db: Session, shop_id: int) -> str:
    from app.api.v1.endpoints.dropshipping import _get_plan
    return _get_plan(shop_id, db)


def research_links(keyword: str, amazon_url=None, ebay_url=None) -> dict:
    from app.core.meta_ad_library import ad_library_search_url
    q = quote_plus(keyword)
    return {
        "google_trends": f"https://trends.google.com/trends/explore?date=today%205-y&q={q}",
        "amazon": amazon_url or f"https://www.amazon.com/s?k={q}",
        "ebay": ebay_url or f"https://www.ebay.com/sch/i.html?_nkw={q}",
        "tiktok": f"https://www.tiktok.com/search?q={q}",
        "meta_ads": ad_library_search_url(keyword, "ALL"),
    }


@router.get("/shops/{shop_id}/products/{product_id}/insights")
def product_insights(shop_id: int, product_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from app.core.meta_ad_library import ad_library_keyword
    from app.models.intel import ProductIntelResult
    from app.models.prodora import ProdoraImportLog
    from app.api.v1.endpoints.shopping import _seller_intel_view
    p = _product(db, shop_id, product_id, current_user)
    plan = _plan(db, shop_id)
    unlocked = plan in PLANS

    log = db.query(ProdoraImportLog).filter(ProdoraImportLog.shop_id == shop_id, ProdoraImportLog.product_id == p.id).first()
    source = db.query(Product).filter(Product.id == log.source_product_id, Product.shop_id.is_(None)).first() if log and log.source_product_id else None

    keyword = ad_library_keyword((source or p).name)
    analysis = None
    if source and unlocked:
        row = (db.query(ProductIntelResult).filter(ProductIntelResult.product_id == source.id, ProductIntelResult.market == "US")
               .order_by(ProductIntelResult.id.desc()).first())
        analysis = _seller_intel_view(row) if row else None
    audience = (p.audience_json or (source.audience_json if source else None)) if unlocked else None
    return {
        "product": {"id": p.id, "name": p.name, "image_url": p.image_url},
        "from_prodora": source is not None,
        "keyword": keyword,
        "links": research_links(keyword, source.amazon_url if source else None, source.ebay_url if source else None),
        "locked": not unlocked, "plan": plan,
        "analysis": analysis,
        "audience": audience,
    }


@router.post("/shops/{shop_id}/products/{product_id}/insights/audience")
def generate_audience(shop_id: int, product_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Makes (or refreshes) "Who to target" for one of the seller's products. Growth/Scale."""
    from app.core import ai_studio
    from app.intel import audience
    from app.models.prodora import ProdoraImportLog
    p = _product(db, shop_id, product_id, current_user)
    if _plan(db, shop_id) not in PLANS:
        raise HTTPException(status_code=403, detail={"error": "plan_required", "message": "Who to target is part of the Growth and Scale plans."})
    try:
        ai_studio.check_text_allowance(db, shop_id)
    except ai_studio.StudioError as e:
        raise HTTPException(status_code=429, detail={"error": e.code, "message": e.message})
    log = db.query(ProdoraImportLog).filter(ProdoraImportLog.shop_id == shop_id, ProdoraImportLog.product_id == p.id).first()
    snap = audience.latest_snapshot(db, log.source_product_id) if log and log.source_product_id else None
    # Imported from Prodora and the catalogue product already has it: copy it, no AI call, no charge
    if log and log.source_product_id and not p.audience_json:
        src = db.query(Product).filter(Product.id == log.source_product_id).first()
        if src and src.audience_json:
            p.audience_json = src.audience_json
            db.commit()
            return {"audience": p.audience_json}
    out = audience.build(audience.product_brief(p), snap)
    if not out:
        raise HTTPException(status_code=503, detail={"error": "not_configured", "message": "The AI couldn't answer right now. Try again in a minute."})
    p.audience_json = out
    db.commit()
    ai_studio.log_call(db, shop_id, "text", "audience", "audience")
    return {"audience": out}
