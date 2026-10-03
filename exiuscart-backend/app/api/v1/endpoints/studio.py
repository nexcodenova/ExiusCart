"""
Product Studio: print-on-demand designs, mockups and the Brand Assets library.

  Design Studio   idea (+ style, + text) -> a print-ready design (transparent PNG when GPT makes it)
  Mockup Studio   a design + product (t-shirt, hoodie, mug...) + colour + style (on a model, flat lay,
                  Etsy-style bundle...) -> a photorealistic mockup
  Brand Assets    everything above, AI product images, uploads, and product photos brought in from the
                  seller's catalogue (Prodora imports included), in one place

Designs and mockups use the same monthly AI image allowance as the rest of AI Studio
(Launch 0, Growth 75, Scale 200). Engine: app/core/ai_studio.py.
"""
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.core import ai_studio as studio
from app.core.database import get_db
from app.models.product import Product
from app.models.product_fields import ProductImage
from app.models.studio import StudioAsset
from app.models.user import User

router = APIRouter()

KINDS = ("design", "mockup", "image", "upload")
MAX_UPLOAD = 15 * 1024 * 1024


def _shop(db: Session, shop_id: int, user: User):
    from app.core.shop_access import get_shop_for_member
    shop = get_shop_for_member(db, shop_id, user)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


def _plan(db: Session, shop_id: int) -> str:
    from app.api.v1.endpoints.dropshipping import _get_plan
    return _get_plan(shop_id, db)


def _raise(e: studio.StudioError):
    from app.api.v1.endpoints.ai_studio import _raise as raise_studio
    raise_studio(e)


def _out(a: StudioAsset) -> dict:
    return {"id": a.id, "kind": a.kind, "source": a.source, "title": a.title, "url": a.url,
            "product_id": a.product_id, "meta": a.meta or {}, "created_at": a.created_at.isoformat() if a.created_at else None}


def save_asset(db: Session, shop_id: int, kind: str, url: str, title: Optional[str], source: str = "ai",
               product_id: Optional[int] = None, meta: Optional[dict] = None) -> StudioAsset:
    a = StudioAsset(shop_id=shop_id, kind=kind, url=url, title=(title or "")[:255] or None, source=source,
                    product_id=product_id, meta=meta)
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


def _asset(db: Session, shop_id: int, asset_id: int) -> StudioAsset:
    a = db.query(StudioAsset).filter(StudioAsset.id == asset_id, StudioAsset.shop_id == shop_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Asset not found")
    return a


# ── library ──────────────────────────────────────────────────────────────────

@router.get("/shops/{shop_id}/studio/assets")
def list_assets(shop_id: int, kind: Optional[str] = None, limit: int = 120, offset: int = 0,
                db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _shop(db, shop_id, current_user)
    q = db.query(StudioAsset).filter(StudioAsset.shop_id == shop_id)
    if kind:
        kinds = [k for k in kind.split(",") if k in KINDS]
        if kinds:
            q = q.filter(StudioAsset.kind.in_(kinds))
    total = q.count()
    rows = q.order_by(StudioAsset.created_at.desc(), StudioAsset.id.desc()).offset(max(0, offset)).limit(min(max(1, limit), 200)).all()
    return {"total": total, "assets": [_out(a) for a in rows], "options": {
        "garments": list(studio.GARMENTS), "mockup_styles": list(studio.MOCKUP_STYLES), "design_styles": list(studio.DESIGN_STYLES)}}


@router.post("/shops/{shop_id}/studio/assets/upload")
async def upload_asset(shop_id: int, file: UploadFile = File(...), kind: str = Form("upload"), title: Optional[str] = Form(None),
                       db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """A seller's own file: a finished design (PNG with transparency is best) or any brand image."""
    from app.core.storage import upload_studio_asset
    _shop(db, shop_id, current_user)
    ctype = (file.content_type or "").lower()
    if ctype not in ("image/png", "image/jpeg", "image/webp"):
        raise HTTPException(status_code=400, detail="Upload a PNG, JPG or WebP image.")
    content = await file.read()
    if len(content) > MAX_UPLOAD:
        raise HTTPException(status_code=400, detail="That file is over 15 MB.")
    ext = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}[ctype]
    url = upload_studio_asset(content, shop_id, ext, ctype)
    a = save_asset(db, shop_id, "design" if kind == "design" else "upload", url, title or file.filename, source="upload")
    return _out(a)


class ImportProductIn(BaseModel):
    product_id: int


@router.post("/shops/{shop_id}/studio/assets/import-product")
def import_product_photos(shop_id: int, data: ImportProductIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """A product's photos into the library (Prodora imports are marked as such). Skips ones already there."""
    from app.models.prodora import ProdoraImportLog
    _shop(db, shop_id, current_user)
    product = db.query(Product).filter(Product.id == data.product_id, Product.shop_id == shop_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    urls = [i.url for i in db.query(ProductImage).filter(ProductImage.product_id == product.id).order_by(ProductImage.sort_order).all()]
    if not urls and product.image_url:
        urls = [product.image_url]
    from_prodora = db.query(ProdoraImportLog.id).filter(ProdoraImportLog.shop_id == shop_id, ProdoraImportLog.product_id == product.id).first() is not None
    have = {u for (u,) in db.query(StudioAsset.url).filter(StudioAsset.shop_id == shop_id, StudioAsset.url.in_(urls)).all()} if urls else set()
    added = 0
    for u in urls:
        if u in have:
            continue
        db.add(StudioAsset(shop_id=shop_id, kind="image", url=u, title=product.name[:255], product_id=product.id,
                           source="prodora" if from_prodora else "product"))
        added += 1
    db.commit()
    return {"added": added, "skipped": len(urls) - added}


@router.delete("/shops/{shop_id}/studio/assets/{asset_id}", status_code=204)
def delete_asset(shop_id: int, asset_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Removes it from the library. The file is deleted only if it was made/uploaded here and no product uses it."""
    from app.core.storage import delete_image, key_from_public_url
    _shop(db, shop_id, current_user)
    a = _asset(db, shop_id, asset_id)
    url = a.url
    db.delete(a)
    db.commit()
    key = key_from_public_url(url) or ""
    in_use = db.query(ProductImage.id).filter(ProductImage.url == url).first() or db.query(Product.id).filter(Product.image_url == url).first()
    if key.startswith(f"studio/{shop_id}/") and not in_use:
        try:
            delete_image(url)
        except Exception:
            pass


class AddToProductIn(BaseModel):
    product_id: int
    make_primary: bool = False


@router.post("/shops/{shop_id}/studio/assets/{asset_id}/add-to-product")
def add_asset_to_product(shop_id: int, asset_id: int, data: AddToProductIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from app.api.v1.endpoints.product_fields import _image_limit, _combined_image_count
    _shop(db, shop_id, current_user)
    a = _asset(db, shop_id, asset_id)
    product = db.query(Product).filter(Product.id == data.product_id, Product.shop_id == shop_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if db.query(ProductImage.id).filter(ProductImage.product_id == product.id, ProductImage.url == a.url).first():
        return {"added": False, "message": "That image is already on this product."}
    limit = _image_limit(shop_id, db)
    if _combined_image_count(product.id, db) >= limit:
        raise HTTPException(status_code=400, detail=f"Image limit reached ({limit} total across main + variants). Remove a photo first.")
    count = db.query(ProductImage).filter(ProductImage.product_id == product.id).count()
    if data.make_primary:
        for img in db.query(ProductImage).filter(ProductImage.product_id == product.id).all():
            img.is_primary = False
            img.sort_order = (img.sort_order or 0) + 1
    db.add(ProductImage(product_id=product.id, url=a.url, sort_order=0 if data.make_primary else count,
                        is_primary=data.make_primary or count == 0, alt_text=(a.title or product.name)[:255]))
    if data.make_primary or count == 0:
        product.image_url = a.url
    db.commit()
    return {"added": True}


# ── AI: designs + mockups ────────────────────────────────────────────────────

class DesignIn(BaseModel):
    idea: str
    style: Optional[str] = None
    text: Optional[str] = None


@router.post("/shops/{shop_id}/studio/design")
def create_design(shop_id: int, data: DesignIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from app.core.storage import upload_studio_asset
    _shop(db, shop_id, current_user)
    plan = _plan(db, shop_id)
    try:
        studio.check_image_allowance(db, shop_id, plan)
        content, provider = studio.generate_design(data.idea, data.style or "", data.text or "")
    except studio.StudioError as e:
        _raise(e)
    url = upload_studio_asset(content, shop_id, "png", "image/png")
    studio.log_call(db, shop_id, "image", provider, "design")
    a = save_asset(db, shop_id, "design", url, data.idea[:120], meta={"idea": data.idea[:400], "style": data.style, "text": data.text, "provider": provider})
    return {"asset": _out(a), "usage": studio.usage(db, shop_id, plan)}


class MockupIn(BaseModel):
    design_asset_id: int
    garment: str = "tshirt"
    color: str = "white"
    style: str = "model"
    model_look: Optional[str] = None
    extra: Optional[str] = None
    placement: str = "front"     # front | back
    scene: Optional[str] = None  # street | cafe | beach | home | park | studio
    fabric: str = "standard"     # standard | garment_dyed


@router.post("/shops/{shop_id}/studio/mockup")
def create_mockup(shop_id: int, data: MockupIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from app.core.storage import upload_studio_asset
    _shop(db, shop_id, current_user)
    design = _asset(db, shop_id, data.design_asset_id)
    plan = _plan(db, shop_id)
    try:
        studio.check_image_allowance(db, shop_id, plan)
        content, provider = studio.generate_mockup(design.url, data.garment, data.color, data.style, data.model_look or "", data.extra or "",
                                                   data.placement, data.scene or "", data.fabric)
    except studio.StudioError as e:
        _raise(e)
    url = upload_studio_asset(content, shop_id, "png", "image/png")
    studio.log_call(db, shop_id, "image", provider, f"mockup_{data.style}")
    title = f"{(design.title or 'Design')[:80]} · {data.color} {studio.GARMENTS.get(data.garment, data.garment)}"
    a = save_asset(db, shop_id, "mockup", url, title, meta={"design_asset_id": design.id, "garment": data.garment, "color": data.color,
                                                             "style": data.style, "model_look": data.model_look, "provider": provider,
                                                             "placement": data.placement, "scene": data.scene, "fabric": data.fabric})
    return {"asset": _out(a), "usage": studio.usage(db, shop_id, plan)}


@router.post("/shops/{shop_id}/studio/mockup-set")
def create_mockup_set(shop_id: int, data: MockupIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """A full listing set in one go: front and back on a model, a print close-up and a flat lay.
    Uses 4 AI images; needs 4 left. A shot that fails is skipped (and not counted)."""
    from app.core.storage import upload_studio_asset
    _shop(db, shop_id, current_user)
    design = _asset(db, shop_id, data.design_asset_id)
    plan = _plan(db, shop_id)
    try:
        studio.check_image_allowance(db, shop_id, plan)
    except studio.StudioError as e:
        _raise(e)
    if studio.usage(db, shop_id, plan)["images_left"] < len(studio.MOCKUP_SET):
        raise HTTPException(status_code=429, detail={"error": "limit_reached",
                            "message": f"A full set uses {len(studio.MOCKUP_SET)} AI images. Make single mockups instead, or wait for next month."})
    ref = studio.fetch_reference(design.url)
    made, errors = [], []
    for shot in studio.MOCKUP_SET:
        try:
            content, provider = studio.generate_mockup(design.url, data.garment, data.color, shot["style"], data.model_look or "",
                                                       data.extra or "", shot["placement"], data.scene or "", data.fabric, ref=ref)
        except studio.StudioError as e:
            errors.append(f"{shot['label']}: {e.message}")
            continue
        url = upload_studio_asset(content, shop_id, "png", "image/png")
        studio.log_call(db, shop_id, "image", provider, f"mockup_set_{shot['style']}_{shot['placement']}")
        title = f"{(design.title or 'Design')[:70]} · {shot['label']}"
        a = save_asset(db, shop_id, "mockup", url, title, meta={"design_asset_id": design.id, "garment": data.garment, "color": data.color,
                                                                 "style": shot["style"], "placement": shot["placement"], "scene": data.scene,
                                                                 "fabric": data.fabric, "provider": provider, "set": True})
        made.append(_out(a))
    if not made:
        raise HTTPException(status_code=502, detail={"error": "ai_failed", "message": errors[0] if errors else "The AI could not make these mockups."})
    return {"assets": made, "errors": errors, "usage": studio.usage(db, shop_id, plan)}
