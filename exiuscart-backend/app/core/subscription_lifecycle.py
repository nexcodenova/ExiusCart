"""
Advances every Growth/Scale subscription from its $1 trial week to full
price once that week ends.

Lemon Squeezy has no concept of a staged trial — it only knows "this
subscription bills variant X on its normal interval." The $1 week is
entirely ExiusCart's own clock (trial_dollar_ends_at on the Subscription
row); Lemon Squeezy will happily keep charging $1 forever unless something
actively moves the subscription onto the full-price variant when the week
ends. This module is that something.

Meant to run on a schedule — see app/api/v1/endpoints/cron.py for the HTTP
endpoint an external cron job calls daily.
"""
import logging
from datetime import datetime, timezone, timedelta

from sqlalchemy.orm import Session

from app.models.subscription import Subscription
from app.core.lemonsqueezy import get_variant_id, update_subscription_variant

logger = logging.getLogger(__name__)


async def advance_trial_stages(db: Session) -> dict:
    """
    Finds every Lemon Squeezy-billed subscription still on status
    "trial_dollar" whose trial_dollar_ends_at has passed, switches it to
    the plan's real full-price variant, and marks it active. Each
    subscription is committed individually so one failure (e.g. a variant
    env var not set yet) never blocks the rest. Returns a summary for
    logging/inspection by the caller.
    """
    now = datetime.now(timezone.utc)
    advanced_to_active: list[int] = []
    errors: list[dict] = []

    due = db.query(Subscription).filter(
        Subscription.status == "trial_dollar",
        Subscription.trial_dollar_ends_at.isnot(None),
        Subscription.trial_dollar_ends_at <= now,
        Subscription.payment_source == "lemon_squeezy",
        Subscription.lemon_squeezy_subscription_id.isnot(None),
    ).all()

    for sub in due:
        try:
            variant_id = get_variant_id(sub.plan_type, sub.billing_type or "monthly")
            if not variant_id:
                raise RuntimeError(
                    f"no full-price Lemon Squeezy variant configured for {sub.plan_type}/{sub.billing_type}"
                )
            await update_subscription_variant(sub.lemon_squeezy_subscription_id, variant_id)
            sub.status = "active"
            sub.expires_at = now + timedelta(days=365 if sub.billing_type == "yearly" else 30)
            advanced_to_active.append(sub.id)
            db.commit()
        except Exception as e:
            db.rollback()
            logger.error(f"[trial-lifecycle] sub={sub.id} failed leaving trial_dollar: {e!r}")
            errors.append({"subscription_id": sub.id, "error": str(e)})

    if advanced_to_active or errors:
        logger.info(f"[trial-lifecycle] advanced_to_active={advanced_to_active} errors={len(errors)}")

    return {"advanced_to_active": advanced_to_active, "errors": errors}
