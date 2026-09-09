"""
Prodora Digital Bundles — ExiusCart's own design packs (coloring books,
POD design sets) sold to sellers through Prodora, fulfilled the same way
any other digital product in this codebase is: a real file, gated behind
proof of payment.

The one thing that's genuinely different from every other Whop usage here:
everywhere else, a SELLER connects their OWN Whop account and sells to
THEIR OWN customers (see whop.py — per-shop ChannelConnection, per-shop
webhook_secret). Here, ExiusCart itself is the seller and Prodora sellers
are the buyers — so this needs its own single, platform-level webhook
(PRODORA_WHOP_WEBHOOK_SECRET, one value, not per-shop) rather than reusing
whop.py's per-connection one.

UNVERIFIED: Whop's payment.succeeded payload shape for the buyer's email
and which product/plan was purchased isn't confirmed from public docs the
way CJ's or HyperSKU's request shapes were — this tries the plausible key
names defensively (same discipline as Zendrop's response parsing) and
logs clearly when a payment can't be auto-matched, rather than silently
dropping it. admin_grant_purchase below exists specifically as the manual
fallback for exactly that case — confirm the real field names against a
live payment before trusting the automatic path fully.
"""

import os
import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.models.shop import Shop
from app.models.prodora_digital import ProdoraDigitalBundle, ProdoraDigitalPurchase
from app.api.v1.endpoints.admin import require_superuser
from app.api.v1.endpoints.shopping import get_prodora_user
from app.api.v1.endpoints.whop import _verify_whop_webhook_signature

logger = logging.getLogger(__name__)
router = APIRouter()

PRODORA_WHOP_WEBHOOK_SECRET = os.getenv("PRODORA_WHOP_WEBHOOK_SECRET", "")


def _seller_shop(user: User, db: Session) -> Shop:
    shop = db.query(Shop).filter(Shop.owner_id == user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="No shop found for this account.")
    return shop


def _bundle_out(b: ProdoraDigitalBundle, purchased: bool) -> dict:
    return {
        "id": b.id, "name": b.name, "description": b.description,
        "cover_image_url": b.cover_image_url,
        "price": float(b.price), "suggested_resale_price": float(b.suggested_resale_price) if b.suggested_resale_price is not None else None,
        "resale_notes": b.resale_notes,
        "ad_facebook_url": b.ad_facebook_url, "ad_tiktok_url": b.ad_tiktok_url,
        "ad_instagram_url": b.ad_instagram_url, "ad_pinterest_url": b.ad_pinterest_url,
        "whop_checkout_url": b.whop_checkout_url,
        "purchased": purchased,
    }


# ── Admin: manage bundles ─────────────────────────────────────────────────────

class BundleIn(BaseModel):
    name: str
    description: Optional[str] = None
    cover_image_url: Optional[str] = None
    editable_file_url: Optional[str] = None
    pdf_file_url: Optional[str] = None
    price: float
    suggested_resale_price: Optional[float] = None
    resale_notes: Optional[str] = None
    ad_facebook_url: Optional[str] = None
    ad_tiktok_url: Optional[str] = None
    ad_instagram_url: Optional[str] = None
    ad_pinterest_url: Optional[str] = None
    whop_checkout_url: Optional[str] = None
    whop_product_id: Optional[str] = None
    is_active: bool = True


@router.post("/admin/prodora-bundles/upload-file")
async def admin_upload_bundle_file(file: UploadFile, _: User = Depends(require_superuser)):
    """Generic upload for either the editable source file or the finished
    PDF — same R2 bucket every other admin/Prodora upload already uses."""
    contents = await file.read()
    if len(contents) > 100 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File must be under 100 MB")
    ext = (file.filename or "file").rsplit(".", 1)[-1].lower()
    from app.core.storage import upload_digital_file
    url = upload_digital_file(contents, 0, "prodora-bundles", ext, content_type=file.content_type or "application/octet-stream")
    return {"url": url}


@router.get("/admin/prodora-bundles")
def admin_list_bundles(db: Session = Depends(get_db), _: User = Depends(require_superuser)):
    bundles = db.query(ProdoraDigitalBundle).order_by(ProdoraDigitalBundle.created_at.desc()).all()
    return {"bundles": [_bundle_out(b, purchased=False) | {
        "editable_file_url": b.editable_file_url, "pdf_file_url": b.pdf_file_url,
        "whop_product_id": b.whop_product_id, "is_active": b.is_active,
        "purchase_count": len(b.purchases),
    } for b in bundles]}


@router.post("/admin/prodora-bundles", status_code=201)
def admin_create_bundle(body: BundleIn, db: Session = Depends(get_db), _: User = Depends(require_superuser)):
    bundle = ProdoraDigitalBundle(**body.model_dump())
    db.add(bundle)
    db.commit()
    db.refresh(bundle)
    return {"id": bundle.id}


@router.put("/admin/prodora-bundles/{bundle_id}")
def admin_update_bundle(bundle_id: int, body: BundleIn, db: Session = Depends(get_db), _: User = Depends(require_superuser)):
    bundle = db.query(ProdoraDigitalBundle).filter(ProdoraDigitalBundle.id == bundle_id).first()
    if not bundle:
        raise HTTPException(status_code=404, detail="Bundle not found")
    for k, v in body.model_dump().items():
        setattr(bundle, k, v)
    db.commit()
    return {"ok": True}


@router.delete("/admin/prodora-bundles/{bundle_id}")
def admin_delete_bundle(bundle_id: int, db: Session = Depends(get_db), _: User = Depends(require_superuser)):
    bundle = db.query(ProdoraDigitalBundle).filter(ProdoraDigitalBundle.id == bundle_id).first()
    if bundle:
        db.delete(bundle)
        db.commit()
    return {"ok": True}


class GrantPurchaseIn(BaseModel):
    shop_id: int


@router.post("/admin/prodora-bundles/{bundle_id}/grant")
def admin_grant_purchase(bundle_id: int, body: GrantPurchaseIn, db: Session = Depends(get_db), _: User = Depends(require_superuser)):
    """Manual fallback — use this if a real Whop payment comes in but the
    webhook couldn't auto-match it (see the module docstring on why that's
    a real possibility until the payload shape is confirmed live)."""
    bundle = db.query(ProdoraDigitalBundle).filter(ProdoraDigitalBundle.id == bundle_id).first()
    if not bundle:
        raise HTTPException(status_code=404, detail="Bundle not found")
    existing = db.query(ProdoraDigitalPurchase).filter(
        ProdoraDigitalPurchase.bundle_id == bundle_id, ProdoraDigitalPurchase.shop_id == body.shop_id,
    ).first()
    if not existing:
        db.add(ProdoraDigitalPurchase(bundle_id=bundle_id, shop_id=body.shop_id))
        db.commit()
    return {"ok": True}


# ── Seller-facing (Prodora) ───────────────────────────────────────────────────

@router.get("/prodora/digital-bundles")
def list_digital_bundles(db: Session = Depends(get_db), current_user: User = Depends(get_prodora_user)):
    shop = _seller_shop(current_user, db)
    purchased_ids = {
        pid for (pid,) in db.query(ProdoraDigitalPurchase.bundle_id).filter(ProdoraDigitalPurchase.shop_id == shop.id).all()
    }
    bundles = db.query(ProdoraDigitalBundle).filter(ProdoraDigitalBundle.is_active == True).order_by(ProdoraDigitalBundle.created_at.desc()).all()
    return {"bundles": [_bundle_out(b, purchased=b.id in purchased_ids) for b in bundles]}


@router.get("/prodora/digital-bundles/{bundle_id}/download")
def download_digital_bundle(bundle_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_prodora_user)):
    shop = _seller_shop(current_user, db)
    purchase = db.query(ProdoraDigitalPurchase).filter(
        ProdoraDigitalPurchase.bundle_id == bundle_id, ProdoraDigitalPurchase.shop_id == shop.id,
    ).first()
    if not purchase:
        raise HTTPException(status_code=403, detail="Purchase this bundle first.")
    bundle = db.query(ProdoraDigitalBundle).filter(ProdoraDigitalBundle.id == bundle_id).first()
    if not bundle:
        raise HTTPException(status_code=404, detail="Bundle not found")
    return {"editable_file_url": bundle.editable_file_url, "pdf_file_url": bundle.pdf_file_url}


@router.post("/prodora/digital-bundles/{bundle_id}/import")
def import_digital_bundle(bundle_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_prodora_user)):
    """Creates a real digital product in the seller's own store from a
    purchased bundle's PDF — same product_type='digital' path as any
    digital product a seller creates themselves, so it automatically gets
    unlimited stock (quantity=999999, see products.py) and works with
    their store's existing DigitalDelivery flow when THEIR customers buy it."""
    from app.models.product import Product
    from app.api.v1.endpoints.products import generate_slug, PLAN_PRODUCT_LIMITS
    from app.api.v1.endpoints.dropshipping import _get_plan

    shop = _seller_shop(current_user, db)
    purchase = db.query(ProdoraDigitalPurchase).filter(
        ProdoraDigitalPurchase.bundle_id == bundle_id, ProdoraDigitalPurchase.shop_id == shop.id,
    ).first()
    if not purchase:
        raise HTTPException(status_code=403, detail="Purchase this bundle first.")
    bundle = db.query(ProdoraDigitalBundle).filter(ProdoraDigitalBundle.id == bundle_id).first()
    if not bundle or not bundle.pdf_file_url:
        raise HTTPException(status_code=400, detail="This bundle has no downloadable file.")

    plan = _get_plan(shop.id, db)
    limit = PLAN_PRODUCT_LIMITS.get(plan, 25)
    if limit != -1:
        count = db.query(Product).filter(Product.shop_id == shop.id).count()
        if count >= limit:
            raise HTTPException(status_code=403, detail=f"Product limit reached ({limit} on your plan). Upgrade to add more.")

    price = float(bundle.suggested_resale_price) if bundle.suggested_resale_price else float(bundle.price) * 3
    product = Product(
        shop_id=shop.id,
        name=bundle.name,
        description=bundle.description or bundle.name,
        price=price,
        cost_price=float(bundle.price),
        product_type="digital",
        digital_file_url=bundle.pdf_file_url,
        quantity=999999,
        slug=generate_slug(bundle.name),
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return {"product_id": product.id, "name": product.name}


# ── Platform-level Whop webhook ───────────────────────────────────────────────

@router.post("/prodora/webhook/whop")
async def prodora_whop_webhook(request: Request, db: Session = Depends(get_db)):
    body = await request.body()

    if PRODORA_WHOP_WEBHOOK_SECRET:
        ok = _verify_whop_webhook_signature(
            PRODORA_WHOP_WEBHOOK_SECRET,
            request.headers.get("webhook-id", ""),
            request.headers.get("webhook-timestamp", ""),
            request.headers.get("webhook-signature", ""),
            body,
        )
        if not ok:
            raise HTTPException(status_code=401, detail="Invalid webhook signature")
    else:
        logger.warning("[Prodora Whop Webhook] PRODORA_WHOP_WEBHOOK_SECRET not set — accepting unverified. Set this before relying on this in production.")

    try:
        payload = json.loads(body)
    except Exception as e:
        logger.error(f"[Prodora Whop Webhook] payload parse failed: {e}")
        raise HTTPException(status_code=422, detail="Invalid webhook payload")

    event = payload.get("action") or payload.get("type") or payload.get("event")
    if event != "payment.succeeded":
        return {"received": True, "ignored_event": event}

    data = payload.get("data") or {}
    whop_payment_id = str(data.get("id") or "")
    if not whop_payment_id:
        return {"received": True, "error": "missing payment id"}

    # Idempotency — Whop can retry a webhook delivery.
    if db.query(ProdoraDigitalPurchase).filter(ProdoraDigitalPurchase.whop_payment_id == whop_payment_id).first():
        return {"received": True, "already_processed": True}

    # Best-effort field extraction — see module docstring on why these are
    # tried defensively rather than assumed from one confirmed shape.
    buyer_email = (
        data.get("email") or data.get("user_email")
        or (data.get("user") or {}).get("email")
        or (data.get("customer") or {}).get("email")
    )
    whop_product_id = str(
        data.get("product_id") or data.get("plan_id")
        or (data.get("product") or {}).get("id") or (data.get("plan") or {}).get("id") or ""
    )

    if not buyer_email:
        logger.error(f"[Prodora Whop Webhook] payment={whop_payment_id} — could not find a buyer email in the payload. Grant access manually via admin_grant_purchase. Raw data keys: {list(data.keys())}")
        return {"received": True, "error": "buyer email not found — needs manual grant"}

    user = db.query(User).filter(User.email.ilike(buyer_email.strip())).first()
    if not user:
        logger.error(f"[Prodora Whop Webhook] payment={whop_payment_id} — no ExiusCart account for email {buyer_email}. The buyer must check out with their ExiusCart account email.")
        return {"received": True, "error": "no matching ExiusCart account — needs manual grant"}

    shop = db.query(Shop).filter(Shop.owner_id == user.id).first()
    if not shop:
        return {"received": True, "error": "user has no shop — needs manual grant"}

    bundle = None
    if whop_product_id:
        bundle = db.query(ProdoraDigitalBundle).filter(ProdoraDigitalBundle.whop_product_id == whop_product_id).first()
    if not bundle:
        logger.error(f"[Prodora Whop Webhook] payment={whop_payment_id} shop={shop.id} — could not match a bundle by whop_product_id={whop_product_id!r}. Grant access manually.")
        return {"received": True, "error": "bundle not matched — needs manual grant", "shop_id": shop.id}

    db.add(ProdoraDigitalPurchase(bundle_id=bundle.id, shop_id=shop.id, whop_payment_id=whop_payment_id))
    db.commit()
    logger.info(f"[Prodora Whop Webhook] granted bundle={bundle.id} to shop={shop.id} via payment={whop_payment_id}")
    return {"received": True, "granted": True}
