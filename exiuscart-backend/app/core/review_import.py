"""Bring in a product's real AliExpress reviews when the seller imports it from AliExpress.

Honest by design:
  * every review is a real public AliExpress review (Apify "AliExpress Reviews Scraper"),
    never written or reworded by us;
  * it is saved as channel_source="aliexpress" and status "pending", so it only goes live
    after the seller approves it on the Reviews page;
  * the storefront widget labels it "Review from AliExpress".
Skipped when Apify is not set up, for TheDersi-managed shops (no Reviews there), and when the
product already has imported reviews. Runs in a background thread and never raises.
"""
import logging
import secrets
import threading
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

MAX_REVIEWS = 20


def _parse_date(v):
    if not v:
        return None
    try:
        return datetime.fromisoformat(str(v).replace("Z", "+00:00"))
    except ValueError:
        return None


def _ae_id_for(db, product):
    """AliExpress product id of a product: its supplier link, else its source link, else an AE- SKU."""
    import re
    from app.models.dropship import DropshipProductLink
    link = db.query(DropshipProductLink).filter(DropshipProductLink.product_id == product.id,
                                                DropshipProductLink.supplier_type == "aliexpress").first()
    if link and link.supplier_product_id:
        return str(link.supplier_product_id)
    m = re.search(r"/item/(\d+)\.html", product.source_url or "")
    if m:
        return m.group(1)
    m = re.match(r"AE-(\d+)", product.sku or "")
    return m.group(1) if m else None


def cached_reviews(db, ae_product_id: str):
    """Reviews already fetched for this AliExpress id on any product (catalog or a store), or None."""
    from app.models.product import Product
    rows = db.query(Product).filter(Product.imported_reviews_json.isnot(None),
                                    (Product.source_url.like(f"%/item/{ae_product_id}.html%")) | (Product.sku.like(f"AE-{ae_product_id}%"))).limit(5).all()
    for r in rows:
        if r.imported_reviews_json:
            return r.imported_reviews_json
    return None


def get_reviews(db, ae_product_id: str):
    """Saved reviews if we have them, else one Apify run."""
    from app.intel import apify
    hit = cached_reviews(db, ae_product_id)
    if hit is not None:
        return hit
    if not apify.configured():
        return None
    return apify.aliexpress_reviews(ae_product_id, limit=MAX_REVIEWS)


def save_as_pending(db, shop_id: int, product_id: int, rows) -> int:
    from app.core.thedersi import is_thedersi_restricted_shop
    from app.models.review import ProductReview
    if not rows or is_thedersi_restricted_shop(shop_id, db):
        return 0
    if db.query(ProductReview.id).filter(ProductReview.product_id == product_id,
                                         ProductReview.channel_source == "aliexpress").first():
        return 0
    now = datetime.now(timezone.utc)
    for r in rows:
        who = r.get("name") or "AliExpress buyer"
        if r.get("country"):
            who = f"{who} ({r['country']})"
        db.add(ProductReview(
            shop_id=shop_id, product_id=product_id, order_id=None,
            customer_name=who[:255], rating=r["rating"], comment=r.get("text") or None,
            photo_url=r.get("photo"), status="pending", token=secrets.token_urlsafe(24),
            channel_source="aliexpress", submitted_at=_parse_date(r.get("date")) or now,
        ))
    db.commit()
    return len(rows)


def import_aliexpress_reviews(db, shop_id: int, product_id: int, ae_product_id: str) -> int:
    """Saves up to MAX_REVIEWS pending reviews; returns how many were added."""
    from app.core.thedersi import is_thedersi_restricted_shop
    from app.models.product import Product
    if is_thedersi_restricted_shop(shop_id, db):
        return 0
    rows = get_reviews(db, ae_product_id)
    if rows is None:
        return 0
    product = db.query(Product).filter(Product.id == product_id).first()
    if product is not None and product.imported_reviews_json is None:
        product.imported_reviews_json = rows   # kept, so the next import of this item reuses it
        db.commit()
    return save_as_pending(db, shop_id, product_id, rows)


def queue_aliexpress_reviews(shop_id: int, product_id: int, ae_product_id: str) -> None:
    def work():
        from app.core.database import SessionLocal
        db = SessionLocal()
        try:
            n = import_aliexpress_reviews(db, shop_id, product_id, ae_product_id)
            logger.info(f"[AliExpress reviews] shop={shop_id} product={product_id} imported={n}")
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[AliExpress reviews] shop={shop_id} product={product_id} skipped: {type(e).__name__}: {str(e)[:120]}")
        finally:
            db.close()
    threading.Thread(target=work, name=f"ae-reviews-{product_id}", daemon=True).start()


def fetch_for_catalog(db, product_id: int) -> int:
    """Prodora catalog product: fetch its AliExpress reviews once and keep them on the product."""
    from app.models.product import Product
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product or product.imported_reviews_json is not None:
        return 0
    ae = _ae_id_for(db, product)
    if not ae:
        return 0
    rows = get_reviews(db, ae)
    if rows is None:
        return 0
    product.imported_reviews_json = rows
    db.commit()
    return len(rows)


def queue_catalog_reviews(product_id: int) -> None:
    def work():
        from app.core.database import SessionLocal
        db = SessionLocal()
        try:
            n = fetch_for_catalog(db, product_id)
            if n:
                logger.info(f"[AliExpress reviews] catalog product={product_id} saved={n}")
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[AliExpress reviews] catalog product={product_id} skipped: {type(e).__name__}: {str(e)[:120]}")
        finally:
            db.close()
    threading.Thread(target=work, name=f"ae-reviews-cat-{product_id}", daemon=True).start()


def copy_to_seller(db, source, shop_id: int, new_product_id: int) -> int:
    """Prodora import: the catalog product's saved reviews come with it, as Pending. No scraping."""
    return save_as_pending(db, shop_id, new_product_id, source.imported_reviews_json or [])
