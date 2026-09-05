"""
Customer testimonials shown on exiuscart.com's homepage.

Two ways a row gets created: an admin adds one directly (already-approved,
for testimonials you already have in writing — e.g. from a real
conversation), or a customer submits one through the public /review page
(unapproved until an admin reviews it). Either way, the public homepage
only ever sees is_approved=True rows — there's no way for an unreviewed
submission to reach the live site on its own.
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.rate_limit import limiter
from app.models.testimonial import Testimonial
from app.models.user import User
from app.api.v1.deps import get_current_user
from app.api.v1.endpoints.admin import require_superuser

logger = logging.getLogger(__name__)
router = APIRouter()


def _testimonial_out(t: Testimonial) -> dict:
    return {
        "id": t.id,
        "company_name": t.company_name,
        "subtitle": t.subtitle,
        "quote_text": t.quote_text,
        "rating": t.rating,
        "reviewer_name": t.reviewer_name,
        "is_approved": t.is_approved,
        "source": t.source,
        "sort_order": t.sort_order,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


# ── Public — homepage fetch + submission form ───────────────────────────────

@router.get("/public/testimonials")
def public_list_testimonials(db: Session = Depends(get_db)):
    rows = (
        db.query(Testimonial)
        .filter(Testimonial.is_approved == True)
        .order_by(Testimonial.sort_order.asc(), Testimonial.created_at.desc())
        .all()
    )
    return {"testimonials": [_testimonial_out(t) for t in rows]}


class TestimonialSubmitIn(BaseModel):
    company_name: str
    subtitle: Optional[str] = None
    quote_text: str
    rating: int = 5
    reviewer_name: Optional[str] = None
    submitter_email: Optional[EmailStr] = None


@router.post("/public/testimonials/submit", status_code=201)
@limiter.limit("5/hour")
def public_submit_testimonial(request: Request, data: TestimonialSubmitIn, db: Session = Depends(get_db)):
    if not data.company_name.strip() or not data.quote_text.strip():
        raise HTTPException(status_code=422, detail="Company name and review text are required.")
    t = Testimonial(
        company_name=data.company_name.strip()[:200],
        subtitle=(data.subtitle or "").strip()[:300] or None,
        quote_text=data.quote_text.strip(),
        rating=min(max(data.rating, 1), 5),
        reviewer_name=(data.reviewer_name or "").strip()[:200] or None,
        submitter_email=data.submitter_email,
        is_approved=False,
        source="public",
    )
    db.add(t)
    db.commit()
    return {"message": "Thanks — your review is submitted and will appear once approved."}


# ── Admin — review, approve, manage ──────────────────────────────────────────

@router.get("/admin/testimonials")
def admin_list_testimonials(
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    rows = db.query(Testimonial).order_by(Testimonial.is_approved.asc(), Testimonial.created_at.desc()).all()
    return {"testimonials": [_testimonial_out(t) for t in rows]}


class TestimonialAdminIn(BaseModel):
    company_name: str
    subtitle: Optional[str] = None
    quote_text: str
    rating: int = 5
    reviewer_name: Optional[str] = None
    sort_order: int = 0


@router.post("/admin/testimonials", status_code=201)
def admin_create_testimonial(
    data: TestimonialAdminIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    # Admin-added rows go live immediately — no approval step needed for
    # something the admin is typing in directly.
    t = Testimonial(
        company_name=data.company_name.strip()[:200],
        subtitle=(data.subtitle or "").strip()[:300] or None,
        quote_text=data.quote_text.strip(),
        rating=min(max(data.rating, 1), 5),
        reviewer_name=(data.reviewer_name or "").strip()[:200] or None,
        is_approved=True,
        source="admin",
        sort_order=data.sort_order,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return _testimonial_out(t)


class TestimonialUpdateIn(BaseModel):
    company_name: Optional[str] = None
    subtitle: Optional[str] = None
    quote_text: Optional[str] = None
    rating: Optional[int] = None
    reviewer_name: Optional[str] = None
    is_approved: Optional[bool] = None
    sort_order: Optional[int] = None


@router.put("/admin/testimonials/{testimonial_id}")
def admin_update_testimonial(
    testimonial_id: int,
    data: TestimonialUpdateIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    t = db.query(Testimonial).filter(Testimonial.id == testimonial_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Testimonial not found")
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(t, field, value)
    db.commit()
    db.refresh(t)
    return _testimonial_out(t)


@router.delete("/admin/testimonials/{testimonial_id}")
def admin_delete_testimonial(
    testimonial_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    t = db.query(Testimonial).filter(Testimonial.id == testimonial_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Testimonial not found")
    db.delete(t)
    db.commit()
    return {"deleted": True}
