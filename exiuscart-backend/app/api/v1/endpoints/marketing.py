"""Marketing endpoints — Email Campaigns, SMS Campaigns, Events, Surveys."""
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.models.shop import Shop
from app.models.marketing import EmailCampaign, SMSCampaign, Event, Survey, SurveyQuestion
from app.api.v1.deps import get_current_user

router = APIRouter()


def _shop(shop_id: int, user: User, db: Session) -> Shop:
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


# ── Email Campaigns ────────────────────────────────────────────────────────────

@router.get("/shops/{shop_id}/marketing/email")
def list_email_campaigns(shop_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    return db.query(EmailCampaign).filter(EmailCampaign.shop_id == shop_id).order_by(EmailCampaign.created_at.desc()).all()


@router.post("/shops/{shop_id}/marketing/email", status_code=201)
def create_email_campaign(shop_id: int, body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    c = EmailCampaign(
        shop_id=shop_id,
        name=body.get("name", "").strip(),
        subject=body.get("subject", "").strip(),
        body_html=body.get("body_html") or None,
        status="draft",
    )
    db.add(c); db.commit(); db.refresh(c)
    return c


@router.put("/shops/{shop_id}/marketing/email/{cid}")
def update_email_campaign(shop_id: int, cid: int, body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    c = db.query(EmailCampaign).filter(EmailCampaign.id == cid, EmailCampaign.shop_id == shop_id).first()
    if not c: raise HTTPException(status_code=404, detail="Campaign not found")
    for f in ("name", "subject", "body_html", "status"):
        if f in body: setattr(c, f, body[f])
    if body.get("status") == "sent" and not c.sent_at:
        c.sent_at = datetime.now(timezone.utc)
    db.commit(); return c


@router.delete("/shops/{shop_id}/marketing/email/{cid}", status_code=204)
def delete_email_campaign(shop_id: int, cid: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    c = db.query(EmailCampaign).filter(EmailCampaign.id == cid, EmailCampaign.shop_id == shop_id).first()
    if not c: raise HTTPException(status_code=404, detail="Not found")
    db.delete(c); db.commit()


@router.post("/shops/{shop_id}/marketing/email/{cid}/send")
def send_email_campaign(shop_id: int, cid: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    c = db.query(EmailCampaign).filter(EmailCampaign.id == cid, EmailCampaign.shop_id == shop_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if c.status == "sent":
        raise HTTPException(status_code=400, detail="Campaign already sent")

    # Resolve plan
    from app.models.subscription import Subscription
    from app.models.email_usage_log import EmailUsageLog
    from app.models.customer import Customer
    from app.api.v1.endpoints.usage import EMAIL_LIMITS, _get_limit, _month_start
    from app.core.email import send_email as _send_email
    from sqlalchemy import func as sql_func

    sub = db.query(Subscription).filter(Subscription.shop_id == shop_id).first()
    plan = sub.plan_type if sub else None

    limit = _get_limit(EMAIL_LIMITS["marketing"], plan)
    if limit == 0:
        raise HTTPException(status_code=403, detail="Marketing emails are not available on your plan. Upgrade to Starter or above.")

    used = db.query(sql_func.count(EmailUsageLog.id)).filter(
        EmailUsageLog.shop_id == shop_id,
        EmailUsageLog.email_type == "marketing",
        EmailUsageLog.sent_at >= _month_start(),
    ).scalar() or 0

    remaining = (limit - used) if limit is not None else None  # None = unlimited

    if remaining is not None and remaining <= 0:
        raise HTTPException(status_code=429, detail=f"Monthly marketing email limit of {limit} reached. Upgrade to continue.")

    customers = db.query(Customer).filter(
        Customer.shop_id == shop_id,
        Customer.email.isnot(None),
        Customer.email != "",
    ).all()

    if not customers:
        raise HTTPException(status_code=400, detail="No customers with email addresses found.")

    to_send = customers if remaining is None else customers[:remaining]

    sent_count = 0
    for customer in to_send:
        ok = _send_email(to=customer.email, subject=c.subject, html_body=c.body_html or f"<p>{c.name}</p>")
        if ok:
            db.add(EmailUsageLog(shop_id=shop_id, email_type="marketing", recipient_email=customer.email, reference_id=c.id))
            sent_count += 1

    c.status = "sent"
    c.sent_at = datetime.now(timezone.utc)
    c.recipients_count = sent_count
    db.commit()

    return {"sent": sent_count, "total_customers": len(customers), "limited_to": len(to_send)}


# ── SMS Campaigns ──────────────────────────────────────────────────────────────

@router.get("/shops/{shop_id}/marketing/sms")
def list_sms_campaigns(shop_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    return db.query(SMSCampaign).filter(SMSCampaign.shop_id == shop_id).order_by(SMSCampaign.created_at.desc()).all()


@router.post("/shops/{shop_id}/marketing/sms", status_code=201)
def create_sms_campaign(shop_id: int, body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    c = SMSCampaign(
        shop_id=shop_id,
        name=body.get("name", "").strip(),
        message=body.get("message", "").strip(),
        status="draft",
    )
    db.add(c); db.commit(); db.refresh(c)
    return c


@router.put("/shops/{shop_id}/marketing/sms/{cid}")
def update_sms_campaign(shop_id: int, cid: int, body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    c = db.query(SMSCampaign).filter(SMSCampaign.id == cid, SMSCampaign.shop_id == shop_id).first()
    if not c: raise HTTPException(status_code=404, detail="Campaign not found")
    for f in ("name", "message", "status"):
        if f in body: setattr(c, f, body[f])
    db.commit(); return c


@router.delete("/shops/{shop_id}/marketing/sms/{cid}", status_code=204)
def delete_sms_campaign(shop_id: int, cid: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    c = db.query(SMSCampaign).filter(SMSCampaign.id == cid, SMSCampaign.shop_id == shop_id).first()
    if not c: raise HTTPException(status_code=404, detail="Not found")
    db.delete(c); db.commit()


# ── Events ─────────────────────────────────────────────────────────────────────

@router.get("/shops/{shop_id}/events")
def list_events(shop_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    return db.query(Event).filter(Event.shop_id == shop_id).order_by(Event.start_date).all()


@router.post("/shops/{shop_id}/events", status_code=201)
def create_event(shop_id: int, body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    e = Event(
        shop_id=shop_id,
        title=body.get("title", "").strip(),
        description=body.get("description") or None,
        location=body.get("location") or None,
        start_date=datetime.fromisoformat(body["start_date"]),
        end_date=datetime.fromisoformat(body["end_date"]) if body.get("end_date") else None,
        capacity=body.get("capacity"),
        is_online=body.get("is_online", False),
        meeting_url=body.get("meeting_url") or None,
    )
    db.add(e); db.commit(); db.refresh(e)
    return e


@router.put("/shops/{shop_id}/events/{eid}")
def update_event(shop_id: int, eid: int, body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    e = db.query(Event).filter(Event.id == eid, Event.shop_id == shop_id).first()
    if not e: raise HTTPException(status_code=404, detail="Event not found")
    for f in ("title", "description", "location", "capacity", "is_online", "meeting_url", "status"):
        if f in body: setattr(e, f, body[f])
    db.commit(); return e


@router.delete("/shops/{shop_id}/events/{eid}", status_code=204)
def delete_event(shop_id: int, eid: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    e = db.query(Event).filter(Event.id == eid, Event.shop_id == shop_id).first()
    if not e: raise HTTPException(status_code=404, detail="Not found")
    db.delete(e); db.commit()


# ── Surveys ────────────────────────────────────────────────────────────────────

@router.get("/shops/{shop_id}/surveys")
def list_surveys(shop_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    surveys = db.query(Survey).filter(Survey.shop_id == shop_id).order_by(Survey.created_at.desc()).all()
    return [{"id": s.id, "title": s.title, "description": s.description, "status": s.status,
             "response_count": s.response_count, "question_count": len(s.questions),
             "created_at": s.created_at.isoformat()} for s in surveys]


@router.post("/shops/{shop_id}/surveys", status_code=201)
def create_survey(shop_id: int, body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    s = Survey(shop_id=shop_id, title=body.get("title", "").strip(),
               description=body.get("description") or None)
    db.add(s); db.flush()
    for i, q in enumerate(body.get("questions", [])):
        sq = SurveyQuestion(survey_id=s.id, question_text=q.get("question_text", ""),
                            question_type=q.get("question_type", "text"),
                            options=q.get("options"), sort_order=i)
        db.add(sq)
    db.commit(); db.refresh(s)
    return {"id": s.id, "title": s.title, "status": s.status}


@router.put("/shops/{shop_id}/surveys/{sid}/status")
def update_survey_status(shop_id: int, sid: int, body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    s = db.query(Survey).filter(Survey.id == sid, Survey.shop_id == shop_id).first()
    if not s: raise HTTPException(status_code=404, detail="Survey not found")
    s.status = body.get("status", s.status)
    db.commit(); return {"id": s.id, "status": s.status}


@router.delete("/shops/{shop_id}/surveys/{sid}", status_code=204)
def delete_survey(shop_id: int, sid: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    s = db.query(Survey).filter(Survey.id == sid, Survey.shop_id == shop_id).first()
    if not s: raise HTTPException(status_code=404, detail="Not found")
    db.delete(s); db.commit()
