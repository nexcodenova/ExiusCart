"""Attendance endpoints."""
from datetime import datetime, timezone, date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.models.shop import Shop
from app.models.attendance import AttendanceRecord
from app.models.hr import Employee
from app.api.v1.deps import get_current_user

router = APIRouter()


def _shop(shop_id: int, user: User, db: Session) -> Shop:
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


def _out(r: AttendanceRecord):
    hours = None
    if r.check_in and r.check_out:
        diff = (r.check_out - r.check_in).total_seconds() / 3600
        hours = round(diff, 2)
    return {
        "id": r.id, "employee_id": r.employee_id,
        "employee_name": r.employee.full_name if r.employee else "—",
        "date": r.date.isoformat(), "status": r.status,
        "check_in": r.check_in.isoformat() if r.check_in else None,
        "check_out": r.check_out.isoformat() if r.check_out else None,
        "hours_worked": float(r.hours_worked) if r.hours_worked else hours,
        "notes": r.notes,
    }


@router.get("/shops/{shop_id}/attendance")
def list_attendance(shop_id: int, month: Optional[str] = None,
                    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    q = db.query(AttendanceRecord).filter(AttendanceRecord.shop_id == shop_id)
    if month:
        year, m = map(int, month.split("-"))
        q = q.filter(
            AttendanceRecord.date >= date(year, m, 1),
            AttendanceRecord.date < date(year, m + 1 if m < 12 else 1, 1) if m < 12 else date(year + 1, 1, 1)
        )
    records = q.order_by(AttendanceRecord.date.desc()).all()
    return [_out(r) for r in records]


@router.post("/shops/{shop_id}/attendance", status_code=201)
def create_attendance(shop_id: int, body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    rec_date = date.fromisoformat(body["date"])
    existing = db.query(AttendanceRecord).filter(
        AttendanceRecord.employee_id == body["employee_id"],
        AttendanceRecord.date == rec_date
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Attendance already recorded for this date")
    check_in = datetime.fromisoformat(body["check_in"]) if body.get("check_in") else None
    check_out = datetime.fromisoformat(body["check_out"]) if body.get("check_out") else None
    hours = None
    if check_in and check_out:
        hours = round((check_out - check_in).total_seconds() / 3600, 2)
    r = AttendanceRecord(
        shop_id=shop_id,
        employee_id=body["employee_id"],
        date=rec_date,
        check_in=check_in, check_out=check_out,
        hours_worked=hours,
        status=body.get("status", "present"),
        notes=body.get("notes") or None,
    )
    db.add(r); db.commit(); db.refresh(r)
    return _out(r)


@router.put("/shops/{shop_id}/attendance/{rid}")
def update_attendance(shop_id: int, rid: int, body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    r = db.query(AttendanceRecord).filter(AttendanceRecord.id == rid, AttendanceRecord.shop_id == shop_id).first()
    if not r: raise HTTPException(status_code=404, detail="Record not found")
    if "check_in" in body: r.check_in = datetime.fromisoformat(body["check_in"]) if body["check_in"] else None
    if "check_out" in body: r.check_out = datetime.fromisoformat(body["check_out"]) if body["check_out"] else None
    if r.check_in and r.check_out:
        r.hours_worked = round((r.check_out - r.check_in).total_seconds() / 3600, 2)
    if "status" in body: r.status = body["status"]
    if "notes" in body: r.notes = body["notes"]
    db.commit()
    return _out(r)


@router.delete("/shops/{shop_id}/attendance/{rid}", status_code=204)
def delete_attendance(shop_id: int, rid: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    r = db.query(AttendanceRecord).filter(AttendanceRecord.id == rid, AttendanceRecord.shop_id == shop_id).first()
    if not r: raise HTTPException(status_code=404, detail="Not found")
    db.delete(r); db.commit()
