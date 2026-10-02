"""
AI Studio endpoints: suggest better copy for a product and make product images
(clean studio shots, lifestyle scenes, clothing on a model, ad banners).

Sellers (their own products, plan limits: images Growth 75 / Scale 200 a month,
Launch none; copy rewrites up to 100 a day) and the admin Prodora catalogue
(no seller limit, still logged for the spend meter). Suggestions are never
saved on their own: the seller sees old vs new and applies what they want.
The engine is app/core/ai_studio.py.
"""
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.core import ai_studio as studio
from app.core.admin_access import require_admin_perm
from app.core.database import get_db
from app.models.product import Product
from app.models.product_fields import ProductImage
from app.models.user import User

router = APIRouter()


class ImageIn(BaseModel):
    mode: str                      # studio | lifestyle | model | ad
    reference_url: str             # one of the product's own photos
    extra: Optional[str] = None    # optional direction, e.g. "beach background"
    model_look: Optional[str] = None  # clothing mode: e.g. "woman, 30s, casual"


class ApplyIn(BaseModel):
    title: Optional[str] = None
    seo_title: Optional[str] = None
    meta_description: Optional[str] = None
    description_html: Optional[str] = None
    benefits: Optional[List[str]] = None
    faq: Optional[List[Dict[str, str]]] = None
    keywords: Optional[List[str]] = None


class AddImageIn(BaseModel):
    url: str
    make_primary: bool = False


def _raise(e: studio.StudioError):
    status = {"plan_required": 403, "limit_reached": 429, "not_configured": 503, "no_reference": 400, "bad_request": 400}.get(e.code, 502)
    # 403s here are business refusals; the store app keeps the seller signed in on 403 for this route
    raise HTTPException(status_code=status, detail={"error": e.code, "message": e.message})


def _seller_product(db: Session, shop_id: int, product_id: int, user: User) -> Product:
    from app.core.shop_access import get_shop_for_member
    if not get_shop_for_member(db, shop_id, user):
        raise HTTPException(status_code=404, detail="Shop not found")
    product = db.query(Product).filter(Product.id == product_id, Product.shop_id == shop_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


def _plan(db: Session, shop_id: int) -> str:
    from app.api.v1.endpoints.dropshipping import _get_plan
    return _get_plan(shop_id, db)


def _shop_country(db: Session, shop_id: Optional[int]) -> str:
    if not shop_id:
        return ""
    from app.models.shop import Shop
    shop = db.query(Shop).filter(Shop.id == shop_id).first()
    return (shop.country or "") if shop else ""


def _brief(product: Product) -> dict:
    variants = [" ".join(x for x in (v.color, v.size) if x) for v in (product.variants or [])][:20]
    return {
        "name": product.name, "description": (product.description or "")[:4000],
        "category": product.category.name if getattr(product, "category", None) else None,
        "price": float(product.price) if product.price is not None else None,
        "variants": [v for v in variants if v], "current_keywords": product.seo_keywords or [],
    }


def _current(product: Product) -> dict:
    return {
        "title": product.name, "seo_title": product.seo_title, "meta_description": product.meta_description,
        "description_html": product.description, "benefits": [h.get("label") for h in (product.highlights or []) if isinstance(h, dict)],
        "faq": product.faq or [], "keywords": product.seo_keywords or [],
    }


def _improve(db: Session, product: Product, shop_id: Optional[int]) -> dict:
    try:
        keywords, kw_provider = studio.seo_keywords(_brief(product), _shop_country(db, shop_id))
        studio.log_call(db, shop_id, "text", kw_provider, "seo_keywords")
        copy, copy_provider = studio.improve_copy(_brief(product), keywords)
        studio.log_call(db, shop_id, "text", copy_provider, "product_copy")
    except studio.StudioError as e:
        _raise(e)
    return {"current": _current(product), "suggested": {**copy, "keywords": keywords},
            "providers": {"keywords": kw_provider, "copy": copy_provider}}


def _make_image(db: Session, product: Product, shop_id: Optional[int], data: ImageIn) -> dict:
    from app.core.storage import upload_image
    try:
        content, provider = studio.generate_image(data.mode, product.name, data.reference_url, data.extra or "", data.model_look or "")
    except studio.StudioError as e:
        _raise(e)
    url = upload_image(content, shop_id or 0, product.id, "png", "image/png")
    studio.log_call(db, shop_id, "image", provider, f"image_{data.mode}")
    if shop_id:  # every seller AI image also lands in their Brand Assets library
        from app.api.v1.endpoints.studio import save_asset
        save_asset(db, shop_id, "image", url, f"{product.name[:100]} · {data.mode}", product_id=product.id,
                   meta={"mode": data.mode, "provider": provider})
    return {"url": url, "provider": provider}


# ── seller ───────────────────────────────────────────────────────────────────

@router.get("/shops/{shop_id}/ai-studio/usage")
def studio_usage(shop_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from app.core.shop_access import get_shop_for_member
    if not get_shop_for_member(db, shop_id, current_user):
        raise HTTPException(status_code=404, detail="Shop not found")
    return studio.usage(db, shop_id, _plan(db, shop_id))


@router.post("/shops/{shop_id}/ai-studio/products/{product_id}/improve")
def studio_improve(shop_id: int, product_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    product = _seller_product(db, shop_id, product_id, current_user)
    try:
        studio.check_text_allowance(db, shop_id)
    except studio.StudioError as e:
        _raise(e)
    return _improve(db, product, shop_id)


class WriteIn(BaseModel):
    name: str                       # what the product is, in the seller's words
    details: Optional[str] = None   # anything they know: material, sizes, use...
    category: Optional[str] = None
    price: Optional[float] = None


@router.post("/shops/{shop_id}/ai-studio/write")
def studio_write(shop_id: int, data: WriteIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """AI Product Creator: a full listing from a few words, before the product exists.
    The seller reviews it; the page then creates the product the normal way (plan limits apply)."""
    from app.core.shop_access import get_shop_for_member
    if not get_shop_for_member(db, shop_id, current_user):
        raise HTTPException(status_code=404, detail="Shop not found")
    if not data.name.strip():
        raise HTTPException(status_code=400, detail={"error": "bad_request", "message": "Say what the product is."})
    brief = {"name": data.name.strip()[:200], "description": (data.details or "").strip()[:3000],
             "category": (data.category or "").strip()[:100] or None, "price": data.price}
    try:
        studio.check_text_allowance(db, shop_id)
        keywords, kw_provider = studio.seo_keywords(brief, _shop_country(db, shop_id))
        studio.log_call(db, shop_id, "text", kw_provider, "seo_keywords")
        copy, copy_provider = studio.improve_copy(brief, keywords)
        studio.log_call(db, shop_id, "text", copy_provider, "product_create")
    except studio.StudioError as e:
        _raise(e)
    empty = {"title": brief["name"], "seo_title": None, "meta_description": None, "description_html": brief["description"] or None,
             "benefits": [], "faq": [], "keywords": []}
    return {"current": empty, "suggested": {**copy, "keywords": keywords}, "providers": {"keywords": kw_provider, "copy": copy_provider}}


@router.post("/shops/{shop_id}/ai-studio/products/{product_id}/apply")
def studio_apply(shop_id: int, product_id: int, data: ApplyIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Saves only the parts the seller ticked."""
    product = _seller_product(db, shop_id, product_id, current_user)
    _apply(product, data)
    db.commit()
    return {"saved": True, "current": _current(product)}


def _apply(product: Product, data: ApplyIn) -> None:
    if data.title:
        product.name = data.title.strip()[:255]
    if data.seo_title is not None:
        product.seo_title = data.seo_title.strip()[:80] or None
    if data.meta_description is not None:
        product.meta_description = data.meta_description.strip()[:200] or None
    if data.description_html:
        product.description = studio._clean_html(data.description_html)
    if data.benefits is not None:
        product.highlights = [{"icon": "check-circle", "label": b.strip()[:80]} for b in data.benefits if b.strip()][:6]
    if data.faq is not None:
        product.faq = [{"question": f.get("question", "")[:200], "answer": f.get("answer", "")[:800]}
                       for f in data.faq if f.get("question") and f.get("answer")][:8]
    if data.keywords is not None:
        product.seo_keywords = [k.strip()[:60] for k in data.keywords if k.strip()][:15]


@router.post("/shops/{shop_id}/ai-studio/products/{product_id}/image")
def studio_image(shop_id: int, product_id: int, data: ImageIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    product = _seller_product(db, shop_id, product_id, current_user)
    plan = _plan(db, shop_id)
    try:
        studio.check_image_allowance(db, shop_id, plan)
    except studio.StudioError as e:
        _raise(e)
    out = _make_image(db, product, shop_id, data)
    return {**out, "usage": studio.usage(db, shop_id, plan)}


@router.post("/shops/{shop_id}/ai-studio/products/{product_id}/image/add")
def studio_add_image(shop_id: int, product_id: int, data: AddImageIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Puts a generated image into the product's gallery, within the plan's image limit."""
    from app.core.storage import key_from_public_url
    from app.api.v1.endpoints.product_fields import _image_limit, _combined_image_count
    product = _seller_product(db, shop_id, product_id, current_user)
    key = key_from_public_url(data.url) or ""
    if not key.startswith(f"products/{shop_id}/{product_id}/"):
        raise HTTPException(status_code=400, detail="That image wasn't made for this product.")
    limit = _image_limit(shop_id, db)
    if _combined_image_count(product_id, db) >= limit:
        raise HTTPException(status_code=400, detail=f"Image limit reached ({limit} total across main + variants). Remove a photo first.")
    count = db.query(ProductImage).filter(ProductImage.product_id == product_id).count()
    if data.make_primary:
        for img in db.query(ProductImage).filter(ProductImage.product_id == product_id).all():
            img.is_primary = False
            img.sort_order = (img.sort_order or 0) + 1
        product.image_url = data.url
    db.add(ProductImage(product_id=product_id, url=data.url, sort_order=0 if data.make_primary else count,
                        is_primary=data.make_primary or count == 0, alt_text=product.name[:255]))
    if count == 0:
        product.image_url = data.url
    db.commit()
    return {"added": True}


# ── admin (Prodora catalogue) ────────────────────────────────────────────────

def _catalogue_product(db: Session, product_id: int) -> Product:
    product = db.query(Product).filter(Product.id == product_id, Product.shop_id.is_(None)).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.post("/admin/ai-studio/products/{product_id}/improve")
def admin_studio_improve(product_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin_perm("prodora.edit"))):
    return _improve(db, _catalogue_product(db, product_id), None)


@router.post("/admin/ai-studio/products/{product_id}/apply")
def admin_studio_apply(product_id: int, data: ApplyIn, db: Session = Depends(get_db), _: User = Depends(require_admin_perm("prodora.edit"))):
    """Saves the fields the admin form doesn't have (Google title/description, highlights, FAQ,
    keywords); the form itself fills in the name and description, so its Save can't undo them."""
    product = _catalogue_product(db, product_id)
    _apply(product, data)
    db.commit()
    return {"saved": True, "current": _current(product)}


@router.post("/admin/ai-studio/products/{product_id}/image")
def admin_studio_image(product_id: int, data: ImageIn, db: Session = Depends(get_db), _: User = Depends(require_admin_perm("prodora.edit"))):
    """Returns the new image's URL; the admin form adds it to the product's photos."""
    return _make_image(db, _catalogue_product(db, product_id), None, data)
