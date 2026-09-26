"""Admin > Audit > Email Monitor: every email ExiusCart sends, what happened to it, the
sellers' custom domains, addresses we stopped mailing, and stores whose marketing
mail is paused."""
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.api.v1.endpoints.admin import require_superuser
from app.core import email_domains as ed
from app.core.audit_log import record_audit_event
from app.core.database import get_db
from app.models.email_monitor import EmailDomain, EmailEvent, EmailShopControl, EmailSuppression
from app.models.shop import Shop
from app.models.user import User

router = APIRouter()

_PROBLEM = ("bounced", "complained", "failed", "rejected")


def _like(term: str) -> str:
    return "%" + term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"


def _iso(v) -> Optional[str]:
    return v.isoformat() if v else None


@router.get("/admin/email/overview")
def overview(days: int = 7, db: Session = Depends(get_db), _: User = Depends(require_superuser)):
    days = min(max(days, 1), 90)
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    total = ed.health(db, days=days)
    by_status = dict(db.query(EmailEvent.status, func.count(EmailEvent.id)).filter(EmailEvent.created_at >= cutoff).group_by(EmailEvent.status).all())

    # per-day picture for the chart
    day_rows = (db.query(func.date(EmailEvent.created_at).label("d"), EmailEvent.status, func.count(EmailEvent.id))
                .filter(EmailEvent.created_at >= cutoff).group_by("d", EmailEvent.status).all())
    per_day: dict = {}
    for d, status, n in day_rows:
        k = str(d)
        row = per_day.setdefault(k, {"date": k, "sent": 0, "bounced": 0, "complained": 0})
        if status in ("sent", "delayed", "delivered", "bounced", "complained"):
            row["sent"] += n
        if status == "bounced":
            row["bounced"] += n
        if status == "complained":
            row["complained"] += n

    # stores with the most trouble
    trouble = (db.query(EmailEvent.shop_id, EmailEvent.status, func.count(EmailEvent.id))
               .filter(EmailEvent.created_at >= cutoff, EmailEvent.shop_id.isnot(None), EmailEvent.status.in_(("bounced", "complained")))
               .group_by(EmailEvent.shop_id, EmailEvent.status).all())
    tally: dict = {}
    for sid, status, n in trouble:
        t = tally.setdefault(sid, {"bounced": 0, "complained": 0})
        t[status] += n
    names = {s.id: s.name for s in db.query(Shop.id, Shop.name).filter(Shop.id.in_(list(tally))).all()} if tally else {}
    top = sorted(tally.items(), key=lambda kv: -(kv[1]["bounced"] + kv[1]["complained"] * 5))[:5]

    doms = dict(db.query(EmailDomain.status, func.count(EmailDomain.id)).group_by(EmailDomain.status).all())
    last_hook = db.query(func.max(EmailEvent.updated_at)).filter(EmailEvent.via_webhook == True).scalar()  # noqa: E712
    return {
        "days": days,
        "ses": {
            "api_configured": ed.ses_configured(), "region": ed.SES_REGION,
            "configuration_set": ed.SES_CONFIGURATION_SET or None, "topic_locked": bool(ed.SES_SNS_TOPIC_ARN),
            "last_report_at": _iso(last_hook),
        },
        "totals": {**total, "failed": by_status.get("failed", 0), "suppressed": by_status.get("suppressed", 0), "all": sum(by_status.values())},
        "limits": {"bounce": ed.BOUNCE_LIMIT, "complaint": ed.COMPLAINT_LIMIT, "min_sample": ed.MIN_SAMPLE},
        "per_day": sorted(per_day.values(), key=lambda r: r["date"]),
        "domains": {"total": sum(doms.values()), **{k: doms.get(k, 0) for k in ("verified", "pending", "failed", "suspended")}},
        "paused_shops": db.query(func.count(EmailShopControl.shop_id)).filter(EmailShopControl.paused == True).scalar() or 0,  # noqa: E712
        "suppressed_total": db.query(func.count(EmailSuppression.id)).scalar() or 0,
        "top_problem_shops": [{"shop_id": sid, "name": names.get(sid), **v} for sid, v in top],
    }


@router.get("/admin/email/events")
def events(status: Optional[str] = None, category: Optional[str] = None, shop_id: Optional[int] = None,
           domain: Optional[str] = None, problems: bool = False, q: Optional[str] = None,
           before_id: Optional[int] = None, limit: int = 50,
           db: Session = Depends(get_db), _: User = Depends(require_superuser)):
    limit = min(max(limit, 1), 100)
    query = db.query(EmailEvent)
    if status:
        query = query.filter(EmailEvent.status == status)
    if problems:
        query = query.filter(EmailEvent.status.in_(_PROBLEM + ("suppressed", "blocked")))
    if category:
        query = query.filter(EmailEvent.category == category)
    if shop_id is not None:
        query = query.filter(EmailEvent.shop_id == shop_id)
    if domain:
        query = query.filter(EmailEvent.from_domain == domain.lower())
    if q and q.strip():
        like = _like(q.strip()[:80])
        query = query.filter(or_(EmailEvent.recipient.ilike(like, escape="\\"), EmailEvent.subject.ilike(like, escape="\\"),
                                 EmailEvent.from_address.ilike(like, escape="\\")))
    if before_id:
        query = query.filter(EmailEvent.id < before_id)
    rows = query.order_by(EmailEvent.id.desc()).limit(limit + 1).all()
    more = len(rows) > limit
    rows = rows[:limit]
    names = {s.id: s.name for s in db.query(Shop.id, Shop.name).filter(Shop.id.in_({r.shop_id for r in rows if r.shop_id})).all()} if rows else {}
    return {
        "events": [{
            "id": r.id, "created_at": _iso(r.created_at), "updated_at": _iso(r.updated_at), "status": r.status, "category": r.category,
            "kind": r.kind, "shop_id": r.shop_id, "shop_name": names.get(r.shop_id), "from_address": r.from_address, "from_domain": r.from_domain,
            "recipient": r.recipient, "subject": r.subject, "bounce_type": r.bounce_type, "bounce_subtype": r.bounce_subtype,
            "detail": r.detail, "via_webhook": r.via_webhook,
        } for r in rows],
        "has_more": more, "next_before_id": rows[-1].id if rows and more else None,
    }


@router.get("/admin/email/domains")
def domains(db: Session = Depends(get_db), _: User = Depends(require_superuser)):
    rows = db.query(EmailDomain, Shop.name, Shop.email).join(Shop, Shop.id == EmailDomain.shop_id).order_by(EmailDomain.id.desc()).all()
    paused = {c.shop_id for c in db.query(EmailShopControl).filter(EmailShopControl.paused == True).all()}  # noqa: E712
    out = []
    for d, shop_name, shop_email in rows:
        h = ed.health(db, shop_id=d.shop_id)
        out.append({
            "id": d.id, "shop_id": d.shop_id, "shop_name": shop_name, "shop_email": shop_email, "domain": d.domain,
            "from_address": f"{d.from_local}@{d.domain}", "status": d.status, "dkim_status": d.dkim_status,
            "verified_at": _iso(d.verified_at), "last_checked_at": _iso(d.last_checked_at), "created_at": _iso(d.created_at),
            "suspended_reason": d.suspended_reason, "suspended_by": d.suspended_by, "marketing_paused": d.shop_id in paused, "health": h,
        })
    return {"domains": out}


class ReasonIn(BaseModel):
    reason: Optional[str] = None


def _audit(db: Session, user: User, what: str, shop_id: Optional[int], desc: str) -> None:
    record_audit_event(db, "email_admin_action", actor_user_id=user.id, actor_email=user.email, actor_name=user.full_name,
                       shop_id=shop_id, description=desc, extra={"action": what, "as": "admin"})


@router.post("/admin/email/domains/{domain_id}/suspend")
def suspend(domain_id: int, data: ReasonIn, db: Session = Depends(get_db), admin: User = Depends(require_superuser)):
    dom = db.query(EmailDomain).filter(EmailDomain.id == domain_id).first()
    if not dom:
        raise HTTPException(status_code=404, detail="Domain not found")
    ed.suspend_domain(db, dom, (data.reason or "Stopped by an ExiusCart admin").strip(), "admin")
    _audit(db, admin, "domain_suspended", dom.shop_id, f"Suspended sending domain {dom.domain}")
    return {"ok": True}


@router.post("/admin/email/domains/{domain_id}/resume")
def resume(domain_id: int, db: Session = Depends(get_db), admin: User = Depends(require_superuser)):
    dom = db.query(EmailDomain).filter(EmailDomain.id == domain_id).first()
    if not dom:
        raise HTTPException(status_code=404, detail="Domain not found")
    try:
        ed.resume_domain(db, dom)
    except ed.EmailDomainError as e:
        raise HTTPException(status_code=e.status, detail=e.message)
    _audit(db, admin, "domain_resumed", dom.shop_id, f"Resumed sending domain {dom.domain}")
    return {"ok": True, "status": dom.status}


@router.post("/admin/email/shops/{shop_id}/pause")
def pause(shop_id: int, data: ReasonIn, db: Session = Depends(get_db), admin: User = Depends(require_superuser)):
    if not db.query(Shop.id).filter(Shop.id == shop_id).first():
        raise HTTPException(status_code=404, detail="Shop not found")
    ed.pause_shop(db, shop_id, (data.reason or "Paused by an ExiusCart admin").strip(), "admin")
    _audit(db, admin, "marketing_paused", shop_id, "Paused marketing email for this store")
    return {"ok": True}


@router.post("/admin/email/shops/{shop_id}/resume")
def resume_shop(shop_id: int, db: Session = Depends(get_db), admin: User = Depends(require_superuser)):
    ed.resume_shop(db, shop_id)
    _audit(db, admin, "marketing_resumed", shop_id, "Resumed marketing email for this store")
    return {"ok": True}


@router.get("/admin/email/paused")
def paused(db: Session = Depends(get_db), _: User = Depends(require_superuser)):
    rows = db.query(EmailShopControl, Shop.name).join(Shop, Shop.id == EmailShopControl.shop_id).filter(EmailShopControl.paused == True).all()  # noqa: E712
    return {"shops": [{"shop_id": c.shop_id, "name": n, "reason": c.reason, "source": c.source, "since": _iso(c.updated_at)} for c, n in rows]}


@router.get("/admin/email/suppressions")
def suppressions(q: Optional[str] = None, limit: int = 100, db: Session = Depends(get_db), _: User = Depends(require_superuser)):
    query = db.query(EmailSuppression)
    if q and q.strip():
        query = query.filter(EmailSuppression.email.ilike(_like(q.strip()[:80]), escape="\\"))
    rows = query.order_by(EmailSuppression.id.desc()).limit(min(max(limit, 1), 300)).all()
    return {"suppressions": [{"id": r.id, "email": r.email, "reason": r.reason, "shop_id": r.shop_id, "detail": r.detail, "created_at": _iso(r.created_at)} for r in rows]}


@router.delete("/admin/email/suppressions/{sid}")
def remove_suppression(sid: int, db: Session = Depends(get_db), admin: User = Depends(require_superuser)):
    row = db.query(EmailSuppression).filter(EmailSuppression.id == sid).first()
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    email = row.email
    db.delete(row)
    db.commit()
    _audit(db, admin, "suppression_removed", None, f"Removed {email} from the do-not-mail list")
    return {"ok": True}
