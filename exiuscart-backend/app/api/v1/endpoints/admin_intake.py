"""Admin > Prodora > Intake: paste links, review what came in, approve, publish.

Permissions (all owner-passing, staff by role):
  prodora.view     see the queue
  prodora.add      paste links, retry failed imports
  prodora.review   approve and reject
  prodora.analyze  re-run an analysis (may use paid lookups)
  prodora.publish  publish now, and change the schedule
"""
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.admin_access import require_admin_perm
from app.core.audit_log import record_audit_event
from app.core.database import get_db
from app.intel import engine, intake
from app.models.dropship import DropshipProductLink
from app.models.intake import IntakeItem
from app.models.product import Product
from app.models.user import User

router = APIRouter()

STATUSES = ("queued", "importing", "analyzing", "ready", "failed", "approved", "rejected", "published")
_IN_FLIGHT = ("queued", "importing", "analyzing")


def _item_out(it: IntakeItem, p: Optional[Product], link: Optional[DropshipProductLink]) -> dict:
    return {
        "id": it.id, "batch_id": it.batch_id, "status": it.status, "error": it.error, "source_url": it.source_url,
        "supplier": it.supplier_type, "verdict": it.verdict, "confidence": it.confidence, "margin_pct": it.margin_pct,
        "competitor_count": it.competitor_count, "reject_reason": it.reject_reason,
        "created_at": it.created_at.isoformat() if it.created_at else None,
        "approved_at": it.approved_at.isoformat() if it.approved_at else None,
        "published_at": it.published_at.isoformat() if it.published_at else None,
        "product": None if not p else {
            "id": p.id, "code": p.prodora_code, "name": p.name, "image_url": p.image_url, "price": float(p.price),
            "cost_price": float(p.cost_price) if p.cost_price is not None else None,
            "shipping_cost": float(p.shipping_cost) if p.shipping_cost is not None else None,
            "supplier_name": p.supplier_name,
        },
    }


def _audit(db: Session, user: User, event: str, text: str, extra: Optional[dict] = None) -> None:
    record_audit_event(db, event, actor_user_id=user.id, actor_email=user.email, actor_name=user.full_name, description=text, extra=extra)


# ── Reading the queue ────────────────────────────────────────────────────────

@router.get("/admin/intake/summary")
def summary(db: Session = Depends(get_db), _: User = Depends(require_admin_perm("prodora.view"))):
    counts = dict(db.query(IntakeItem.status, func.count(IntakeItem.id)).group_by(IntakeItem.status).all())
    s = intake.get_settings(db)
    today = intake.published_today(db)
    verdicts = dict(db.query(IntakeItem.verdict, func.count(IntakeItem.id)).filter(IntakeItem.status == "ready").group_by(IntakeItem.verdict).all())
    return {
        "counts": {k: counts.get(k, 0) for k in STATUSES},
        "processing": sum(counts.get(k, 0) for k in _IN_FLIGHT),
        "ready_verdicts": {"TEST": verdicts.get("TEST", 0), "WATCH": verdicts.get("WATCH", 0), "AVOID": verdicts.get("AVOID", 0), "none": verdicts.get(None, 0)},
        "published_today": today, "daily_limit": s.daily_publish_limit,
        "remaining_today": max(0, s.daily_publish_limit - today),
        "settings": {"daily_publish_limit": s.daily_publish_limit, "publish_hour_utc": s.publish_hour_utc,
                     "auto_publish_enabled": s.auto_publish_enabled, "auto_analyze": s.auto_analyze},
        "paid_usage": engine.paid_usage(db),
    }


@router.get("/admin/intake/items")
def list_items(status: Optional[str] = None, verdict: Optional[str] = None, q: Optional[str] = None,
               batch_id: Optional[str] = None, offset: int = 0, limit: int = 50,
               db: Session = Depends(get_db), _: User = Depends(require_admin_perm("prodora.view"))):
    limit = min(max(limit, 1), 100)
    query = db.query(IntakeItem)
    if status and status != "all":
        if status not in STATUSES:
            raise HTTPException(status_code=422, detail="Unknown status.")
        query = query.filter(IntakeItem.status == status)
    if verdict:
        query = query.filter(IntakeItem.verdict.is_(None)) if verdict == "none" else query.filter(IntakeItem.verdict == verdict.upper())
    if batch_id:
        query = query.filter(IntakeItem.batch_id == batch_id)
    if q and q.strip():
        like = "%" + q.strip()[:80].replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        ids = [i for (i,) in db.query(Product.id).filter(Product.name.ilike(like, escape="\\")).limit(500).all()]
        query = query.filter((IntakeItem.product_id.in_(ids)) | (IntakeItem.source_url.ilike(like, escape="\\")))
    total = query.count()
    # Best verdicts first, then newest, so the reviewer starts with the strongest candidates.
    from sqlalchemy import case
    rank = case((IntakeItem.verdict == "TEST", 0), (IntakeItem.verdict == "WATCH", 1), (IntakeItem.verdict == "AVOID", 3), else_=2)
    rows = query.order_by(rank.asc(), IntakeItem.id.desc()).offset(max(offset, 0)).limit(limit).all()
    pids = [r.product_id for r in rows if r.product_id]
    products = {p.id: p for p in db.query(Product).filter(Product.id.in_(pids)).all()} if pids else {}
    return {"total": total, "items": [_item_out(r, products.get(r.product_id), None) for r in rows]}


# ── Adding ───────────────────────────────────────────────────────────────────

class LinksIn(BaseModel):
    text: str = Field(min_length=1, max_length=60000)


@router.post("/admin/intake/links", status_code=201)
def add_links(body: LinksIn, db: Session = Depends(get_db), user: User = Depends(require_admin_perm("prodora.add"))):
    parsed = intake.parse_links(body.text)
    if not parsed:
        raise HTTPException(status_code=422, detail="Paste at least one product link.")
    out = intake.create_items(db, parsed, user.id)
    intake.submit(out["item_ids"])
    return {"batch_id": out["batch_id"], "counts": out["counts"], "results": out["results"]}


class PidsIn(BaseModel):
    cj_pids: List[str] = Field(min_length=1, max_length=100)


@router.post("/admin/intake/cj-pids", status_code=201)
def add_cj_pids(body: PidsIn, db: Session = Depends(get_db), user: User = Depends(require_admin_perm("prodora.add"))):
    """From the CJ finder: queue the chosen CJ products."""
    out = intake.create_items(db, intake.cj_links_from_pids(body.cj_pids), user.id)
    intake.submit(out["item_ids"])
    return {"batch_id": out["batch_id"], "counts": out["counts"], "results": out["results"]}


# ── Deciding ─────────────────────────────────────────────────────────────────

class BulkIn(BaseModel):
    ids: List[int] = Field(min_length=1, max_length=200)
    action: str                       # approve | reject | retry | delete
    reason: Optional[str] = Field(default=None, max_length=300)


_ACTION_PERM = {"approve": "prodora.review", "reject": "prodora.review", "retry": "prodora.add", "delete": "prodora.review"}


@router.post("/admin/intake/bulk")
def bulk_action(body: BulkIn, db: Session = Depends(get_db), user: User = Depends(require_admin_perm("prodora.view"))):
    if body.action not in _ACTION_PERM:
        raise HTTPException(status_code=422, detail="Unknown action.")
    # The gate depends on the action, so check the permission here (the dependency above only proves the person is admin).
    from app.core.admin_access import staff_record, expand
    if not user.is_superuser:
        rec = staff_record(db, user)
        if not rec or _ACTION_PERM[body.action] not in expand(rec.role.permissions if rec.role else []):
            raise HTTPException(status_code=403, detail="You don't have permission to do that.")
    items = db.query(IntakeItem).filter(IntakeItem.id.in_(body.ids)).all()
    done, skipped = [], []
    requeued: List[int] = []
    for it in items:
        try:
            if body.action == "approve":
                intake.approve(db, it, user.id)
            elif body.action == "reject":
                intake.reject(db, it, user.id, body.reason)
            elif body.action == "retry":
                intake.retry(db, it)
                requeued.append(it.id)
            elif body.action == "delete":
                if it.status not in ("failed", "rejected"):
                    raise intake.IntakeError("Only failed or rejected items can be cleared.")
                db.delete(it)
            done.append(it.id)
        except intake.IntakeError as e:
            skipped.append({"id": it.id, "reason": str(e)})
    db.commit()
    if requeued:
        intake.submit(requeued)
    if not user.is_superuser and done:
        _audit(db, user, "admin_staff_action", f"Intake {body.action}: {len(done)} item(s)", {"action": body.action, "count": len(done)})
    return {"done": done, "skipped": skipped}


class AnalyzeIn(BaseModel):
    use_paid: bool = False


@router.post("/admin/intake/items/{item_id}/analyze")
def reanalyze(item_id: int, body: AnalyzeIn, db: Session = Depends(get_db), user: User = Depends(require_admin_perm("prodora.analyze"))):
    """Re-run the analysis for one queued product, optionally adding the paid
    Amazon and Walmart lookups. The queue's verdict updates with it."""
    it = db.query(IntakeItem).filter(IntakeItem.id == item_id).first()
    p = db.query(Product).filter(Product.id == it.product_id).first() if it and it.product_id else None
    if not it or not p:
        raise HTTPException(status_code=404, detail="That product is not in the queue any more.")
    try:
        out = engine.analyze(db, p, market="US", target_margin_pct=30.0, use_paid=body.use_paid, force=body.use_paid, user_id=user.id)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return {"verdict": out["evaluation"]["verdict"], "confidence": out["evaluation"]["confidence"], "paid_usage": engine.paid_usage(db)}


# ── Publishing and the schedule ──────────────────────────────────────────────

class PublishIn(BaseModel):
    count: Optional[int] = Field(default=None, ge=1, le=500)


@router.post("/admin/intake/publish-now")
def publish_now(body: PublishIn, db: Session = Depends(get_db), user: User = Depends(require_admin_perm("prodora.publish"))):
    """Publish approved products right now: the given number, or what is left of
    today's daily limit."""
    ids = intake.publish_due(db, count=body.count, user_id=user.id)
    if not user.is_superuser and ids:
        _audit(db, user, "admin_staff_action", f"Published {len(ids)} product(s) from the intake queue", {"count": len(ids)})
    return {"published": len(ids), "remaining_today": max(0, intake.get_settings(db).daily_publish_limit - intake.published_today(db))}


class SettingsIn(BaseModel):
    daily_publish_limit: int = Field(ge=0, le=1000)
    publish_hour_utc: int = Field(ge=0, le=23)
    auto_publish_enabled: bool
    auto_analyze: bool


@router.put("/admin/intake/settings")
def update_settings(body: SettingsIn, db: Session = Depends(get_db), user: User = Depends(require_admin_perm("prodora.publish"))):
    s = intake.get_settings(db)
    s.daily_publish_limit, s.publish_hour_utc = body.daily_publish_limit, body.publish_hour_utc
    s.auto_publish_enabled, s.auto_analyze, s.updated_by_user_id = body.auto_publish_enabled, body.auto_analyze, user.id
    db.commit()
    _audit(db, user, "intake_settings_changed",
           f"Intake schedule: {s.daily_publish_limit}/day at {s.publish_hour_utc:02d}:00 UTC, auto-publish {'on' if s.auto_publish_enabled else 'off'}")
    return {"ok": True}
