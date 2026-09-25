"""
SMS Marketing — broadcast a free-text message to every customer with a
phone number on file. Sent via ExiusCart's own centralized Twilio account
(app/core/sms.py) — a wholesale/reseller model, not BYOK like WhatsApp/
dropshipping/social posting. That choice is deliberate: SMS costs roughly
100-200x AWS SES's per-email cost even in the cheapest market, so making a
seller set up their own Twilio account for this one feature would be real
friction for something ExiusCart can otherwise fold into the plan itself —
the trade-off being that ExiusCart now carries the real Twilio bill,
rationed by SMS_LIMITS below the same way EMAIL_LIMITS rations marketing
email in usage.py.

Free Trial gets none (matches EMAIL_LIMITS' own "marketing": 0 for every
free/entry tier). Launch/Growth/Scale all get a real daily+monthly quota —
opening this to Launch costs nothing extra in principle (it's already
ExiusCart's own account either way), the caps exist purely to keep the
Twilio bill predictable per plan tier.
"""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.sms import send_sms
from app.core.thedersi import is_thedersi_pro_shop
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.shop import Shop
from app.models.subscription import Subscription
from app.models.customer import Customer
from app.models.marketing import SMSCampaign
from app.models.sms_marketing import SMSMessageLog
from app.core.shop_access import get_shop_for_member

logger = logging.getLogger(__name__)
router = APIRouter()

# Daily/monthly SMS send caps per plan — the real lever controlling
# ExiusCart's own SMS bill now that this is centralized, not the per-shop
# connection gate a BYOK feature would need.
SMS_LIMITS: dict[str, dict[str, int | None]] = {
    "launch": {"daily": 20, "monthly": 250},
    "growth": {"daily": 50, "monthly": 1000},
    "scale": {"daily": None, "monthly": None},
}

# TheDersi Pro shares plan_type="launch" with real Launch customers, but
# gets its own (lower) allowance rather than Launch's — deliberately not
# just "whatever launch gets", since Pro's price point is set by TheDersi,
# not ExiusCart.
THEDERSI_PRO_SMS_LIMITS: dict[str, int | None] = {"daily": 20, "monthly": 250}


def _shop_or_404(shop_id: int, user: User, db: Session) -> Shop:
    shop = get_shop_for_member(db, shop_id, user)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


def _get_plan(shop_id: int, db: Session) -> str:
    sub = db.query(Subscription).filter(Subscription.shop_id == shop_id).order_by(Subscription.id.desc()).first()
    return sub.plan_type if sub else "free_trial"


def _require_sms_plan(shop_id: int, db: Session) -> str:
    plan = _get_plan(shop_id, db)
    if plan not in SMS_LIMITS:
        raise HTTPException(status_code=403, detail={
            "error": "upgrade_required",
            "plan": plan,
            "message": "SMS marketing is available on Launch, Growth, and Scale.",
        })
    return plan


def _sms_usage(shop_id: int, plan: str, db: Session) -> dict:
    limits = THEDERSI_PRO_SMS_LIMITS if is_thedersi_pro_shop(shop_id, db) else SMS_LIMITS.get(plan, {})
    now = datetime.now(timezone.utc)
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    base = db.query(SMSMessageLog).join(SMSCampaign, SMSCampaign.id == SMSMessageLog.campaign_id).filter(
        SMSCampaign.shop_id == shop_id, SMSMessageLog.status == "sent",
    )
    daily_used = base.filter(SMSMessageLog.sent_at >= day_start).count()
    monthly_used = base.filter(SMSMessageLog.sent_at >= month_start).count()
    return {
        "plan": plan,
        "daily_used": daily_used, "daily_limit": limits.get("daily"),
        "monthly_used": monthly_used, "monthly_limit": limits.get("monthly"),
    }


@router.get("/shops/{shop_id}/sms/usage")
def get_sms_usage(shop_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _shop_or_404(shop_id, current_user, db)
    plan = _get_plan(shop_id, db)
    if plan not in SMS_LIMITS:
        return {"plan": plan, "daily_used": 0, "daily_limit": 0, "monthly_used": 0, "monthly_limit": 0}
    return _sms_usage(shop_id, plan, db)


@router.post("/shops/{shop_id}/marketing/sms/{campaign_id}/send")
def send_sms_campaign(shop_id: int, campaign_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _shop_or_404(shop_id, current_user, db)
    plan = _require_sms_plan(shop_id, db)

    campaign = db.query(SMSCampaign).filter(SMSCampaign.id == campaign_id, SMSCampaign.shop_id == shop_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.status == "sent":
        raise HTTPException(status_code=400, detail="Campaign already sent")
    if not (campaign.message or "").strip():
        raise HTTPException(status_code=400, detail="This campaign has no message text to send.")

    customers = db.query(Customer).filter(
        Customer.shop_id == shop_id, Customer.phone.isnot(None), Customer.phone != "",
    ).all()
    if not customers:
        raise HTTPException(status_code=400, detail="No customers with phone numbers found.")

    usage = _sms_usage(shop_id, plan, db)
    remaining = customers
    if usage["monthly_limit"] is not None:
        remaining_quota = max(0, usage["monthly_limit"] - usage["monthly_used"])
        if usage["daily_limit"] is not None:
            remaining_quota = min(remaining_quota, max(0, usage["daily_limit"] - usage["daily_used"]))
        if remaining_quota == 0:
            raise HTTPException(status_code=403, detail={
                "error": "sms_limit_reached",
                "message": f"Your {plan.title()} plan's SMS quota is used up for now (daily: {usage['daily_limit']}, monthly: {usage['monthly_limit']}). Try again tomorrow, or upgrade for a higher limit.",
            })
        remaining = customers[:remaining_quota]
    elif usage["daily_limit"] is not None:
        remaining_quota = max(0, usage["daily_limit"] - usage["daily_used"])
        if remaining_quota == 0:
            raise HTTPException(status_code=403, detail={
                "error": "sms_limit_reached",
                "message": f"Your {plan.title()} plan's daily SMS quota ({usage['daily_limit']}) is used up. Try again tomorrow.",
            })
        remaining = customers[:remaining_quota]

    campaign.status = "sending"
    campaign.recipients_count = len(remaining)
    db.commit()

    sent, failed = 0, 0
    for customer in remaining:
        success, sid, error = send_sms(customer.phone, campaign.message)
        db.add(SMSMessageLog(
            campaign_id=campaign.id, customer_id=customer.id, phone=customer.phone,
            status="sent" if success else "failed", twilio_message_sid=sid, error=error,
        ))
        if success:
            sent += 1
        else:
            failed += 1
            logger.error(f"[SMS] shop={shop_id} campaign={campaign.id} customer={customer.id} failed: {error}")

    skipped_for_quota = len(customers) - len(remaining)
    campaign.delivered_count = sent
    campaign.status = "sent" if sent > 0 else "failed"
    campaign.sent_at = datetime.now(timezone.utc)
    db.commit()

    return {"sent": sent, "failed": failed, "total": len(customers), "skipped_for_quota": skipped_for_quota}
