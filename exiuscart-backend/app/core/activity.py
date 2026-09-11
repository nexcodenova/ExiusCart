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
