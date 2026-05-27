"""HR & Payroll endpoints."""
from datetime import datetime, timezone, date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.models.user import User
from app.models.shop import Shop
from app.models.hr import Employee, PayrollRecord, LeaveRequest
from app.api.v1.deps import get_current_user

router = APIRouter()


def _shop(shop_id: int, user: User, db: Session) -> Shop:
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


def _emp_out(e: Employee) -> dict:
    return {
        "id": e.id, "full_name": e.full_name, "position": e.position,
        "department": e.department, "email": e.email, "phone": e.phone,
        "join_date": e.join_date.isoformat() if e.join_date else None,
        "basic_salary": float(e.basic_salary or 0),
        "allowances": float(e.allowances or 0),
        "currency": e.currency, "employment_type": e.employment_type,
        "status": e.status,
    }


# ── Employees ──────────────────────────────────────────────────────────────────

@router.get("/shops/{shop_id}/employees")
def list_employees(shop_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    emps = db.query(Employee).filter(Employee.shop_id == shop_id).order_by(Employee.full_name).all()
    return [_emp_out(e) for e in emps]


@router.post("/shops/{shop_id}/employees", status_code=201)
def create_employee(shop_id: int, body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    join_date = None
    if body.get("join_date"):
        try:
            join_date = date.fromisoformat(body["join_date"])
        except ValueError:
            pass
    emp = Employee(
        shop_id=shop_id,
        full_name=body.get("full_name", "").strip(),
        position=body.get("position") or None,
        department=body.get("department") or None,
        email=body.get("email") or None,
        phone=body.get("phone") or None,
        national_id=body.get("national_id") or None,
        join_date=join_date,
        basic_salary=float(body.get("basic_salary", 0)),
        allowances=float(body.get("allowances", 0)),
        employment_type=body.get("employment_type", "full_time"),
        status="active",
    )
    db.add(emp)
    db.commit()
    db.refresh(emp)
    return _emp_out(emp)


@router.put("/shops/{shop_id}/employees/{emp_id}")
def update_employee(shop_id: int, emp_id: int, body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    emp = db.query(Employee).filter(Employee.id == emp_id, Employee.shop_id == shop_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    for field in ("full_name","position","department","email","phone","employment_type","status","notes"):
        if field in body:
            setattr(emp, field, body[field] or None)
    if "basic_salary" in body:
        emp.basic_salary = float(body["basic_salary"])
    if "allowances" in body:
        emp.allowances = float(body["allowances"])
    if "join_date" in body and body["join_date"]:
        try:
            emp.join_date = date.fromisoformat(body["join_date"])
        except ValueError:
            pass
    db.commit()
    return _emp_out(emp)


@router.delete("/shops/{shop_id}/employees/{emp_id}", status_code=204)
def delete_employee(shop_id: int, emp_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    emp = db.query(Employee).filter(Employee.id == emp_id, Employee.shop_id == shop_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    emp.status = "terminated"
    db.commit()


# ── Payroll ────────────────────────────────────────────────────────────────────

@router.get("/shops/{shop_id}/payroll")
def list_payroll(shop_id: int, month: Optional[str] = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    q = db.query(PayrollRecord).filter(PayrollRecord.shop_id == shop_id)
    if month:
        q = q.filter(PayrollRecord.month == month)
    records = q.order_by(PayrollRecord.month.desc()).all()
    return [
        {
            "id": r.id, "month": r.month, "employee_id": r.employee_id,
            "employee_name": r.employee.full_name if r.employee else "—",
            "basic_salary": float(r.basic_salary), "allowances": float(r.allowances),
            "deductions": float(r.deductions), "bonus": float(r.bonus),
            "net_salary": float(r.net_salary), "status": r.status,
            "paid_at": r.paid_at.isoformat() if r.paid_at else None,
        }
        for r in records
    ]


@router.post("/shops/{shop_id}/payroll/run", status_code=201)
def run_payroll(shop_id: int, body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Generate payroll records for all active employees for a given month."""
    _shop(shop_id, current_user, db)
    month = body.get("month", datetime.now(timezone.utc).strftime("%Y-%m"))
    employees = db.query(Employee).filter(Employee.shop_id == shop_id, Employee.status == "active").all()
    created = []
    for emp in employees:
        existing = db.query(PayrollRecord).filter(
            PayrollRecord.employee_id == emp.id,
            PayrollRecord.month == month,
        ).first()
        if existing:
            continue
        deductions = float(body.get("deductions", {}).get(str(emp.id), 0))
        bonus      = float(body.get("bonuses",    {}).get(str(emp.id), 0))
        net = float(emp.basic_salary) + float(emp.allowances) + bonus - deductions
        record = PayrollRecord(
            shop_id=shop_id, employee_id=emp.id, month=month,
            basic_salary=emp.basic_salary, allowances=emp.allowances,
            deductions=deductions, bonus=bonus, net_salary=net,
            currency=emp.currency, status="draft",
        )
        db.add(record)
        created.append(emp.full_name)
    db.commit()
    return {"message": f"Payroll generated for {len(created)} employees", "month": month, "employees": created}


@router.put("/shops/{shop_id}/payroll/{record_id}/pay")
def mark_payroll_paid(shop_id: int, record_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    record = db.query(PayrollRecord).filter(PayrollRecord.id == record_id, PayrollRecord.shop_id == shop_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    record.status = "paid"
    record.paid_at = datetime.now(timezone.utc)
    db.commit()
    return {"id": record.id, "status": record.status}


# ── Leave Requests ─────────────────────────────────────────────────────────────

@router.get("/shops/{shop_id}/leaves")
def list_leaves(shop_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    leaves = db.query(LeaveRequest).filter(LeaveRequest.shop_id == shop_id).order_by(LeaveRequest.created_at.desc()).all()
    return [
        {
            "id": l.id, "employee_id": l.employee_id,
            "employee_name": l.employee.full_name if l.employee else "—",
            "leave_type": l.leave_type,
            "start_date": l.start_date.isoformat(),
            "end_date": l.end_date.isoformat(),
            "days": l.days, "reason": l.reason, "status": l.status,
            "created_at": l.created_at.isoformat(),
        }
        for l in leaves
    ]


@router.post("/shops/{shop_id}/leaves", status_code=201)
def create_leave(shop_id: int, body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    start = date.fromisoformat(body["start_date"])
    end   = date.fromisoformat(body["end_date"])
    days  = (end - start).days + 1
    leave = LeaveRequest(
        shop_id=shop_id,
        employee_id=body["employee_id"],
        leave_type=body.get("leave_type", "annual"),
        start_date=start, end_date=end, days=days,
        reason=body.get("reason") or None,
        status="pending",
    )
    db.add(leave)
    db.commit()
    db.refresh(leave)
    return {"id": leave.id, "days": leave.days, "status": leave.status}


@router.put("/shops/{shop_id}/leaves/{leave_id}/status")
def update_leave_status(shop_id: int, leave_id: int, body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    leave = db.query(LeaveRequest).filter(LeaveRequest.id == leave_id, LeaveRequest.shop_id == shop_id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")
    leave.status = body.get("status", leave.status)
    db.commit()
    return {"id": leave.id, "status": leave.status}
