"""Marketing endpoints — Email Campaigns, SMS Campaigns, Events, Surveys, Leads, Drip Flows."""
import os
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func as sql_func
from app.core.database import get_db, SessionLocal
from app.models.user import User
from app.models.shop import Shop
from app.models.marketing import (
    EmailCampaign, SMSCampaign, Event, Survey, SurveyQuestion,
    ShopLead, DripFlow, DripFlowStep, DripFlowEnrollment,
)
from app.models.subscription import Subscription
from app.models.email_template import EmailTemplate
from app.api.v1.deps import get_current_user

SOCIAL_LEAD_PLANS = {"premium", "lifetime", "thedersi_pro"}

LEAD_LIMITS: dict = {
    "free_trial":    0,
    "thedersi_basic": 0,
    "starter":       500,
    "thedersi_pro":  500,
    "premium":       None,
    "lifetime":      None,
}

router = APIRouter()


# ── Lead Scoring ───────────────────────────────────────────────────────────────

def compute_score(lead: ShopLead) -> tuple[int, dict]:
    """Compute a 0–100 score for a lead based on available signals."""
    breakdown: dict = {}
    score = 0

    # Status
    status_pts = {"new": 5, "contacted": 15, "qualified": 30, "converted": 5, "lost": -50}
    pts = status_pts.get(lead.status or "new", 0)
    if pts:
        breakdown["status"] = pts
        score += pts

    # Source quality
    source_pts = {
        "google_ads": 20, "meta_ads": 15, "referral": 15,
        "whatsapp": 10, "website": 8, "manual": 5, "other": 3,
    }
    pts = source_pts.get(lead.source or "manual", 0)
    if pts:
        breakdown["source"] = pts
        score += pts

    # Deal value
    val = float(lead.value or 0)
    if val >= 10000:
        breakdown["value"] = 25; score += 25
    elif val >= 5000:
        breakdown["value"] = 20; score += 20
    elif val >= 1000:
        breakdown["value"] = 12; score += 12
    elif val >= 500:
        breakdown["value"] = 8; score += 8
    elif val > 0:
        breakdown["value"] = 5; score += 5

    # Contact completeness
    if lead.email:
        breakdown["email"] = 5; score += 5
    if lead.phone:
        breakdown["phone"] = 5; score += 5
    if lead.company:
        breakdown["company"] = 3; score += 3

    # Recency of creation
    now = datetime.now(timezone.utc)
    created = lead.created_at
    if created:
        if hasattr(created, "tzinfo") and created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        days_old = (now - created).days
        if days_old <= 1:
            breakdown["recency"] = 15; score += 15
        elif days_old <= 7:
            breakdown["recency"] = 10; score += 10
        elif days_old <= 30:
            breakdown["recency"] = 5; score += 5
        elif days_old > 60:
            breakdown["recency"] = -10; score -= 10

    # Last contacted recency
    if lead.last_contacted_at:
        lc = lead.last_contacted_at
        if hasattr(lc, "tzinfo") and lc.tzinfo is None:
            lc = lc.replace(tzinfo=timezone.utc)
        days_since = (now - lc).days
        if days_since <= 3:
            breakdown["last_contact"] = 10; score += 10
        elif days_since <= 7:
            breakdown["last_contact"] = 5; score += 5

    return max(0, min(100, score)), breakdown


def _apply_score(lead: ShopLead):
    s, b = compute_score(lead)
    lead.score = s
    lead.score_breakdown = b


# ── Drip Flow Runner ───────────────────────────────────────────────────────────

def _set_next_step(enrollment: DripFlowEnrollment, steps: list, now: datetime):
    """Advance enrollment to next step and compute next_run_at."""
    enrollment.current_step_order += 1
    enrollment.steps_completed += 1
    if enrollment.current_step_order >= len(steps):
        enrollment.status = "completed"
        enrollment.completed_at = now
        return
    next_step = steps[enrollment.current_step_order]
    if next_step.step_type == "wait":
        hours = (next_step.config or {}).get("hours", 24)
        enrollment.next_run_at = now + timedelta(hours=float(hours))
    else:
        enrollment.next_run_at = now  # run immediately on next tick


def process_drip_flows(db: Session):
    """Process all due drip flow enrollments. Called every 5 min."""
    now = datetime.now(timezone.utc)
    due = (
        db.query(DripFlowEnrollment)
        .filter(DripFlowEnrollment.status == "active", DripFlowEnrollment.next_run_at <= now)
        .all()
    )
    for enrollment in due:
        try:
            flow = enrollment.flow
            if not flow or not flow.is_active:
                enrollment.status = "paused"
                continue
            steps = sorted(flow.steps, key=lambda s: s.sort_order)
            if not steps or enrollment.current_step_order >= len(steps):
                enrollment.status = "completed"
                enrollment.completed_at = now
                continue
            step = steps[enrollment.current_step_order]
            cfg = step.config or {}

            if step.step_type == "wait":
                _set_next_step(enrollment, steps, now)

            elif step.step_type == "send_email":
                lead = enrollment.lead
                if lead and lead.email:
                    from app.core.email import send_email as _send_email, with_thedersi_footer
                    subj = (cfg.get("subject") or "").replace("{name}", lead.name or "there")
                    body = (cfg.get("body_html") or f"<p>Hi {lead.name or 'there'},</p>").replace("{name}", lead.name or "there")
                    body = with_thedersi_footer(body, lead.shop_id)
                    ok = _send_email(to=lead.email, subject=subj, html_body=body)
                    if ok:
                        enrollment.emails_sent = (enrollment.emails_sent or 0) + 1
                _set_next_step(enrollment, steps, now)

            elif step.step_type == "send_whatsapp":
                # WhatsApp is logged — actual send is client-triggered via wa.me deeplink
                _set_next_step(enrollment, steps, now)

            elif step.step_type == "update_status":
                lead = enrollment.lead
                if lead:
                    new_status = cfg.get("status", "contacted")
                    lead.status = new_status
                    _apply_score(lead)
                _set_next_step(enrollment, steps, now)

        except Exception:
            pass

    db.commit()


def process_drip_flows_job():
    """Entry point for the background thread — creates its own DB session."""
    db = SessionLocal()
    try:
        process_drip_flows(db)
    finally:
        db.close()


def _auto_enroll(lead: ShopLead, trigger_type: str, db: Session, trigger_data: dict | None = None):
    """Check active flows for matching trigger and enroll the lead if not already enrolled."""
    flows = (
        db.query(DripFlow)
        .filter(DripFlow.shop_id == lead.shop_id, DripFlow.is_active == True, DripFlow.trigger_type == trigger_type)
        .all()
    )
    now = datetime.now(timezone.utc)
    for flow in flows:
        # Skip if already actively enrolled
        existing = (
            db.query(DripFlowEnrollment)
            .filter(DripFlowEnrollment.flow_id == flow.id, DripFlowEnrollment.lead_id == lead.id,
                    DripFlowEnrollment.status == "active")
            .first()
        )
        if existing:
            continue
        cfg = flow.trigger_config or {}
        # Condition checks
        if trigger_type == "status_changed" and cfg.get("status"):
            if cfg["status"] != (trigger_data or {}).get("status"):
                continue
        elif trigger_type == "score_above":
            if lead.score < cfg.get("score", 70):
                continue
        # Enroll
        steps = sorted(flow.steps, key=lambda s: s.sort_order)
        first_run = now
        if steps and steps[0].step_type == "wait":
            hours = (steps[0].config or {}).get("hours", 24)
            first_run = now + timedelta(hours=float(hours))
        db.add(DripFlowEnrollment(
            flow_id=flow.id, lead_id=lead.id, shop_id=lead.shop_id,
            current_step_order=0, status="active", next_run_at=first_run,
        ))


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
        builder_fields=body.get("builder_fields") or None,
        status="draft",
    )
    db.add(c); db.commit(); db.refresh(c)
    return c


@router.put("/shops/{shop_id}/marketing/email/{cid}")
def update_email_campaign(shop_id: int, cid: int, body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    c = db.query(EmailCampaign).filter(EmailCampaign.id == cid, EmailCampaign.shop_id == shop_id).first()
    if not c: raise HTTPException(status_code=404, detail="Campaign not found")
    for f in ("name", "subject", "body_html", "builder_fields", "status"):
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
    from app.core.email import send_email as _send_email, with_thedersi_footer
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

    body_html = with_thedersi_footer(c.body_html or f"<p>{c.name}</p>", shop_id)

    sent_count = 0
    for customer in to_send:
        ok = _send_email(to=customer.email, subject=c.subject, html_body=body_html)
        if ok:
            db.add(EmailUsageLog(shop_id=shop_id, email_type="marketing", recipient_email=customer.email, reference_id=c.id))
            sent_count += 1

    c.status = "sent"
    c.sent_at = datetime.now(timezone.utc)
    c.recipients_count = sent_count
    db.commit()

    return {"sent": sent_count, "total_customers": len(customers), "limited_to": len(to_send)}


# ── Email builder — image upload + reusable saved templates ────────────────────

@router.get("/shops/{shop_id}/marketing/email-image/presign")
def presign_marketing_image(
    shop_id: int,
    content_type: str = Query("image/jpeg"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Presigned PUT URL so the browser uploads a campaign image (hero or
    any of the extra slots) directly to R2 — not tied to any product.
    Gated to paid plans, same limit table the campaign send itself uses."""
    _shop(shop_id, current_user, db)

    from app.models.subscription import Subscription as _Subscription
    from app.api.v1.endpoints.usage import EMAIL_LIMITS, _get_limit
    sub = db.query(_Subscription).filter(_Subscription.shop_id == shop_id).first()
    plan = sub.plan_type if sub else None
    if _get_limit(EMAIL_LIMITS["marketing"], plan) == 0:
        raise HTTPException(status_code=403, detail="Email images are not available on your plan. Upgrade to Starter or above.")

    from app.core.storage import generate_marketing_presigned_url
    ext = content_type.split("/")[-1].replace("jpeg", "jpg")
    return generate_marketing_presigned_url(shop_id, ext, content_type)


@router.get("/shops/{shop_id}/marketing/email-templates")
def list_email_templates(shop_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    return db.query(EmailTemplate).filter(EmailTemplate.shop_id == shop_id).order_by(EmailTemplate.created_at.desc()).all()


@router.post("/shops/{shop_id}/marketing/email-templates", status_code=201)
def save_email_template(shop_id: int, body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="Template name is required")
    t = EmailTemplate(
        shop_id=shop_id,
        name=name,
        heading=body.get("heading"),
        subtitle=body.get("subtitle"),
        hero_image_url=body.get("hero_image_url"),
        mid_image_url=body.get("mid_image_url"),
        button_image_url=body.get("button_image_url"),
        button_text=body.get("button_text"),
        button_color=body.get("button_color"),
        button_shape=body.get("button_shape"),
        font_key=body.get("font_key"),
    )
    db.add(t); db.commit(); db.refresh(t)
    return t


@router.delete("/shops/{shop_id}/marketing/email-templates/{template_id}", status_code=204)
def delete_email_template(shop_id: int, template_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    t = db.query(EmailTemplate).filter(EmailTemplate.id == template_id, EmailTemplate.shop_id == shop_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    db.delete(t); db.commit()


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


# ── Leads ──────────────────────────────────────────────────────────────────────

def _lead_plan(shop_id: int, db: Session):
    sub = db.query(Subscription).filter(Subscription.shop_id == shop_id).order_by(Subscription.id.desc()).first()
    return sub.plan_type if sub else "free_trial"


@router.get("/shops/{shop_id}/leads/stats")
def lead_stats(shop_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    plan = _lead_plan(shop_id, db)
    limit = LEAD_LIMITS.get(plan)
    total = db.query(sql_func.count(ShopLead.id)).filter(ShopLead.shop_id == shop_id).scalar() or 0
    by_status = dict(
        db.query(ShopLead.status, sql_func.count(ShopLead.id))
        .filter(ShopLead.shop_id == shop_id)
        .group_by(ShopLead.status)
        .all()
    )
    hot = db.query(sql_func.count(ShopLead.id)).filter(ShopLead.shop_id == shop_id, ShopLead.score >= 61).scalar() or 0
    warm = db.query(sql_func.count(ShopLead.id)).filter(ShopLead.shop_id == shop_id, ShopLead.score >= 31, ShopLead.score <= 60).scalar() or 0
    cold = db.query(sql_func.count(ShopLead.id)).filter(ShopLead.shop_id == shop_id, ShopLead.score <= 30).scalar() or 0
    return {"total": total, "limit": limit, "plan": plan, "by_status": by_status,
            "score_hot": hot, "score_warm": warm, "score_cold": cold}


@router.get("/shops/{shop_id}/leads")
def list_leads(
    shop_id: int,
    status: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: Optional[str] = None,  # "score" | "date"
    min_score: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _shop(shop_id, current_user, db)
    q = db.query(ShopLead).filter(ShopLead.shop_id == shop_id)
    if status:
        q = q.filter(ShopLead.status == status)
    if search:
        term = f"%{search}%"
        q = q.filter(
            ShopLead.name.ilike(term) | ShopLead.email.ilike(term) |
            ShopLead.phone.ilike(term) | ShopLead.company.ilike(term)
        )
    if min_score is not None:
        q = q.filter(ShopLead.score >= min_score)
    if sort_by == "score":
        q = q.order_by(ShopLead.score.desc(), ShopLead.created_at.desc())
    else:
        q = q.order_by(ShopLead.created_at.desc())
    return q.all()


@router.post("/shops/{shop_id}/leads", status_code=201)
def create_lead(shop_id: int, body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    plan = _lead_plan(shop_id, db)
    limit = LEAD_LIMITS.get(plan, 0)
    if limit == 0:
        raise HTTPException(status_code=403, detail="Lead management is not available on your current plan. Upgrade to Starter or above.")
    if limit is not None:
        count = db.query(sql_func.count(ShopLead.id)).filter(ShopLead.shop_id == shop_id).scalar() or 0
        if count >= limit:
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "lead_limit_reached",
                    "limit": limit,
                    "used": count,
                    "plan": plan,
                    "message": f"Lead limit of {limit} reached. Upgrade to Premium for unlimited leads.",
                },
            )
    lead = ShopLead(
        shop_id=shop_id,
        name=body.get("name", "").strip(),
        email=body.get("email") or None,
        phone=body.get("phone") or None,
        company=body.get("company") or None,
        source=body.get("source", "manual"),
        status=body.get("status", "new"),
        notes=body.get("notes") or None,
        value=body.get("value") or None,
        assigned_to=body.get("assigned_to") or None,
    )
    db.add(lead); db.flush()
    _apply_score(lead)
    db.commit(); db.refresh(lead)
    _auto_enroll(lead, "lead_created", db)
    db.commit()
    return lead


@router.put("/shops/{shop_id}/leads/{lid}")
def update_lead(shop_id: int, lid: int, body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    lead = db.query(ShopLead).filter(ShopLead.id == lid, ShopLead.shop_id == shop_id).first()
    if not lead: raise HTTPException(status_code=404, detail="Lead not found")
    old_status = lead.status
    for f in ("name", "email", "phone", "company", "source", "status", "notes", "value", "assigned_to"):
        if f in body:
            setattr(lead, f, body[f] or None)
    if "last_contacted_at" in body and body["last_contacted_at"]:
        lead.last_contacted_at = datetime.fromisoformat(body["last_contacted_at"])
    lead.updated_at = datetime.now(timezone.utc)
    _apply_score(lead)
    db.commit(); db.refresh(lead)
    if lead.status != old_status:
        _auto_enroll(lead, "status_changed", db, {"status": lead.status})
    _auto_enroll(lead, "score_above", db)
    db.commit()
    return lead


@router.delete("/shops/{shop_id}/leads/{lid}", status_code=204)
def delete_lead(shop_id: int, lid: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    lead = db.query(ShopLead).filter(ShopLead.id == lid, ShopLead.shop_id == shop_id).first()
    if not lead: raise HTTPException(status_code=404, detail="Not found")
    db.delete(lead); db.commit()


# ── Social Media Lead Capture Integration ─────────────────────────────────────

@router.get("/shops/{shop_id}/leads/integration")
def get_lead_integration(shop_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Returns the webhook URLs for Google Ads and Meta lead capture.
    Only available on Premium and TheDersi Pro plans.
    Auto-generates a unique capture token for the shop on first call.
    """
    shop = _shop(shop_id, current_user, db)
    plan = _lead_plan(shop_id, db)
    if plan not in SOCIAL_LEAD_PLANS:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "plan_required",
                "plan": plan,
                "message": "Social media lead capture is available on Premium and TheDersi Pro plans only.",
            },
        )
    if not shop.lead_capture_token:
        shop.lead_capture_token = secrets.token_urlsafe(32)
        db.commit()
        db.refresh(shop)

    api_base = os.getenv("EXIUSCART_API_BASE", "https://api.exiuscart.com/api/v1").rstrip("/")
    token = shop.lead_capture_token
    return {
        "token": token,
        "plan": plan,
        "google_webhook_url": f"{api_base}/public/lead-capture/{token}",
        "meta_webhook_url": f"{api_base}/public/lead-capture/{token}/meta",
    }


# ── Drip Flows ─────────────────────────────────────────────────────────────────

def _flow_to_dict(flow: DripFlow, db: Session) -> dict:
    enrolled = db.query(sql_func.count(DripFlowEnrollment.id)).filter(
        DripFlowEnrollment.flow_id == flow.id, DripFlowEnrollment.status == "active"
    ).scalar() or 0
    completed = db.query(sql_func.count(DripFlowEnrollment.id)).filter(
        DripFlowEnrollment.flow_id == flow.id, DripFlowEnrollment.status == "completed"
    ).scalar() or 0
    emails_sent = db.query(sql_func.sum(DripFlowEnrollment.emails_sent)).filter(
        DripFlowEnrollment.flow_id == flow.id
    ).scalar() or 0
    return {
        "id": flow.id, "name": flow.name, "description": flow.description,
        "trigger_type": flow.trigger_type, "trigger_config": flow.trigger_config,
        "is_active": flow.is_active, "created_at": flow.created_at.isoformat() if flow.created_at else None,
        "steps": [{"id": s.id, "sort_order": s.sort_order, "step_type": s.step_type, "config": s.config}
                  for s in sorted(flow.steps, key=lambda x: x.sort_order)],
        "stats": {"enrolled": enrolled, "completed": completed, "emails_sent": int(emails_sent)},
    }


@router.get("/shops/{shop_id}/drip-flows")
def list_drip_flows(shop_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    flows = db.query(DripFlow).filter(DripFlow.shop_id == shop_id).order_by(DripFlow.created_at.desc()).all()
    return [_flow_to_dict(f, db) for f in flows]


@router.post("/shops/{shop_id}/drip-flows", status_code=201)
def create_drip_flow(shop_id: int, body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    flow = DripFlow(
        shop_id=shop_id,
        name=body.get("name", "New Flow").strip(),
        description=body.get("description") or None,
        trigger_type=body.get("trigger_type", "lead_created"),
        trigger_config=body.get("trigger_config") or {},
        is_active=False,
    )
    db.add(flow); db.flush()
    for i, step in enumerate(body.get("steps", [])):
        db.add(DripFlowStep(
            flow_id=flow.id, sort_order=i,
            step_type=step.get("step_type", "wait"),
            config=step.get("config") or {},
        ))
    db.commit(); db.refresh(flow)
    return _flow_to_dict(flow, db)


@router.put("/shops/{shop_id}/drip-flows/{fid}")
def update_drip_flow(shop_id: int, fid: int, body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    flow = db.query(DripFlow).filter(DripFlow.id == fid, DripFlow.shop_id == shop_id).first()
    if not flow: raise HTTPException(status_code=404, detail="Flow not found")
    for f in ("name", "description", "trigger_type", "trigger_config", "is_active"):
        if f in body: setattr(flow, f, body[f])
    if "steps" in body:
        for s in flow.steps: db.delete(s)
        db.flush()
        for i, step in enumerate(body["steps"]):
            db.add(DripFlowStep(
                flow_id=flow.id, sort_order=i,
                step_type=step.get("step_type", "wait"),
                config=step.get("config") or {},
            ))
    db.commit(); db.refresh(flow)
    return _flow_to_dict(flow, db)


@router.delete("/shops/{shop_id}/drip-flows/{fid}", status_code=204)
def delete_drip_flow(shop_id: int, fid: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    flow = db.query(DripFlow).filter(DripFlow.id == fid, DripFlow.shop_id == shop_id).first()
    if not flow: raise HTTPException(status_code=404, detail="Flow not found")
    db.delete(flow); db.commit()


@router.post("/shops/{shop_id}/drip-flows/{fid}/toggle")
def toggle_drip_flow(shop_id: int, fid: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    flow = db.query(DripFlow).filter(DripFlow.id == fid, DripFlow.shop_id == shop_id).first()
    if not flow: raise HTTPException(status_code=404, detail="Flow not found")
    flow.is_active = not flow.is_active
    db.commit()
    return {"id": flow.id, "is_active": flow.is_active}


@router.get("/shops/{shop_id}/drip-flows/{fid}/enrollments")
def list_flow_enrollments(shop_id: int, fid: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    flow = db.query(DripFlow).filter(DripFlow.id == fid, DripFlow.shop_id == shop_id).first()
    if not flow: raise HTTPException(status_code=404, detail="Flow not found")
    enrollments = db.query(DripFlowEnrollment).filter(DripFlowEnrollment.flow_id == fid).order_by(DripFlowEnrollment.enrolled_at.desc()).all()
    result = []
    for e in enrollments:
        lead = e.lead
        result.append({
            "id": e.id, "status": e.status, "steps_completed": e.steps_completed,
            "emails_sent": e.emails_sent, "enrolled_at": e.enrolled_at.isoformat() if e.enrolled_at else None,
            "completed_at": e.completed_at.isoformat() if e.completed_at else None,
            "next_run_at": e.next_run_at.isoformat() if e.next_run_at else None,
            "lead": {"id": lead.id, "name": lead.name, "email": lead.email, "score": lead.score} if lead else None,
        })
    return result


@router.post("/shops/{shop_id}/drip-flows/{fid}/enroll/{lead_id}", status_code=201)
def enroll_lead(shop_id: int, fid: int, lead_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    flow = db.query(DripFlow).filter(DripFlow.id == fid, DripFlow.shop_id == shop_id).first()
    if not flow: raise HTTPException(status_code=404, detail="Flow not found")
    lead = db.query(ShopLead).filter(ShopLead.id == lead_id, ShopLead.shop_id == shop_id).first()
    if not lead: raise HTTPException(status_code=404, detail="Lead not found")
    existing = db.query(DripFlowEnrollment).filter(
        DripFlowEnrollment.flow_id == fid, DripFlowEnrollment.lead_id == lead_id,
        DripFlowEnrollment.status == "active",
    ).first()
    if existing: raise HTTPException(status_code=409, detail="Lead already actively enrolled in this flow")
    steps = sorted(flow.steps, key=lambda s: s.sort_order)
    now = datetime.now(timezone.utc)
    first_run = now
    if steps and steps[0].step_type == "wait":
        hours = (steps[0].config or {}).get("hours", 24)
        first_run = now + timedelta(hours=float(hours))
    enrollment = DripFlowEnrollment(
        flow_id=fid, lead_id=lead_id, shop_id=shop_id,
        current_step_order=0, status="active", next_run_at=first_run,
    )
    db.add(enrollment); db.commit()
    return {"enrolled": True, "next_run_at": first_run.isoformat()}
