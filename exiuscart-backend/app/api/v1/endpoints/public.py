from fastapi import APIRouter, Depends, HTTPException
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
