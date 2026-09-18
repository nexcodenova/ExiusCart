"""
SMS Marketing — broadcast a free-text message to every customer with a
phone number on file. BYOK: the seller connects their OWN Twilio account,
same reasoning as WhatsAppConnection/DropshipConnection/social_posting.py —
Twilio bills per message with no free tier for marketing sends, so the
seller pays their own bill directly, ExiusCart never touches it.

Unlike WhatsApp, Twilio's plain SMS API needs no pre-approved message
template — a campaign's own free-text `message` field (SMSCampaign, in
app/models/marketing.py — that's where its CRUD already lives) is sent
as-is to every recipient, so there's no template sync step here.

Sourcing note: Twilio's Messages resource (Basic Auth with Account SID as
username / Auth Token as password; POST .../Messages.json with To/From/Body
form fields; GET .../Accounts/{sid}.json to verify credentials) is Twilio's
core REST API, unchanged since the product's earliest public docs — treated
at the same confidence level as Meta's own long-stable Graph API edges
elsewhere in this codebase.
"""
import logging
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.encryption import encrypt, decrypt
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.shop import Shop
from app.models.subscription import Subscription
from app.models.customer import Customer
from app.models.marketing import SMSCampaign
from app.models.sms_marketing import SMSConnection, SMSMessageLog

logger = logging.getLogger(__name__)
router = APIRouter()

TWILIO_API_BASE = "https://api.twilio.com/2010-04-01"


def _shop_or_404(shop_id: int, user: User, db: Session) -> Shop:
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


def _get_plan(shop_id: int, db: Session) -> str:
    sub = db.query(Subscription).filter(Subscription.shop_id == shop_id).order_by(Subscription.id.desc()).first()
    return sub.plan_type if sub else "free_trial"


def _require_premium(shop_id: int, db: Session):
    if _get_plan(shop_id, db) not in ("growth", "scale"):
        raise HTTPException(status_code=403, detail={
            "error": "upgrade_required",
            "message": "SMS marketing is available on Growth and Scale.",
        })


def _get_connection(shop_id: int, db: Session) -> SMSConnection:
    conn = db.query(SMSConnection).filter(SMSConnection.shop_id == shop_id, SMSConnection.is_active == True).first()
    if not conn:
        raise HTTPException(status_code=400, detail={
            "error": "sms_not_connected",
            "message": "Connect your Twilio account first.",
        })
    return conn


# ── Connection ───────────────────────────────────────────────────────────────

class SMSConnectIn(BaseModel):
    account_sid: str
    auth_token: str
    from_number: str


@router.post("/shops/{shop_id}/sms/connect")
def connect_sms(shop_id: int, data: SMSConnectIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _shop_or_404(shop_id, current_user, db)
    _require_premium(shop_id, db)

    account_sid = data.account_sid.strip()
    auth_token = data.auth_token.strip()
    from_number = data.from_number.strip()

    # Verify against Twilio's own API before saving — same discipline as
    # WhatsApp's phone-number lookup call in whatsapp_marketing.py.
    try:
        with httpx.Client(timeout=15) as client:
            resp = client.get(
                f"{TWILIO_API_BASE}/Accounts/{account_sid}.json",
                auth=(account_sid, auth_token),
            )
        if resp.status_code >= 300:
            raise HTTPException(status_code=400, detail="Twilio rejected these credentials — check your Account SID and Auth Token.")
        info = resp.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Could not reach Twilio's API: {e}")

    existing = db.query(SMSConnection).filter(SMSConnection.shop_id == shop_id).first()
    if existing:
        existing.account_sid = account_sid
        existing.auth_token = encrypt(auth_token)
        existing.from_number = from_number
        existing.is_active = True
    else:
        db.add(SMSConnection(
            shop_id=shop_id, account_sid=account_sid,
            auth_token=encrypt(auth_token), from_number=from_number,
        ))
    db.commit()
    return {"message": "Connected", "friendly_name": info.get("friendly_name"), "from_number": from_number}


@router.get("/shops/{shop_id}/sms/status")
def sms_status(shop_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _shop_or_404(shop_id, current_user, db)
    conn = db.query(SMSConnection).filter(SMSConnection.shop_id == shop_id, SMSConnection.is_active == True).first()
    if not conn:
        return {"connected": False}
    return {"connected": True, "from_number": conn.from_number, "provider": conn.provider}


@router.delete("/shops/{shop_id}/sms/connect")
def disconnect_sms(shop_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _shop_or_404(shop_id, current_user, db)
    conn = db.query(SMSConnection).filter(SMSConnection.shop_id == shop_id).first()
    if conn:
        db.delete(conn)
        db.commit()
    return {"message": "Disconnected"}


# ── Send ─────────────────────────────────────────────────────────────────────

def _send_sms(conn: SMSConnection, to_phone: str, body: str) -> tuple[bool, str | None, str | None]:
    """Returns (success, twilio_message_sid, error)."""
    auth_token = decrypt(conn.auth_token)
    try:
        with httpx.Client(timeout=30) as client:
            resp = client.post(
                f"{TWILIO_API_BASE}/Accounts/{conn.account_sid}/Messages.json",
                auth=(conn.account_sid, auth_token),
                data={"To": to_phone, "From": conn.from_number, "Body": body},
            )
        data = resp.json()
        if resp.status_code >= 300:
            return False, None, data.get("message") or resp.text[:500]
        return True, data.get("sid"), None
    except Exception as e:
        return False, None, str(e)[:500]


@router.post("/shops/{shop_id}/marketing/sms/{campaign_id}/send")
def send_sms_campaign(shop_id: int, campaign_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _shop_or_404(shop_id, current_user, db)
    _require_premium(shop_id, db)
    conn = _get_connection(shop_id, db)

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

    campaign.status = "sending"
    campaign.recipients_count = len(customers)
    db.commit()

    sent, failed = 0, 0
    for customer in customers:
        success, sid, error = _send_sms(conn, customer.phone, campaign.message)
        db.add(SMSMessageLog(
            campaign_id=campaign.id, customer_id=customer.id, phone=customer.phone,
            status="sent" if success else "failed", twilio_message_sid=sid, error=error,
        ))
        if success:
            sent += 1
        else:
            failed += 1
            logger.error(f"[SMS] shop={shop_id} campaign={campaign.id} customer={customer.id} failed: {error}")

    campaign.delivered_count = sent
    campaign.status = "sent" if sent > 0 else "failed"
    campaign.sent_at = datetime.now(timezone.utc)
    db.commit()

    return {"sent": sent, "failed": failed, "total": len(customers)}
