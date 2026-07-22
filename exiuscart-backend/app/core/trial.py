"""
Free-trial expiry enforcement.

Viewing/browsing the dashboard is never blocked, even on an expired trial —
only the specific actions that represent "growing the business for free"
are: adding a new product, and completing a sale (online or POS). Apply
require_active_trial() at the start of those endpoints only.
"""
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session


def require_active_trial(shop_id: int, db: Session) -> None:
    from app.models.subscription import Subscription

    sub = (
        db.query(Subscription)
        .filter(Subscription.shop_id == shop_id)
        .order_by(Subscription.id.desc())
        .first()
    )
    if not sub:
        return

    expired = sub.status == "expired"
    if not expired and sub.status == "trial" and sub.expires_at:
        expires = sub.expires_at if sub.expires_at.tzinfo else sub.expires_at.replace(tzinfo=timezone.utc)
        expired = (expires - datetime.now(timezone.utc)).days < 0

    if expired:
        raise HTTPException(status_code=402, detail={
            "error": "trial_expired",
            "message": "Your free trial has ended. Upgrade to Starter or Premium to continue.",
        })
