"""
WhatsApp Marketing — broadcast a Meta-approved message template to every
customer with a phone number on file. BYOK: the seller connects their OWN
WhatsApp Business Account, same reasoning as CJ/HyperSKU/Higgsfield/
social_posting.py — Meta bills per-message (no free tier for marketing
sends, confirmed July 2025 pricing), so the seller pays their own bill
directly, ExiusCart never touches it.

Connecting is a manual credential paste, not OAuth — see WhatsAppConnection's
own docstring for why (Meta's real "Embedded Signup" needs their JS SDK
popup, not a plain redirect, and isn't something this environment can build
against without a live app to test). The three values the seller pastes
(waba_id, phone_number_id, access_token) are the exact same three Meta's own
WhatsApp Manager → API Setup tab already displays to any WABA owner.

Sourcing note (same confirmed-vs-inferred discipline as social_posting.py):
  - POST /{phone_number_id}/messages with messaging_product="whatsapp",
    type="template", template.name/language.code — CONFIRMED against Meta's
    own Cloud API messages reference.
  - template.components[].parameters (text-substitution shape for {{1}}
    style body variables) — Meta's docs excerpt didn't fully expand this,
    but it's one of the most stable, unchanged-since-2022 shapes in the
    whole Graph API surface, used identically by every third-party
    WhatsApp SDK — treated at the same confidence level tiktok.py gives
    Facebook's/eBay's other long-stable dialogs, still worth a real test
    send to confirm on first use.
  - GET /{waba_id}/message_templates (list) — CONFIRMED as the standard
    Graph API list-an-edge convention (same shape as /me/accounts in
    social_posting.py), the response field names (name/status/category/
    language/components) are Meta's own documented template object shape.
  - Real per-24h messaging limits (tiered, starts low for a new phone
    number and grows with quality rating) are NOT enforced here — sending
    stays within whatever tier Meta has actually granted the seller's own
    number; a seller broadcasting to more customers than their current tier
    allows will see Meta itself reject the excess sends (logged per-row in
    WhatsAppMessageLog, not silently dropped).
"""
import os
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
from app.models.whatsapp_marketing import WhatsAppConnection, WhatsAppTemplate, WhatsAppCampaign, WhatsAppMessageLog

logger = logging.getLogger(__name__)
router = APIRouter()

META_GRAPH_VERSION = "v19.0"
META_GRAPH_BASE = f"https://graph.facebook.com/{META_GRAPH_VERSION}"


def _shop_or_404(shop_id: int, user: User, db: Session) -> Shop:
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


def _get_plan(shop_id: int, db: Session) -> str:
    sub = db.query(Subscription).filter(Subscription.shop_id == shop_id).order_by(Subscription.id.desc()).first()
    return sub.plan_type if sub else "free_trial"


def _require_premium(shop_id: int, db: Session):
    if _get_plan(shop_id, db) != "premium":
        raise HTTPException(status_code=403, detail={
            "error": "upgrade_required",
            "message": "WhatsApp marketing is a Premium feature.",
        })


def _get_connection(shop_id: int, db: Session) -> WhatsAppConnection:
    conn = db.query(WhatsAppConnection).filter(WhatsAppConnection.shop_id == shop_id, WhatsAppConnection.is_active == True).first()
    if not conn:
        raise HTTPException(status_code=400, detail={
            "error": "whatsapp_not_connected",
            "message": "Connect your WhatsApp Business account first.",
        })
    return conn


# ── Connection ───────────────────────────────────────────────────────────────

class WhatsAppConnectIn(BaseModel):
    waba_id: str
    phone_number_id: str
    access_token: str


@router.post("/shops/{shop_id}/whatsapp/connect")
def connect_whatsapp(shop_id: int, data: WhatsAppConnectIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _shop_or_404(shop_id, current_user, db)
    _require_premium(shop_id, db)

    # Verify against Meta's own API before saving — same discipline as
    # HyperSKU's _hypersku_get_token call in dropshipping.py.
    try:
        with httpx.Client(timeout=15) as client:
            resp = client.get(f"{META_GRAPH_BASE}/{data.phone_number_id}", params={
                "fields": "display_phone_number,verified_name",
                "access_token": data.access_token,
            })
        if resp.status_code >= 300:
            raise HTTPException(status_code=400, detail=f"Meta rejected these credentials: {resp.text[:300]}")
        info = resp.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Could not reach Meta's API: {e}")

    existing = db.query(WhatsAppConnection).filter(WhatsAppConnection.shop_id == shop_id).first()
    if existing:
        existing.waba_id = data.waba_id
        existing.phone_number_id = data.phone_number_id
        existing.access_token = encrypt(data.access_token)
        existing.display_phone_number = info.get("display_phone_number")
        existing.verified_name = info.get("verified_name")
        existing.is_active = True
    else:
        db.add(WhatsAppConnection(
            shop_id=shop_id, waba_id=data.waba_id, phone_number_id=data.phone_number_id,
            access_token=encrypt(data.access_token),
            display_phone_number=info.get("display_phone_number"),
            verified_name=info.get("verified_name"),
        ))
    db.commit()
    return {"message": "Connected", "display_phone_number": info.get("display_phone_number"), "verified_name": info.get("verified_name")}


@router.get("/shops/{shop_id}/whatsapp/status")
def whatsapp_status(shop_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _shop_or_404(shop_id, current_user, db)
    conn = db.query(WhatsAppConnection).filter(WhatsAppConnection.shop_id == shop_id, WhatsAppConnection.is_active == True).first()
    if not conn:
        return {"connected": False}
    return {"connected": True, "display_phone_number": conn.display_phone_number, "verified_name": conn.verified_name}


@router.delete("/shops/{shop_id}/whatsapp/connect")
def disconnect_whatsapp(shop_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _shop_or_404(shop_id, current_user, db)
    conn = db.query(WhatsAppConnection).filter(WhatsAppConnection.shop_id == shop_id).first()
    if conn:
        db.delete(conn)
        db.commit()
    return {"message": "Disconnected"}


# ── Templates (read-only sync from Meta) ────────────────────────────────────

def _count_variables(body_text: str) -> int:
    import re
    return len(set(re.findall(r"\{\{(\d+)\}\}", body_text or "")))


@router.post("/shops/{shop_id}/whatsapp/templates/sync")
def sync_whatsapp_templates(shop_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _shop_or_404(shop_id, current_user, db)
    conn = _get_connection(shop_id, db)
    token = decrypt(conn.access_token)

    try:
        with httpx.Client(timeout=20) as client:
            resp = client.get(f"{META_GRAPH_BASE}/{conn.waba_id}/message_templates", params={
                "access_token": token, "limit": 100,
                "fields": "id,name,language,category,status,components",
            })
        if resp.status_code >= 300:
            raise HTTPException(status_code=502, detail=f"Meta rejected the templates request: {resp.text[:300]}")
        templates = resp.json().get("data", [])
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Could not reach Meta's API: {e}")

    synced = 0
    for t in templates:
        body_component = next((c for c in t.get("components", []) if c.get("type") == "BODY"), None)
        body_text = body_component.get("text") if body_component else None
        existing = db.query(WhatsAppTemplate).filter(
            WhatsAppTemplate.shop_id == shop_id, WhatsAppTemplate.meta_template_id == t.get("id"),
        ).first()
        fields = dict(
            name=t.get("name", ""), language=t.get("language", ""), category=t.get("category"),
            status=t.get("status"), body_text=body_text, variable_count=_count_variables(body_text),
            synced_at=datetime.now(timezone.utc),
        )
        if existing:
            for k, v in fields.items():
                setattr(existing, k, v)
        else:
            db.add(WhatsAppTemplate(shop_id=shop_id, meta_template_id=t.get("id"), **fields))
        synced += 1
    db.commit()
    return {"synced": synced}


@router.get("/shops/{shop_id}/whatsapp/templates")
def list_whatsapp_templates(shop_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _shop_or_404(shop_id, current_user, db)
    templates = db.query(WhatsAppTemplate).filter(WhatsAppTemplate.shop_id == shop_id).order_by(WhatsAppTemplate.name).all()
    return {"templates": [
        {
            "id": t.id, "name": t.name, "language": t.language, "category": t.category,
            "status": t.status, "body_text": t.body_text, "variable_count": t.variable_count,
        } for t in templates
    ]}


# ── Campaigns ────────────────────────────────────────────────────────────────

class CampaignIn(BaseModel):
    name: str
    template_id: int


def _campaign_out(c: WhatsAppCampaign) -> dict:
    return {
        "id": c.id, "name": c.name, "status": c.status,
        "template_id": c.template_id, "template_name": c.template.name if c.template else None,
        "total_recipients": c.total_recipients, "sent_count": c.sent_count, "failed_count": c.failed_count,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "sent_at": c.sent_at.isoformat() if c.sent_at else None,
    }


@router.post("/shops/{shop_id}/whatsapp/campaigns")
def create_campaign(shop_id: int, data: CampaignIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _shop_or_404(shop_id, current_user, db)
    _require_premium(shop_id, db)
    template = db.query(WhatsAppTemplate).filter(WhatsAppTemplate.id == data.template_id, WhatsAppTemplate.shop_id == shop_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found — sync your templates first.")
    if template.status != "APPROVED":
        raise HTTPException(status_code=400, detail=f"This template is {template.status or 'not yet approved'} — Meta only allows sending APPROVED templates.")

    campaign = WhatsAppCampaign(shop_id=shop_id, template_id=template.id, name=data.name)
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return _campaign_out(campaign)


@router.get("/shops/{shop_id}/whatsapp/campaigns")
def list_campaigns(shop_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _shop_or_404(shop_id, current_user, db)
    campaigns = db.query(WhatsAppCampaign).filter(WhatsAppCampaign.shop_id == shop_id).order_by(WhatsAppCampaign.created_at.desc()).all()
    return {"campaigns": [_campaign_out(c) for c in campaigns]}


@router.delete("/shops/{shop_id}/whatsapp/campaigns/{campaign_id}")
def delete_campaign(shop_id: int, campaign_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _shop_or_404(shop_id, current_user, db)
    campaign = db.query(WhatsAppCampaign).filter(WhatsAppCampaign.id == campaign_id, WhatsAppCampaign.shop_id == shop_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.status not in ("draft", "failed"):
        raise HTTPException(status_code=400, detail=f"Can't delete a campaign that's already {campaign.status}.")
    db.delete(campaign)
    db.commit()
    return {"message": "Deleted"}


def _send_template_message(conn: WhatsAppConnection, template: WhatsAppTemplate, phone: str, customer_name: str | None) -> tuple[bool, str | None, str | None]:
    """Returns (success, whatsapp_message_id, error)."""
    token = decrypt(conn.access_token)
    template_payload = {"name": template.name, "language": {"code": template.language}}
    if template.variable_count >= 1:
        template_payload["components"] = [{
            "type": "body",
            "parameters": [{"type": "text", "text": customer_name or "there"}],
        }]
    body = {
        "messaging_product": "whatsapp", "to": phone, "type": "template",
        "template": template_payload,
    }
    try:
        with httpx.Client(timeout=30) as client:
            resp = client.post(f"{META_GRAPH_BASE}/{conn.phone_number_id}/messages", json=body, headers={
                "Authorization": f"Bearer {token}", "Content-Type": "application/json",
            })
        if resp.status_code >= 300:
            return False, None, resp.text[:500]
        data = resp.json()
        msg_id = (data.get("messages") or [{}])[0].get("id")
        return True, msg_id, None
    except Exception as e:
        return False, None, str(e)[:500]


@router.post("/shops/{shop_id}/whatsapp/campaigns/{campaign_id}/send")
def send_campaign(shop_id: int, campaign_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _shop_or_404(shop_id, current_user, db)
    _require_premium(shop_id, db)
    conn = _get_connection(shop_id, db)

    campaign = db.query(WhatsAppCampaign).filter(WhatsAppCampaign.id == campaign_id, WhatsAppCampaign.shop_id == shop_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.status == "sent":
        raise HTTPException(status_code=400, detail="Campaign already sent")

    customers = db.query(Customer).filter(
        Customer.shop_id == shop_id, Customer.phone.isnot(None), Customer.phone != "",
    ).all()
    if not customers:
        raise HTTPException(status_code=400, detail="No customers with phone numbers found.")

    campaign.status = "sending"
    campaign.total_recipients = len(customers)
    db.commit()

    sent, failed = 0, 0
    for customer in customers:
        success, msg_id, error = _send_template_message(conn, campaign.template, customer.phone, customer.name)
        db.add(WhatsAppMessageLog(
            campaign_id=campaign.id, customer_id=customer.id, phone=customer.phone,
            status="sent" if success else "failed", whatsapp_message_id=msg_id, error=error,
        ))
        if success:
            sent += 1
        else:
            failed += 1
            logger.error(f"[WHATSAPP] shop={shop_id} campaign={campaign.id} customer={customer.id} failed: {error}")

    campaign.sent_count = sent
    campaign.failed_count = failed
    campaign.status = "sent" if failed == 0 else ("failed" if sent == 0 else "sent")
    campaign.sent_at = datetime.now(timezone.utc)
    db.commit()

    return {"sent": sent, "failed": failed, "total": len(customers)}
