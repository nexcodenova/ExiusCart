"""
Endpoints meant to be called by an external scheduler (a system cron job on
the production droplet, e.g. `curl -X POST .../cron/advance-trial-stages`),
not by the frontend or a logged-in user — protected by a shared secret
instead of a user session.
"""
import os
import logging

from fastapi import APIRouter, Header, HTTPException, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.subscription_lifecycle import advance_trial_stages

logger = logging.getLogger(__name__)
router = APIRouter()

CRON_SECRET_KEY = os.getenv("CRON_SECRET_KEY", "")


def _verify_cron_secret(x_cron_key: str = Header(default="")) -> None:
    if not CRON_SECRET_KEY:
        # Fails closed — an unset secret must never mean "open to anyone".
        raise HTTPException(status_code=503, detail="CRON_SECRET_KEY is not configured on the server.")
    if x_cron_key != CRON_SECRET_KEY:
        raise HTTPException(status_code=401, detail="Invalid cron key.")


@router.post("/cron/advance-trial-stages")
async def cron_advance_trial_stages(
    db: Session = Depends(get_db),
    _: None = Depends(_verify_cron_secret),
):
    """
    Run daily. Moves every Scale subscription past its $1 week into the $2
    stage, and every subscription past its final paid trial stage into full
    price — see app/core/subscription_lifecycle.py for the real logic.
    Crontab example (once a day, off-peak):
      0 3 * * * curl -sS -X POST https://api.exiuscart.com/api/v1/cron/advance-trial-stages \\
        -H "X-Cron-Key: $CRON_SECRET_KEY"
    """
    return await advance_trial_stages(db)
