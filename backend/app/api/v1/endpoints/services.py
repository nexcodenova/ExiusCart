"""Services endpoints — Projects, Helpdesk, Appointments."""
from datetime import datetime, timezone, date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.models.shop import Shop
from app.models.services import Project, Task, HelpdeskTicket, Appointment
from app.api.v1.deps import get_current_user

router = APIRouter()


def _shop(shop_id: int, user: User, db: Session) -> Shop:
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


# ── Projects ───────────────────────────────────────────────────────────────────

@router.get("/shops/{shop_id}/projects")
def list_projects(shop_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    projects = db.query(Project).filter(Project.shop_id == shop_id).order_by(Project.created_at.desc()).all()
    return [{
        "id": p.id, "name": p.name, "description": p.description, "status": p.status,
        "deadline": p.deadline.isoformat() if p.deadline else None,
        "task_count": len(p.tasks),
        "done_count": sum(1 for t in p.tasks if t.stage == "done"),
        "created_at": p.created_at.isoformat(),
    } for p in projects]


@router.post("/shops/{shop_id}/projects", status_code=201)
def create_project(shop_id: int, body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    p = Project(shop_id=shop_id, name=body.get("name", "").strip(),
                description=body.get("description") or None,
                deadline=date.fromisoformat(body["deadline"]) if body.get("deadline") else None)
    db.add(p); db.commit(); db.refresh(p)
    return {"id": p.id, "name": p.name, "status": p.status}


@router.put("/shops/{shop_id}/projects/{pid}")
def update_project(shop_id: int, pid: int, body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    p = db.query(Project).filter(Project.id == pid, Project.shop_id == shop_id).first()
    if not p: raise HTTPException(status_code=404, detail="Project not found")
    for f in ("name", "description", "status"):
        if f in body: setattr(p, f, body[f])
    if "deadline" in body and body["deadline"]: p.deadline = date.fromisoformat(body["deadline"])
    db.commit(); return {"id": p.id, "name": p.name, "status": p.status}


@router.delete("/shops/{shop_id}/projects/{pid}", status_code=204)
def delete_project(shop_id: int, pid: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    p = db.query(Project).filter(Project.id == pid, Project.shop_id == shop_id).first()
    if not p: raise HTTPException(status_code=404, detail="Not found")
    db.delete(p); db.commit()


@router.get("/shops/{shop_id}/projects/{pid}/tasks")
def list_tasks(shop_id: int, pid: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    return db.query(Task).filter(Task.project_id == pid, Task.shop_id == shop_id).order_by(Task.created_at).all()


@router.post("/shops/{shop_id}/projects/{pid}/tasks", status_code=201)
def create_task(shop_id: int, pid: int, body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    t = Task(shop_id=shop_id, project_id=pid, title=body.get("title", "").strip(),
             description=body.get("description") or None,
             stage=body.get("stage", "todo"), priority=body.get("priority", "normal"),
             assigned_to=body.get("assigned_to") or None,
             due_date=date.fromisoformat(body["due_date"]) if body.get("due_date") else None)
    db.add(t); db.commit(); db.refresh(t)
    return {"id": t.id, "title": t.title, "stage": t.stage}


@router.put("/shops/{shop_id}/tasks/{tid}")
def update_task(shop_id: int, tid: int, body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    t = db.query(Task).filter(Task.id == tid, Task.shop_id == shop_id).first()
    if not t: raise HTTPException(status_code=404, detail="Task not found")
    for f in ("title", "description", "stage", "priority", "assigned_to"):
        if f in body: setattr(t, f, body[f])
    if "due_date" in body and body["due_date"]: t.due_date = date.fromisoformat(body["due_date"])
    db.commit(); return {"id": t.id, "title": t.title, "stage": t.stage}


@router.delete("/shops/{shop_id}/tasks/{tid}", status_code=204)
def delete_task(shop_id: int, tid: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    t = db.query(Task).filter(Task.id == tid, Task.shop_id == shop_id).first()
    if not t: raise HTTPException(status_code=404, detail="Not found")
    db.delete(t); db.commit()


# ── Helpdesk ───────────────────────────────────────────────────────────────────

def _next_ticket_num(shop_id: int, db: Session) -> str:
    count = db.query(HelpdeskTicket).filter(HelpdeskTicket.shop_id == shop_id).count()
    return f"TKT-{str(count + 1).zfill(4)}"


@router.get("/shops/{shop_id}/helpdesk")
def list_tickets(shop_id: int, status: str = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    q = db.query(HelpdeskTicket).filter(HelpdeskTicket.shop_id == shop_id)
    if status: q = q.filter(HelpdeskTicket.status == status)
    return q.order_by(HelpdeskTicket.created_at.desc()).all()


@router.post("/shops/{shop_id}/helpdesk", status_code=201)
def create_ticket(shop_id: int, body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    t = HelpdeskTicket(
        shop_id=shop_id, ticket_number=_next_ticket_num(shop_id, db),
        subject=body.get("subject", "").strip(),
        description=body.get("description") or None,
        customer_name=body.get("customer_name") or None,
        customer_email=body.get("customer_email") or None,
        customer_phone=body.get("customer_phone") or None,
        priority=body.get("priority", "normal"),
        assigned_to=body.get("assigned_to") or None,
    )
    db.add(t); db.commit(); db.refresh(t)
    return {"id": t.id, "ticket_number": t.ticket_number, "status": t.status}


@router.put("/shops/{shop_id}/helpdesk/{tid}")
def update_ticket(shop_id: int, tid: int, body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    t = db.query(HelpdeskTicket).filter(HelpdeskTicket.id == tid, HelpdeskTicket.shop_id == shop_id).first()
    if not t: raise HTTPException(status_code=404, detail="Ticket not found")
    for f in ("subject", "description", "status", "priority", "assigned_to", "resolution"):
        if f in body: setattr(t, f, body[f])
    if body.get("status") == "resolved" and not t.resolved_at:
        t.resolved_at = datetime.now(timezone.utc)
    db.commit(); return {"id": t.id, "ticket_number": t.ticket_number, "status": t.status}


@router.delete("/shops/{shop_id}/helpdesk/{tid}", status_code=204)
def delete_ticket(shop_id: int, tid: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    t = db.query(HelpdeskTicket).filter(HelpdeskTicket.id == tid, HelpdeskTicket.shop_id == shop_id).first()
    if not t: raise HTTPException(status_code=404, detail="Not found")
    db.delete(t); db.commit()


# ── Appointments ───────────────────────────────────────────────────────────────

@router.get("/shops/{shop_id}/appointments")
def list_appointments(shop_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    return db.query(Appointment).filter(Appointment.shop_id == shop_id).order_by(Appointment.start_datetime).all()


@router.post("/shops/{shop_id}/appointments", status_code=201)
def create_appointment(shop_id: int, body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    a = Appointment(
        shop_id=shop_id, title=body.get("title", "").strip(),
        customer_name=body.get("customer_name") or None,
        customer_phone=body.get("customer_phone") or None,
        customer_email=body.get("customer_email") or None,
        start_datetime=datetime.fromisoformat(body["start_datetime"]),
        end_datetime=datetime.fromisoformat(body["end_datetime"]) if body.get("end_datetime") else None,
        notes=body.get("notes") or None,
        assigned_to=body.get("assigned_to") or None,
    )
    db.add(a); db.commit(); db.refresh(a)
    return {"id": a.id, "title": a.title, "status": a.status}


@router.put("/shops/{shop_id}/appointments/{aid}")
def update_appointment(shop_id: int, aid: int, body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    a = db.query(Appointment).filter(Appointment.id == aid, Appointment.shop_id == shop_id).first()
    if not a: raise HTTPException(status_code=404, detail="Appointment not found")
    for f in ("title", "customer_name", "customer_phone", "customer_email", "notes", "assigned_to", "status"):
        if f in body: setattr(a, f, body[f])
    if "start_datetime" in body: a.start_datetime = datetime.fromisoformat(body["start_datetime"])
    if "end_datetime" in body and body["end_datetime"]: a.end_datetime = datetime.fromisoformat(body["end_datetime"])
    db.commit(); return {"id": a.id, "title": a.title, "status": a.status}


@router.delete("/shops/{shop_id}/appointments/{aid}", status_code=204)
def delete_appointment(shop_id: int, aid: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    a = db.query(Appointment).filter(Appointment.id == aid, Appointment.shop_id == shop_id).first()
    if not a: raise HTTPException(status_code=404, detail="Not found")
    db.delete(a); db.commit()
