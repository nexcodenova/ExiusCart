"""Admin team: the platform owner builds roles (ticking permissions), invites
people by email, and assigns each a role. See app/core/admin_access.py for how
those permissions are enforced.

Everything that changes the team is OWNER-ONLY (require_superuser) on purpose:
a staff member who could edit roles could hand themselves every permission.
Only /admin/me (what the admin UI needs to draw itself) and the two public
invite-acceptance routes are open to anyone else.
"""
import logging
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from typing import List, Optional

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.api.v1.deps import get_current_user
from app.api.v1.endpoints.admin import require_superuser
from app.core.admin_access import ADMIN_PERMISSION_AREAS, admin_summary, clean_permissions
from app.core.audit_log import record_audit_event
from app.core.config import settings
from app.core.database import get_db
from app.core.email import send_staff_invite_email
from app.core.rate_limit import limiter
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.admin_team import AdminRole, AdminStaff
from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.user import UserResponse

logger = logging.getLogger(__name__)
router = APIRouter()
_email_pool = ThreadPoolExecutor(max_workers=2)

ADMIN_URL = os.getenv("ADMIN_URL", "https://admin.exiuscart.com").rstrip("/")
INVITE_TTL = timedelta(days=7)
MAX_ROLES = 20
MAX_STAFF = 50
PANEL_NAME = "the ExiusCart Admin Panel"
ACTIVITY_EVENTS = ("admin_staff_action", "admin_staff_invited", "admin_staff_accepted", "admin_staff_role_changed",
                   "admin_staff_suspended", "admin_staff_reactivated", "admin_staff_removed")


def _invite_token(member: AdminStaff) -> str:
    return jwt.encode(
        {"purpose": "admin_staff_invite", "staff_id": member.id, "email": member.email,
         "exp": datetime.now(timezone.utc) + INVITE_TTL},
        settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM,
    )


def _send_invite(member: AdminStaff, inviter: User, role: AdminRole) -> None:
    url = f"{ADMIN_URL}/accept-invite?token={_invite_token(member)}"
    _email_pool.submit(send_staff_invite_email, member.email, member.full_name or "", PANEL_NAME,
                       inviter.full_name or "", role.name, url)


def _member_out(m: AdminStaff) -> dict:
    return {
        "id": m.id, "email": m.email, "full_name": m.full_name, "status": m.status,
        "role_id": m.role_id, "role_name": m.role.name if m.role else None,
        "invited_at": m.invited_at.isoformat() if m.invited_at else None,
        "joined_at": m.joined_at.isoformat() if m.joined_at else None,
    }


def _role_out(r: AdminRole, member_count: int = 0) -> dict:
    return {"id": r.id, "name": r.name, "description": r.description,
            "permissions": clean_permissions(r.permissions), "member_count": member_count}


def _audit(db: Session, request: Request, admin: User, event: str, text: str, extra: Optional[dict] = None) -> None:
    record_audit_event(db, event, request=request, actor_user_id=admin.id, actor_email=admin.email,
                       actor_name=admin.full_name, description=text, extra=extra)


# ── What the admin UI needs to know about the person using it ─────────────────

@router.get("/admin/me")
def admin_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Owner or staff: exactly which admin permissions. The admin UI uses this
    to hide menu items and buttons someone can't use (the server enforces it
    regardless - this is only for a tidy UI)."""
    summary = admin_summary(db, current_user)
    if not summary:
        raise HTTPException(status_code=403, detail="This account does not have admin access.")
    return {"email": current_user.email, "full_name": current_user.full_name, **summary}


@router.get("/admin/team/permissions")
def permission_catalog(_: User = Depends(require_superuser)):
    return {"areas": ADMIN_PERMISSION_AREAS}


# ── Roles ─────────────────────────────────────────────────────────────────────

class RoleIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    description: Optional[str] = Field(default=None, max_length=200)
    permissions: List[str] = []


def _name_taken(db: Session, name: str, exclude_id: Optional[int] = None) -> bool:
    q = db.query(AdminRole.id).filter(func.lower(AdminRole.name) == name.lower())
    if exclude_id:
        q = q.filter(AdminRole.id != exclude_id)
    return q.first() is not None


@router.get("/admin/team/roles")
def list_roles(db: Session = Depends(get_db), _: User = Depends(require_superuser)):
    counts = dict(db.query(AdminStaff.role_id, func.count(AdminStaff.id)).group_by(AdminStaff.role_id).all())
    roles = db.query(AdminRole).order_by(AdminRole.id.asc()).all()
    return {"roles": [_role_out(r, counts.get(r.id, 0)) for r in roles]}


@router.post("/admin/team/roles", status_code=201)
def create_role(body: RoleIn, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_superuser)):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Give the role a name.")
    if _name_taken(db, name):
        raise HTTPException(status_code=409, detail="You already have a role with that name.")
    if db.query(func.count(AdminRole.id)).scalar() >= MAX_ROLES:
        raise HTTPException(status_code=400, detail=f"You can have up to {MAX_ROLES} roles.")
    role = AdminRole(name=name, description=(body.description or "").strip() or None,
                     permissions=clean_permissions(body.permissions))
    db.add(role)
    db.commit()
    db.refresh(role)
    _audit(db, request, admin, "admin_staff_role_changed", f"Created admin role \"{role.name}\"", {"role_id": role.id})
    return _role_out(role)


@router.put("/admin/team/roles/{role_id}")
def update_role(role_id: int, body: RoleIn, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_superuser)):
    role = db.query(AdminRole).filter(AdminRole.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Give the role a name.")
    if _name_taken(db, name, exclude_id=role_id):
        raise HTTPException(status_code=409, detail="You already have a role with that name.")
    role.name = name
    role.description = (body.description or "").strip() or None
    role.permissions = clean_permissions(body.permissions)
    db.commit()
    db.refresh(role)
    _audit(db, request, admin, "admin_staff_role_changed", f"Updated admin role \"{role.name}\"", {"role_id": role.id})
    return _role_out(role, db.query(func.count(AdminStaff.id)).filter(AdminStaff.role_id == role.id).scalar() or 0)


@router.delete("/admin/team/roles/{role_id}")
def delete_role(role_id: int, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_superuser)):
    role = db.query(AdminRole).filter(AdminRole.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if db.query(func.count(AdminStaff.id)).filter(AdminStaff.role_id == role_id).scalar():
        raise HTTPException(status_code=400, detail="People are still using this role. Move them to another role first.")
    name = role.name
    db.delete(role)
    db.commit()
    _audit(db, request, admin, "admin_staff_role_changed", f"Deleted admin role \"{name}\"")
    return {"ok": True}


# ── Members ───────────────────────────────────────────────────────────────────

@router.get("/admin/team/members")
def list_members(db: Session = Depends(get_db), admin: User = Depends(require_superuser)):
    members = db.query(AdminStaff).options(joinedload(AdminStaff.role)).order_by(AdminStaff.id.asc()).all()
    return {"owner": {"email": admin.email, "full_name": admin.full_name}, "members": [_member_out(m) for m in members]}


class InviteIn(BaseModel):
    email: EmailStr
    full_name: Optional[str] = Field(default=None, max_length=255)
    role_id: int


@router.post("/admin/team/members", status_code=201)
def invite_member(body: InviteIn, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_superuser)):
    email = body.email.strip().lower()
    role = db.query(AdminRole).filter(AdminRole.id == body.role_id).first()
    if not role:
        raise HTTPException(status_code=422, detail="Pick a role for this person first.")
    if email == (admin.email or "").lower():
        raise HTTPException(status_code=400, detail="You're already the owner.")
    if db.query(AdminStaff.id).filter(func.lower(AdminStaff.email) == email).first():
        raise HTTPException(status_code=409, detail="That person is already on the team (or has a pending invite).")
    existing_owner = db.query(User).filter(func.lower(User.email) == email, User.is_superuser == True).first()  # noqa: E712
    if existing_owner:
        raise HTTPException(status_code=400, detail="That person is already an owner-level admin.")
    if db.query(func.count(AdminStaff.id)).scalar() >= MAX_STAFF:
        raise HTTPException(status_code=400, detail=f"You can have up to {MAX_STAFF} team members.")
    member = AdminStaff(email=email, full_name=(body.full_name or "").strip() or None, role_id=role.id,
                        status="invited", invited_by_user_id=admin.id)
    db.add(member)
    db.commit()
    db.refresh(member)
    _send_invite(member, admin, role)
    _audit(db, request, admin, "admin_staff_invited", f"Invited {email} to the admin team as \"{role.name}\"", {"role_id": role.id})
    member.role = role
    return _member_out(member)


@router.post("/admin/team/members/{member_id}/resend")
def resend_invite(member_id: int, db: Session = Depends(get_db), admin: User = Depends(require_superuser)):
    member = db.query(AdminStaff).options(joinedload(AdminStaff.role)).filter(AdminStaff.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")
    if member.status != "invited":
        raise HTTPException(status_code=400, detail="This person has already joined.")
    _send_invite(member, admin, member.role)
    return {"ok": True}


class MemberUpdateIn(BaseModel):
    role_id: Optional[int] = None
    status: Optional[str] = None   # active | suspended


@router.put("/admin/team/members/{member_id}")
def update_member(member_id: int, body: MemberUpdateIn, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_superuser)):
    member = db.query(AdminStaff).options(joinedload(AdminStaff.role)).filter(AdminStaff.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")
    events = []
    if body.role_id is not None and body.role_id != member.role_id:
        role = db.query(AdminRole).filter(AdminRole.id == body.role_id).first()
        if not role:
            raise HTTPException(status_code=422, detail="That role doesn't exist.")
        events.append(("admin_staff_role_changed", f"Changed {member.email} from \"{member.role.name}\" to \"{role.name}\""))
        member.role_id = role.id
        member.role = role
    if body.status is not None and body.status != member.status:
        if body.status not in ("active", "suspended"):
            raise HTTPException(status_code=422, detail="Status must be active or suspended.")
        if member.status == "invited":
            raise HTTPException(status_code=400, detail="They haven't accepted the invitation yet.")
        member.status = body.status
        events.append(("admin_staff_suspended" if body.status == "suspended" else "admin_staff_reactivated",
                       f"{'Suspended' if body.status == 'suspended' else 'Reactivated'} {member.email}"))
    db.commit()
    for ev, text in events:
        _audit(db, request, admin, ev, text)
    return _member_out(member)


@router.delete("/admin/team/members/{member_id}")
def remove_member(member_id: int, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_superuser)):
    member = db.query(AdminStaff).filter(AdminStaff.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")
    email = member.email
    db.delete(member)
    db.commit()
    _audit(db, request, admin, "admin_staff_removed", f"Removed {email} from the admin team")
    return {"ok": True}


@router.get("/admin/team/activity")
def team_activity(before_id: Optional[int] = None, limit: int = 40, db: Session = Depends(get_db), _: User = Depends(require_superuser)):
    limit = min(max(limit, 1), 100)
    q = db.query(AuditLog).filter(AuditLog.event_type.in_(ACTIVITY_EVENTS))
    if before_id:
        q = q.filter(AuditLog.id < before_id)
    rows = q.order_by(AuditLog.id.desc()).limit(limit + 1).all()
    more = len(rows) > limit
    rows = rows[:limit]
    return {
        "events": [{
            "id": r.id, "event_type": r.event_type, "who": r.actor_name or r.actor_email, "email": r.actor_email,
            "description": r.description, "created_at": r.created_at.isoformat() if r.created_at else None,
        } for r in rows],
        "has_more": more, "next_before_id": rows[-1].id if rows and more else None,
    }


# ── Accepting an invitation (public - the invitee has no session yet) ────────

def _load_invite(token: str, db: Session) -> AdminStaff:
    bad = HTTPException(status_code=400, detail="This invitation link is invalid or has expired. Ask the owner to send a new one.")
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise bad
    if payload.get("purpose") != "admin_staff_invite":
        raise bad
    member = db.query(AdminStaff).options(joinedload(AdminStaff.role)).filter(AdminStaff.id == payload.get("staff_id")).first()
    # The email is signed into the token, so it can't be replayed against a row
    # that was later re-pointed at a different address.
    if not member or member.email != payload.get("email") or member.status != "invited":
        raise bad
    return member


@router.get("/admin-team/invite-info")
def invite_info(token: str, db: Session = Depends(get_db)):
    member = _load_invite(token, db)
    account_exists = db.query(User.id).filter(func.lower(User.email) == member.email).first() is not None
    return {"role_name": member.role.name if member.role else "", "email": member.email,
            "full_name": member.full_name, "account_exists": account_exists}


class AcceptIn(BaseModel):
    token: str
    password: str = Field(min_length=1, max_length=128)
    full_name: Optional[str] = Field(default=None, max_length=255)


@router.post("/admin-team/accept-invite")
@limiter.limit("10/minute")
def accept_invite(request: Request, body: AcceptIn, db: Session = Depends(get_db)):
    member = _load_invite(body.token, db)
    user = db.query(User).filter(func.lower(User.email) == member.email).first()
    if user:
        # They already have an ExiusCart login: prove it's theirs with the
        # existing password instead of silently attaching admin access to
        # whatever account happens to share the address.
        if not verify_password(body.password, user.hashed_password):
            raise HTTPException(status_code=400, detail="You already have an ExiusCart account with this email. Enter its existing password to accept.")
        if not user.is_active:
            raise HTTPException(status_code=403, detail="This account is deactivated.")
    else:
        if len(body.password) < 8:
            raise HTTPException(status_code=422, detail="Choose a password with at least 8 characters.")
        name = (body.full_name or member.full_name or "").strip() or member.email.split("@")[0]
        user = User(email=member.email, full_name=name, hashed_password=get_password_hash(body.password),
                    is_active=True, is_verified=True, is_superuser=False)
        db.add(user)
        db.flush()
    member.user_id = user.id
    member.status = "active"
    member.joined_at = datetime.now(timezone.utc)
    if not member.full_name:
        member.full_name = user.full_name
    db.commit()
    db.refresh(user)
    record_audit_event(db, "admin_staff_accepted", request=request, actor_user_id=user.id, actor_email=user.email,
                       actor_name=user.full_name,
                       description=f"{user.email} joined the admin team as \"{member.role.name if member.role else ''}\"")
    token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer", "user": UserResponse.model_validate(user)}
