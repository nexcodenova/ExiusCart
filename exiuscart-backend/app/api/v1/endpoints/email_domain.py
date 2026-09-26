"""A store's own sending domain (Scale plan) - the seller's side.

Owner-only: "email-domain" is not in shop_access.PATH_AREAS, so the staff gate keeps it
owner-only. The domain itself is registered with Amazon SES (see app/core/email_domains.py)."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.core import email_domains as ed
from app.core.database import get_db
from app.core.shop_access import get_shop_for_member
from app.core.thedersi import is_thedersi_restricted_shop
from app.models.email_monitor import EmailDomain, EmailEvent, EmailShopControl
from app.models.user import User

router = APIRouter()


def _shop(db: Session, shop_id: int, user: User):
    shop = get_shop_for_member(db, shop_id, user)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


def _require_scale(db: Session, shop) -> None:
    if is_thedersi_restricted_shop(shop.id, db):
        raise HTTPException(status_code=403, detail={"error": "not_available", "message": "Custom email domains are for direct ExiusCart sellers."})
    if not ed._is_scale(db, shop.id):
        raise HTTPException(status_code=403, detail={"error": "plan_required", "message": "Sending from your own domain is included in the Scale plan."})


def _dom_out(dom: Optional[EmailDomain]) -> Optional[dict]:
    if not dom:
        return None
    return {
        "id": dom.id, "domain": dom.domain, "from_local": dom.from_local, "from_address": f"{dom.from_local}@{dom.domain}",
        "status": dom.status, "dkim_status": dom.dkim_status, "records": ed.dns_records(dom),
        "verified_at": dom.verified_at.isoformat() if dom.verified_at else None,
        "last_checked_at": dom.last_checked_at.isoformat() if dom.last_checked_at else None,
        "suspended_reason": dom.suspended_reason,
    }


def _wrap(fn):
    try:
        return fn()
    except ed.EmailDomainError as e:
        raise HTTPException(status_code=e.status, detail={"error": e.code, "message": e.message})


class DomainIn(BaseModel):
    domain: str
    from_local: Optional[str] = "invoices"


@router.get("/shops/{shop_id}/email-domain")
def get_email_domain(shop_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    shop = _shop(db, shop_id, user)
    dom = db.query(EmailDomain).filter(EmailDomain.shop_id == shop.id).first()
    ctl = db.query(EmailShopControl).filter(EmailShopControl.shop_id == shop.id).first()
    return {
        "eligible": ed._is_scale(db, shop.id) and not is_thedersi_restricted_shop(shop.id, db),
        "available": ed.ses_configured(),
        "domain": _dom_out(dom),
        "marketing_paused": bool(ctl and ctl.paused),
        "marketing_paused_reason": ctl.reason if ctl and ctl.paused else None,
        "shop_email": shop.email,
        "shop_name": shop.name,
    }


@router.post("/shops/{shop_id}/email-domain", status_code=201)
def add_email_domain(shop_id: int, data: DomainIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    shop = _shop(db, shop_id, user)
    _require_scale(db, shop)
    dom = _wrap(lambda: ed.register_domain(db, shop.id, data.domain, data.from_local))
    return _dom_out(dom)


@router.post("/shops/{shop_id}/email-domain/check")
def check_email_domain(shop_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    shop = _shop(db, shop_id, user)
    _require_scale(db, shop)
    dom = db.query(EmailDomain).filter(EmailDomain.shop_id == shop.id).first()
    if not dom:
        raise HTTPException(status_code=404, detail="Add your domain first.")
    return _dom_out(_wrap(lambda: ed.refresh_domain(db, dom)))


@router.put("/shops/{shop_id}/email-domain")
def rename_sender(shop_id: int, data: DomainIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Change the name before the @ (invoices@ -> billing@) without touching the DNS records."""
    shop = _shop(db, shop_id, user)
    _require_scale(db, shop)
    dom = db.query(EmailDomain).filter(EmailDomain.shop_id == shop.id).first()
    if not dom:
        raise HTTPException(status_code=404, detail="Add your domain first.")
    dom.from_local = _wrap(lambda: ed.clean_local(data.from_local))
    db.commit()
    return _dom_out(dom)


@router.delete("/shops/{shop_id}/email-domain")
def delete_email_domain(shop_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    shop = _shop(db, shop_id, user)
    dom = db.query(EmailDomain).filter(EmailDomain.shop_id == shop.id).first()
    if not dom:
        raise HTTPException(status_code=404, detail="No domain to remove.")
    _wrap(lambda: ed.remove_domain(db, dom))
    return {"deleted": True}


@router.get("/shops/{shop_id}/email-domain/activity")
def email_activity(shop_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """The seller's own delivery picture: how their mail is doing and which addresses had problems."""
    shop = _shop(db, shop_id, user)
    h = ed.health(db, shop_id=shop.id)
    rows = (db.query(EmailEvent)
            .filter(EmailEvent.shop_id == shop.id, EmailEvent.status.in_(("bounced", "complained", "failed", "suppressed", "blocked", "rejected")))
            .order_by(EmailEvent.id.desc()).limit(25).all())
    return {
        "days": ed.WINDOW_DAYS, "health": h,
        "problems": [{
            "id": r.id, "recipient": r.recipient, "subject": r.subject, "status": r.status, "detail": r.detail,
            "bounce_type": r.bounce_type, "created_at": r.created_at.isoformat() if r.created_at else None,
        } for r in rows],
    }
