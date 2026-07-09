import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.shop import Shop
from app.models.product import Product
from app.models.product_fields import ProductImage
from app.models.reservation import Reservation
from app.models.order import Order
from app.models.user import User
from app.models.email_otp import EmailOTP
from app.models.email_log import EmailLog
from app.models.affiliate import Affiliate

logger = logging.getLogger(__name__)

router = APIRouter()


def _first_image(db: Session, product_id: int) -> str | None:
    img = db.query(ProductImage).filter(
        ProductImage.product_id == product_id
    ).order_by(ProductImage.sort_order).first()
    return img.url if img else None


@router.get("/public/stats")
def public_stats(db: Session = Depends(get_db)):
    """No-auth endpoint — returns live platform stats for the marketing site."""
    orders_processed = db.query(Order).count()
    emails_generated = db.query(EmailLog).count()
    products_added = db.query(Product).count()
    return {
        "orders_processed": orders_processed,
        "emails_generated": emails_generated,
        "products_added": products_added,
    }


@router.get("/public/check-ref/{code}")
def check_ref(code: str, db: Session = Depends(get_db)):
    """No-auth endpoint — validates whether an affiliate referral code is active."""
    affiliate = db.query(Affiliate).filter(
        Affiliate.referral_code == code,
        Affiliate.status == "approved",
    ).first()
    return {"valid": affiliate is not None}


@router.get("/public/product/{barcode}")
def public_product_info(barcode: str, db: Session = Depends(get_db)):
    """No-auth endpoint — returns product info for QR code public pages."""
    product = db.query(Product).filter(Product.barcode == barcode).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    shop = db.query(Shop).filter(Shop.id == product.shop_id).first()

    # Active reservations for this product
    active_reservations = db.query(Reservation).filter(
        Reservation.product_id == product.id,
        Reservation.status == "active",
    ).order_by(Reservation.created_at.asc()).all()

    reserved_qty = sum(r.quantity for r in active_reservations)
    available = max(0, (product.quantity or 0) - reserved_qty)

    reservations_list = [
        {
            "id": r.id,
            "customer_name": r.customer_name,
            "quantity": r.quantity,
            "reservation_type": r.reservation_type,
            "advance_amount": float(r.advance_amount) if r.advance_amount else None,
            "lpo_number": r.lpo_number,
            "notes": r.notes,
            "expires_at": r.expires_at.isoformat() if r.expires_at else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in active_reservations
    ]

    return {
        "name": product.name,
        "sku": product.sku,
        "barcode": product.barcode,
        "price": float(product.price) if product.price else 0,
        "currency": shop.currency if shop else "AED",
        "stock": product.quantity or 0,
        "reserved": int(reserved_qty),
        "available": int(available),
        "shop_name": shop.name if shop else "",
        "image_url": product.image_url or _first_image(db, product.id),
        "category": product.category.name if product.category else None,
        "reservations": reservations_list,
    }


@router.get("/public/reservation/{reservation_id}")
def public_reservation_info(reservation_id: int, db: Session = Depends(get_db)):
    """No-auth endpoint — returns reservation info for QR code public pages."""
    r = db.query(Reservation).filter(Reservation.id == reservation_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Reservation not found")

    shop = db.query(Shop).filter(Shop.id == r.shop_id).first()

    product_stock = None
    product_reserved = None
    if r.product_id:
        product = db.query(Product).filter(Product.id == r.product_id).first()
        if product:
            total_reserved = db.query(func.sum(Reservation.quantity)).filter(
                Reservation.product_id == product.id,
                Reservation.status == "active",
            ).scalar() or 0
            product_stock = product.quantity or 0
            product_reserved = int(total_reserved)

    return {
        "id": r.id,
        "customer_name": r.customer_name,
        "customer_phone": r.customer_phone,
        "product_name": r.product_name,
        "quantity": r.quantity,
        "reservation_type": r.reservation_type,
        "status": r.status,
        "advance_amount": float(r.advance_amount) if r.advance_amount else None,
        "notes": r.notes,
        "lpo_number": r.lpo_number,
        "expires_at": r.expires_at.isoformat() if r.expires_at else None,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "shop_name": shop.name if shop else "",
        "currency": shop.currency if shop else "AED",
        "product_stock": product_stock,
        "product_reserved": product_reserved,
    }


# ── Social Media Lead Capture (no auth — token in URL) ────────────────────────

def _shop_by_token(token: str, db: Session) -> Shop:
    shop = db.query(Shop).filter(Shop.lead_capture_token == token).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Invalid capture token")
    return shop


def _plan_eligible(shop: Shop, db: Session) -> bool:
    from app.models.subscription import Subscription
    from app.api.v1.endpoints.marketing import SOCIAL_LEAD_PLANS
    sub = db.query(Subscription).filter(Subscription.shop_id == shop.id).order_by(Subscription.id.desc()).first()
    plan = sub.plan_type if sub else "free_trial"
    return plan in SOCIAL_LEAD_PLANS


def _save_lead(shop_id: int, name: str, email: str, phone: str, company: str, source: str, db: Session):
    from app.models.marketing import ShopLead
    from app.api.v1.endpoints.marketing import LEAD_LIMITS
    from app.models.subscription import Subscription
    from sqlalchemy import func as sql_func
    sub = db.query(Subscription).filter(Subscription.shop_id == shop_id).order_by(Subscription.id.desc()).first()
    plan = sub.plan_type if sub else "free_trial"
    limit = LEAD_LIMITS.get(plan)
    if limit is not None:
        count = db.query(sql_func.count(ShopLead.id)).filter(ShopLead.shop_id == shop_id).scalar() or 0
        if count >= limit:
            logger.info(f"[LEAD CAPTURE] shop={shop_id} at limit ({count}/{limit}) — lead skipped")
            return None
    lead = ShopLead(shop_id=shop_id, name=name or "Unknown", email=email or None,
                    phone=phone or None, company=company or None, source=source, status="new")
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead


# ── Google Ads ────────────────────────────────────────────────────────────────

@router.get("/public/lead-capture/{token}")
def google_ads_verify(token: str, google_key: str = None, db: Session = Depends(get_db)):
    """Google Ads pings this URL (GET) before activating the webhook. Must return 200."""
    _shop_by_token(token, db)
    return {"status": "ok"}


@router.post("/public/lead-capture/{token}")
async def google_ads_lead(token: str, request: Request, db: Session = Depends(get_db)):
    """
    Google Ads Lead Form webhook (POST).
    Google sends lead data here whenever someone submits an in-ad lead form.
    Payload: { "user_column_data": [{"column_name": "FULL_NAME", "string_value": "..."}] }
    """
    shop = _shop_by_token(token, db)
    if not _plan_eligible(shop, db):
        return {"status": "plan_not_eligible"}

    try:
        body = await request.json()
    except Exception:
        body = {}

    name = email = phone = company = ""

    # Parse Google's user_column_data format
    for col in body.get("user_column_data", []):
        cn = (col.get("column_name") or "").upper()
        val = col.get("string_value") or ""
        if cn == "FULL_NAME":
            name = val
        elif cn == "FIRST_NAME":
            name = val
        elif cn == "LAST_NAME":
            name = f"{name} {val}".strip()
        elif cn == "EMAIL":
            email = val
        elif cn == "PHONE_NUMBER":
            phone = val
        elif cn in ("COMPANY_NAME", "COMPANY"):
            company = val

    # Fallback: key_value_data format (older Google Ads API)
    if not name:
        for kv in body.get("key_value_data", []):
            k = (kv.get("key") or "").upper()
            v = kv.get("value") or ""
            if k in ("FULL_NAME", "FIRST_NAME"):
                name = v
            elif k == "EMAIL":
                email = v
            elif k == "PHONE_NUMBER":
                phone = v

    if not name:
        name = f"Google Lead #{body.get('lead_id', 'unknown')}"

    lead = _save_lead(shop.id, name, email, phone, company, "google_ads", db)
    logger.info(f"[LEAD CAPTURE] Google Ads → shop={shop.id} name={name} lead_id={lead.id if lead else 'skipped'}")
    return {"status": "ok"}


# ── Public Quotation (client view + accept/reject) ────────────────────────────

@router.get("/public/quotation/{token}")
def public_quotation_view(token: str, db: Session = Depends(get_db)):
    """No-auth endpoint — client views their quotation via share link."""
    from app.models.quotation import Quotation
    q = db.query(Quotation).filter(Quotation.client_token == token).first()
    if not q:
        raise HTTPException(status_code=404, detail="Quotation not found")
    shop = q.shop
    return {
        "quote_number": q.quote_number,
        "shop_name": shop.name if shop else "",
        "shop_logo": shop.logo_url if shop else None,
        "currency": shop.currency if shop else "AED",
        "customer_name": q.customer_name,
        "customer_email": q.customer_email,
        "customer_phone": q.customer_phone,
        "items": q.items,
        "subtotal": float(q.subtotal),
        "discount": float(q.discount),
        "tax": float(q.tax),
        "tax_rate": float(q.tax_rate or 0),
        "tax_type": q.tax_type or "fixed",
        "total": float(q.total),
        "notes": q.notes,
        "terms": q.terms,
        "payment_schedule": q.payment_schedule,
        "company_address": q.company_address,
        "company_trn": q.company_trn,
        "company_bank": q.company_bank,
        "status": q.status,
        "valid_until": q.valid_until.isoformat() if q.valid_until else None,
        "created_at": q.created_at.isoformat() if q.created_at else None,
        "client_accepted_name": q.client_accepted_name,
        "client_accepted_at": q.client_accepted_at.isoformat() if q.client_accepted_at else None,
    }


@router.post("/public/quotation/{token}/respond")
async def public_quotation_respond(token: str, request: Request, db: Session = Depends(get_db)):
    """No-auth endpoint — client accepts or rejects quotation via share link."""
    from app.models.quotation import Quotation
    from datetime import datetime, timezone
    q = db.query(Quotation).filter(Quotation.client_token == token).first()
    if not q:
        raise HTTPException(status_code=404, detail="Quotation not found")
    if q.status not in ("pending",):
        raise HTTPException(status_code=400, detail="This quotation has already been responded to")
    try:
        body = await request.json()
    except Exception:
        body = {}
    action = body.get("action")
    if action not in ("accept", "reject"):
        raise HTTPException(status_code=400, detail="action must be 'accept' or 'reject'")
    q.status = "accepted" if action == "accept" else "rejected"
    q.client_accepted_at = datetime.now(timezone.utc)
    q.client_accepted_name = body.get("name") or q.customer_name
    db.commit()
    return {"status": q.status}
