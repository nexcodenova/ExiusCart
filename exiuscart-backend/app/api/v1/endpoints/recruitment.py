"""Recruitment endpoints — Job Positions & Applicants."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.models.shop import Shop
from app.models.recruitment import JobPosition, Applicant
from app.api.v1.deps import get_current_user

router = APIRouter()


def _shop(shop_id: int, user: User, db: Session) -> Shop:
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


@router.get("/shops/{shop_id}/recruitment/jobs")
def list_jobs(shop_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    jobs = db.query(JobPosition).filter(JobPosition.shop_id == shop_id).order_by(JobPosition.created_at.desc()).all()
    return [{"id": j.id, "title": j.title, "department": j.department, "employment_type": j.employment_type,
             "location": j.location, "is_remote": j.is_remote, "status": j.status,
             "applicant_count": len(j.applicants), "created_at": j.created_at.isoformat()} for j in jobs]


@router.post("/shops/{shop_id}/recruitment/jobs", status_code=201)
def create_job(shop_id: int, body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    j = JobPosition(shop_id=shop_id, title=body.get("title", "").strip(),
                    department=body.get("department") or None,
                    description=body.get("description") or None,
                    requirements=body.get("requirements") or None,
                    employment_type=body.get("employment_type", "full_time"),
                    location=body.get("location") or None,
                    is_remote=body.get("is_remote", False))
    db.add(j); db.commit(); db.refresh(j)
    return {"id": j.id, "title": j.title, "status": j.status}


@router.put("/shops/{shop_id}/recruitment/jobs/{jid}")
def update_job(shop_id: int, jid: int, body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    j = db.query(JobPosition).filter(JobPosition.id == jid, JobPosition.shop_id == shop_id).first()
    if not j: raise HTTPException(status_code=404, detail="Job not found")
    for f in ("title", "department", "description", "requirements", "employment_type", "location", "is_remote", "status"):
        if f in body: setattr(j, f, body[f])
    db.commit(); return {"id": j.id, "title": j.title, "status": j.status}


@router.delete("/shops/{shop_id}/recruitment/jobs/{jid}", status_code=204)
def delete_job(shop_id: int, jid: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    j = db.query(JobPosition).filter(JobPosition.id == jid, JobPosition.shop_id == shop_id).first()
    if not j: raise HTTPException(status_code=404, detail="Not found")
    db.delete(j); db.commit()


@router.get("/shops/{shop_id}/recruitment/applicants")
def list_applicants(shop_id: int, stage: str = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    q = db.query(Applicant).filter(Applicant.shop_id == shop_id)
    if stage: q = q.filter(Applicant.stage == stage)
    apps = q.order_by(Applicant.applied_at.desc()).all()
    return [{"id": a.id, "full_name": a.full_name, "email": a.email, "phone": a.phone,
             "stage": a.stage, "job_title": a.job_position.title if a.job_position else "—",
             "job_position_id": a.job_position_id, "notes": a.notes,
             "applied_at": a.applied_at.isoformat()} for a in apps]


@router.post("/shops/{shop_id}/recruitment/applicants", status_code=201)
def create_applicant(shop_id: int, body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    a = Applicant(shop_id=shop_id, job_position_id=body["job_position_id"],
                  full_name=body.get("full_name", "").strip(),
                  email=body.get("email") or None, phone=body.get("phone") or None,
                  stage="new", notes=body.get("notes") or None)
    db.add(a); db.commit(); db.refresh(a)
    return {"id": a.id, "full_name": a.full_name, "stage": a.stage}


@router.put("/shops/{shop_id}/recruitment/applicants/{aid}/stage")
def move_stage(shop_id: int, aid: int, body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    a = db.query(Applicant).filter(Applicant.id == aid, Applicant.shop_id == shop_id).first()
    if not a: raise HTTPException(status_code=404, detail="Applicant not found")
    a.stage = body.get("stage", a.stage)
    if "notes" in body: a.notes = body["notes"]
    db.commit(); return {"id": a.id, "stage": a.stage}


@router.delete("/shops/{shop_id}/recruitment/applicants/{aid}", status_code=204)
def delete_applicant(shop_id: int, aid: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    a = db.query(Applicant).filter(Applicant.id == aid, Applicant.shop_id == shop_id).first()
    if not a: raise HTTPException(status_code=404, detail="Not found")
    db.delete(a); db.commit()
