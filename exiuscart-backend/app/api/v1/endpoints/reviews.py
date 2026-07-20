"""
Product review capture — request reviews after delivery, customer submits via public link,
seller moderates, approved reviews are shown on the storefront.
"""

import logging
import secrets
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.storage import upload_image as storage_upload
from app.models.user import User
from app.models.order import Order, OrderItem
from app.models.product import Product
from app.models.review import ProductReview
from app.api.v1.deps import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

STORE_BASE_URL = "https://store.exiuscart.com"


def _shop_or_404(shop_id: int, user: User, db: Session):
    from app.models.shop import Shop
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


# Marketplaces that already run their own native review system on their own platform —
# sending an ExiusCart review request for these would duplicate/conflict with that.
MARKETPLACE_OWNED_REVIEWS = {"thedersi", "daraz", "ebay", "amazon", "tiktok"}


def request_reviews_for_order(order: Order, db: Session) -> None:
    """Called when an order is marked delivered — creates review rows + sends one email."""
    if order.source in MARKETPLACE_OWNED_REVIEWS:
        return
    if not order.customer or not order.customer.email:
        return

    items = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()
    seen_products = set()
    email_products = []

    from app.models.product_fields import ProductImage
    from app.models.shop import Shop
    shop = db.query(Shop).filter(Shop.id == order.shop_id).first()

    for item in items:
        if not item.product_id or item.product_id in seen_products:
            continue
        seen_products.add(item.product_id)

        # Skip if a review was already requested for this product+order
        existing = db.query(ProductReview).filter(
            ProductReview.order_id == order.id,
            ProductReview.product_id == item.product_id,
        ).first()
        if existing:
            continue

        token = secrets.token_urlsafe(24)
        review = ProductReview(
            shop_id=order.shop_id,
            product_id=item.product_id,
            order_id=order.id,
            customer_name=order.customer.name,
            customer_email=order.customer.email,
            status="requested",
            token=token,
        )
        db.add(review)

        img = db.query(ProductImage).filter(ProductImage.product_id == item.product_id).order_by(ProductImage.sort_order).first()
        email_products.append({
            "name": item.product_name or "Product",
            "image_url": img.url if img else None,
            "review_url": f"{STORE_BASE_URL}/review/{token}",
        })

    db.commit()

    if not email_products:
        return

    try:
        from app.core.email import send_review_request_email
        send_review_request_email(
            to_email=order.customer.email,
            customer_name=order.customer.name,
            shop_name=shop.name if shop else "the shop",
            order_number=order.order_number,
            products=email_products,
            shop_id=shop.id if shop else None,
        )
    except Exception as e:
        logger.error(f"[ReviewRequest] Failed to send email for order={order.id}: {e}")


# ── Schemas ───────────────────────────────────────────────────────────────────

class ModerateIn(BaseModel):
    status: str  # approved | rejected

class SubmitReviewIn(BaseModel):
    rating: int
    comment: Optional[str] = None
    photo_url: Optional[str] = None


# ── Seller endpoints ──────────────────────────────────────────────────────────

@router.get("/shops/{shop_id}/reviews")
def list_reviews(
    shop_id: int,
    status: Optional[str] = None,
    product_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    q = db.query(ProductReview).filter(ProductReview.shop_id == shop_id)
    if status:
        q = q.filter(ProductReview.status == status)
    if product_id:
        q = q.filter(ProductReview.product_id == product_id)
    reviews = q.order_by(ProductReview.created_at.desc()).limit(500).all()

    product_ids = {r.product_id for r in reviews}
    products = {p.id: p.name for p in db.query(Product).filter(Product.id.in_(product_ids)).all()} if product_ids else {}

    submitted = [r for r in reviews if r.status != "requested"]
    avg_rating = round(sum(r.rating or 0 for r in submitted) / len(submitted), 1) if submitted else 0

    return {
        "reviews": [
            {
                "id": r.id,
                "product_id": r.product_id,
                "product_name": products.get(r.product_id, "Product"),
                "customer_name": r.customer_name,
                "rating": r.rating,
                "comment": r.comment,
                "photo_url": r.photo_url,
                "status": r.status,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "submitted_at": r.submitted_at.isoformat() if r.submitted_at else None,
            }
            for r in reviews
        ],
        "stats": {
            "total": len(reviews),
            "pending": len([r for r in reviews if r.status == "pending"]),
            "approved": len([r for r in reviews if r.status == "approved"]),
            "avg_rating": avg_rating,
        },
    }


@router.post("/shops/{shop_id}/reviews/{review_id}/moderate")
def moderate_review(
    shop_id: int,
    review_id: int,
    data: ModerateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    if data.status not in ("approved", "rejected"):
        raise HTTPException(status_code=422, detail="status must be 'approved' or 'rejected'")

    review = db.query(ProductReview).filter(ProductReview.id == review_id, ProductReview.shop_id == shop_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    review.status = data.status
    db.commit()
    return {"id": review.id, "status": review.status}


@router.delete("/shops/{shop_id}/reviews/{review_id}")
def delete_review(
    shop_id: int,
    review_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    review = db.query(ProductReview).filter(ProductReview.id == review_id, ProductReview.shop_id == shop_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    db.delete(review)
    db.commit()
    return {"deleted": True}


@router.post("/shops/{shop_id}/orders/{order_id}/request-review")
def manual_request_review(
    shop_id: int,
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    order = db.query(Order).filter(Order.id == order_id, Order.shop_id == shop_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.source in MARKETPLACE_OWNED_REVIEWS:
        raise HTTPException(status_code=400, detail={
            "error": "marketplace_owned_reviews",
            "message": f"{order.source.title()} orders are reviewed on {order.source.title()}'s own platform — ExiusCart doesn't send a separate review request for these.",
        })
    if not order.customer or not order.customer.email:
        raise HTTPException(status_code=400, detail="This order has no customer email on file.")

    request_reviews_for_order(order, db)
    return {"requested": True}


# ── Public endpoints (no auth) ────────────────────────────────────────────────

@router.get("/public/review/{token}")
def get_review_request(token: str, db: Session = Depends(get_db)):
    review = db.query(ProductReview).filter(ProductReview.token == token).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review link not found or expired.")

    from app.models.product_fields import ProductImage
    from app.models.shop import Shop
    product = db.query(Product).filter(Product.id == review.product_id).first()
    shop = db.query(Shop).filter(Shop.id == review.shop_id).first()
    img = db.query(ProductImage).filter(ProductImage.product_id == review.product_id).order_by(ProductImage.sort_order).first()

    return {
        "product_name": product.name if product else "Product",
        "product_image": img.url if img else None,
        "shop_name": shop.name if shop else "",
        "customer_name": review.customer_name,
        "already_submitted": review.status != "requested",
        "rating": review.rating,
        "comment": review.comment,
    }


@router.post("/public/review/{token}/submit")
def submit_review(token: str, data: SubmitReviewIn, db: Session = Depends(get_db)):
    review = db.query(ProductReview).filter(ProductReview.token == token).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review link not found or expired.")
    if review.status != "requested":
        raise HTTPException(status_code=400, detail="This review has already been submitted.")
    if data.rating < 1 or data.rating > 5:
        raise HTTPException(status_code=422, detail="Rating must be between 1 and 5.")

    review.rating = data.rating
    review.comment = data.comment
    review.photo_url = data.photo_url
    review.status = "pending"
    review.submitted_at = datetime.now(timezone.utc)
    db.commit()
    return {"submitted": True}


@router.post("/public/review/{token}/photo")
async def upload_review_photo(token: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    review = db.query(ProductReview).filter(ProductReview.token == token).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review link not found or expired.")

    ext = (file.filename or "photo.jpg").rsplit(".", 1)[-1].lower()
    if ext not in ("jpg", "jpeg", "png", "webp"):
        ext = "jpg"
    contents = await file.read()
    if len(contents) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Photo must be under 8MB.")

    try:
        url = storage_upload(contents, review.shop_id, review.product_id, ext, content_type=file.content_type or "image/jpeg")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Photo upload failed: {exc}")

    return {"url": url}


@router.get("/public/products/{product_id}/reviews")
def get_product_reviews(product_id: int, db: Session = Depends(get_db)):
    """Approved reviews for a product — used by the storefront reviews widget."""
    reviews = db.query(ProductReview).filter(
        ProductReview.product_id == product_id,
        ProductReview.status == "approved",
    ).order_by(ProductReview.submitted_at.desc()).limit(100).all()

    avg = round(sum(r.rating or 0 for r in reviews) / len(reviews), 1) if reviews else 0

    return {
        "avg_rating": avg,
        "count": len(reviews),
        "reviews": [
            {
                "customer_name": r.customer_name,
                "rating": r.rating,
                "comment": r.comment,
                "photo_url": r.photo_url,
                "submitted_at": r.submitted_at.isoformat() if r.submitted_at else None,
            }
            for r in reviews
        ],
    }


# ── Embed widget — displays approved reviews on the storefront product page ──

@router.get("/widget/reviews.js")
def reviews_widget_script():
    js = """
(function(){
  var API = 'https://api.exiuscart.com/api/v1';

  function star(filled) {
    return '<span style="color:' + (filled ? '#f59e0b' : '#d1d5db') + ';font-size:16px;">\\u2605</span>';
  }

  function stars(rating) {
    var html = '';
    for (var i = 1; i <= 5; i++) html += star(i <= Math.round(rating));
    return html;
  }

  function render(container, data) {
    var html = '<div style="font-family:Arial,sans-serif;max-width:100%;">';

    if (data.count === 0) {
      html += '<p style="color:#888;font-size:14px;">No reviews yet.</p>';
    } else {
      html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">';
      html += '<span style="font-size:28px;font-weight:800;color:#111;">' + data.avg_rating + '</span>';
      html += '<div>' + stars(data.avg_rating) + '<div style="font-size:12px;color:#888;margin-top:2px;">' + data.count + ' review' + (data.count !== 1 ? 's' : '') + '</div></div>';
      html += '</div>';

      data.reviews.forEach(function(r){
        html += '<div style="border-top:1px solid #eee;padding:14px 0;">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
        html += '<span style="font-weight:700;font-size:13px;color:#111;">' + (r.customer_name || 'Anonymous') + '</span>';
        html += '<span>' + stars(r.rating) + '</span>';
        html += '</div>';
        if (r.comment) html += '<p style="margin:0 0 8px;font-size:14px;color:#444;line-height:1.5;">' + r.comment + '</p>';
        if (r.photo_url) html += '<img src="' + r.photo_url + '" style="width:64px;height:64px;object-fit:cover;border-radius:8px;" />';
        html += '</div>';
      });
    }

    html += '</div>';
    container.innerHTML = html;
  }

  function init(container) {
    var productId = container.getAttribute('data-product-id');
    if (!productId) return;
    fetch(API + '/public/products/' + productId + '/reviews')
      .then(function(r){ return r.json(); })
      .then(function(data){ render(container, data); })
      .catch(function(){});
  }

  document.querySelectorAll('[data-exiuscart-reviews]').forEach(init);
})();
"""
    return Response(content=js, media_type="application/javascript")
