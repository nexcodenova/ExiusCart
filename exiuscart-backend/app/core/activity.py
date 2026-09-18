"""Real, append-only activity feed for the Orders page — see
app/models/activity_log.py for exactly what's covered and what isn't."""
import logging

from sqlalchemy.orm import Session

from app.models.activity_log import ActivityLog

logger = logging.getLogger(__name__)


def log_activity(db: Session, shop_id: int, event_type: str, title: str, description: str = None, order_id: int = None) -> None:
    """Fire-and-forget. Call this only after the real operation it
    describes has already been committed — a failure here must never take
    down the order/payment flow it's just recording, and it must never be
    the transaction that also carries other uncommitted changes."""
    try:
        db.add(ActivityLog(shop_id=shop_id, event_type=event_type, title=title, description=description, order_id=order_id))
        db.commit()
    except Exception:
        db.rollback()
        logger.warning(f"[ActivityLog] failed to log {event_type} for shop={shop_id}", exc_info=True)


def log_low_stock_for_products(db: Session, shop_id: int, product_ids: list[int]) -> None:
    """Call right after an order commits and stock is decremented — checks
    only the products actually just sold (not a shop-wide sweep) for
    whether that sale pushed them at/below their own low_stock_threshold,
    and logs one activity entry per product that just crossed it.

    Deliberately narrow coverage: this fires from order-creation call sites
    only (orders.py, checkout.py, channels.py's webhook) — a manual stock
    edit or a channel's own inventory sync doesn't run through here, so
    stock crossing the threshold from those paths isn't caught yet."""
    if not product_ids:
        return
    from app.models.product import Product
    try:
        low = db.query(Product).filter(
            Product.id.in_(product_ids),
            Product.is_active == True,
            Product.quantity <= Product.low_stock_threshold,
        ).all()
        for p in low:
            db.add(ActivityLog(
                shop_id=shop_id, event_type="stock_low", title="Low stock alert",
                description=f"{p.name} ({p.quantity} left)",
            ))
        if low:
            db.commit()
    except Exception:
        db.rollback()
        logger.warning(f"[ActivityLog] failed low-stock check for shop={shop_id}", exc_info=True)
