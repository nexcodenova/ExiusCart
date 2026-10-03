"""Fills in a new Prodora catalog product's Amazon link in the background.

Runs once, when the admin adds the product without an Amazon link: one Apify Amazon
search for the product's short keyword, and the top real listing's link is saved as
amazon_url (about $0.015). A link the admin pastes always wins and is never replaced.
Never raises.
"""
import logging
import threading

logger = logging.getLogger(__name__)


def find_amazon_link(db, product_id: int) -> str | None:
    from app.intel import apify
    from app.models.product import Product
    from app.core.meta_ad_library import ad_library_keyword
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product or product.amazon_url or not apify.configured():
        return None
    keyword = ad_library_keyword(product.name)
    if not keyword:
        return None
    for r in apify.amazon_search(keyword, limit=5):
        url = r.get("url") or (f"https://www.amazon.com/dp/{r['asin']}" if r.get("asin") else None)
        if url and "amazon." in url:
            db.refresh(product)
            if product.amazon_url:           # the admin pasted one meanwhile
                return None
            product.amazon_url = url[:1000]
            db.commit()
            return url
    return None


def queue_amazon_link(product_id: int) -> None:
    def work():
        from app.core.database import SessionLocal
        db = SessionLocal()
        try:
            url = find_amazon_link(db, product_id)
            if url:
                logger.info(f"[catalog] product={product_id} amazon link found")
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[catalog] product={product_id} amazon link skipped: {type(e).__name__}: {str(e)[:120]}")
        finally:
            db.close()
    threading.Thread(target=work, name=f"amazon-link-{product_id}", daemon=True).start()
