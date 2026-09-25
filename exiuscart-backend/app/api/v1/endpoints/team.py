"""Store team: the owner builds their own roles (ticking permissions), invites
people by email, and assigns each a role. See app/core/shop_access.py for how
those permissions are then enforced on every request.

Everything under /shops/{shop_id}/team is OWNER-ONLY on purpose (the access
gate 403s staff there because "team" is not a mapped area) - a staff member
who could edit roles could hand themselves every permission.
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

from app.api.v1.deps import get_current_user, _is_subscription_expired
from app.core.audit_log import record_audit_event
from app.core.config import settings
from app.core.database import get_db
from app.core.email import send_staff_invite_email
from app.core.rate_limit import limiter
from app.core.security import create_access_token, get_password_hash, verify_password
from app.core.shop_access import PERMISSION_AREAS, access_summary, clean_permissions, find_staff_shop
from app.models.shop import Shop
from app.models.shop_staff import ShopRole, ShopStaff
from app.models.user import User
from app.schemas.user import UserResponse

logger = logging.getLogger(__name__)
router = APIRouter()
_email_pool = ThreadPoolExecutor(max_workers=2)

STORE_URL = os.getenv("STORE_URL", "https://store.exiuscart.com").rstrip("/")
INVITE_TTL = timedelta(days=7)
MAX_ROLES_PER_SHOP = 20
MAX_STAFF_PER_SHOP = 50


def _owner_shop(shop_id: int, user: User, db: Session) -> Shop:
    """Owner only - deliberately NOT get_shop_for_member (that admits staff)."""
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


def _invite_token(member: ShopStaff) -> str:
    return jwt.encode(
        {"purpose": "staff_invite", "staff_id": member.id, "email": member.email,
         "exp": datetime.now(timezone.utc) + INVITE_TTL},
        settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM,
    )


def _send_invite(member: ShopStaff, shop: Shop, inviter: User, role: ShopRole) -> None:
    url = f"{STORE_URL}/accept-invite?token={_invite_token(member)}"
    _email_pool.submit(
        send_staff_invite_email, member.email, member.full_name or "", shop.name,
        inviter.full_name or "", role.name, url,
    )


def _member_out(m: ShopStaff) -> dict:
    return {
        "id": m.id, "email": m.email, "full_name": m.full_name, "status": m.status,
        "role_id": m.role_id, "role_name": m.role.name if m.role else None,
        "invited_at": m.invited_at.isoformat() if m.invited_at else None,
        "joined_at": m.joined_at.isoformat() if m.joined_at else None,
    }


def _role_out(r: ShopRole, member_count: int = 0) -> dict:
    return {
        "id": r.id, "name": r.name, "description": r.description,
        "permissions": clean_permissions(r.permissions), "member_count": member_count,
    }


def _plan_summary(shop_id: int, db: Session) -> dict:
    """Just enough of the shop's plan for the dashboard menu to know which
    sections are locked behind Growth/Scale. Staff can't read the
    subscription endpoint (billing is owner-only), and without this they'd
    see every premium section as locked - so they get this small, non-
    financial slice instead: no amounts, no payment history."""
    from app.api.v1.endpoints.shops import PLAN_CATALOGUE
    from app.core.thedersi import is_thedersi_shop
    from app.models.subscription import Subscription
    sub = db.query(Subscription).filter(
        Subscription.shop_id == shop_id,
        Subscription.status.in_(["active", "trial", "trial_dollar", "pending_approval"]),
    ).order_by(Subscription.created_at.desc()).first()
    if not sub:
        sub = db.query(Subscription).filter(Subscription.shop_id == shop_id).order_by(Subscription.created_at.desc()).first()
    if not sub:
        return {"type": "free_trial", "label": "Free Trial", "days_left": None, "is_thedersi": False}
    days_left = None
    if sub.expires_at:
        exp = sub.expires_at if sub.expires_at.tzinfo else sub.expires_at.replace(tzinfo=timezone.utc)
        days_left = (exp - datetime.now(timezone.utc)).days
    return {
        "type": sub.plan_type,
        "label": PLAN_CATALOGUE.get(sub.plan_type, {}).get("name") or sub.plan_type,
        "days_left": days_left,
        "is_thedersi": bool(is_thedersi_shop(shop_id, db)),
    }


# ── What the dashboard needs to know about the person using it ────────────────

@router.get("/shops/me/access")
def my_access(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Owner or staff: which shop, and exactly which permissions. The store
    dashboard uses this to hide menu items and buttons someone can't use
    (the server enforces it regardless - this is only for a tidy UI)."""
    shop = db.query(Shop).filter(Shop.owner_id == current_user.id, Shop.is_active == True).order_by(Shop.id.asc()).first()  # noqa: E712
    if not shop:
        shop = find_staff_shop(db, current_user)
    if not shop:
        raise HTTPException(status_code=404, detail="No shop found")
    summary = access_summary(db, shop.id, current_user)
    if not summary:
        raise HTTPException(status_code=403, detail="You don't have access to this store.")
    # Only meaningful for staff (an owner with a lapsed plan is sent to Billing
    # by the existing flow); lets the dashboard show "ask the owner" instead.
    plan_expired = (not summary["is_owner"]) and _is_subscription_expired(shop.id, db)
    return {"shop_id": shop.id, "shop_name": shop.name, "plan_expired": plan_expired,
            "plan": _plan_summary(shop.id, db), **summary}


# ── Permission catalog ────────────────────────────────────────────────────────

@router.get("/shops/{shop_id}/team/permissions")
def permission_catalog(shop_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _owner_shop(shop_id, current_user, db)
    return {"areas": PERMISSION_AREAS}


# ── Roles (built by the owner) ────────────────────────────────────────────────

class RoleIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    description: Optional[str] = Field(default=None, max_length=200)
    permissions: List[str] = []


def _name_taken(db: Session, shop_id: int, name: str, exclude_id: Optional[int] = None) -> bool:
    q = db.query(ShopRole.id).filter(ShopRole.shop_id == shop_id, func.lower(ShopRole.name) == name.lower())
    if exclude_id:
        q = q.filter(ShopRole.id != exclude_id)
    return q.first() is not None


@router.get("/shops/{shop_id}/team/roles")
def list_roles(shop_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _owner_shop(shop_id, current_user, db)
    roles = db.query(ShopRole).filter(ShopRole.shop_id == shop_id).order_by(ShopRole.name.asc()).all()
    counts = dict(
        db.query(ShopStaff.role_id, func.count(ShopStaff.id)).filter(ShopStaff.shop_id == shop_id).group_by(ShopStaff.role_id).all()
    )
    return {"roles": [_role_out(r, counts.get(r.id, 0)) for r in roles]}


@router.post("/shops/{shop_id}/team/roles", status_code=201)
def create_role(shop_id: int, body: RoleIn, request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _owner_shop(shop_id, current_user, db)
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Give the role a name.")
    if _name_taken(db, shop_id, name):
        raise HTTPException(status_code=409, detail="You already have a role with that name.")
    if db.query(func.count(ShopRole.id)).filter(ShopRole.shop_id == shop_id).scalar() >= MAX_ROLES_PER_SHOP:
        raise HTTPException(status_code=400, detail=f"You can have up to {MAX_ROLES_PER_SHOP} roles.")
    role = ShopRole(shop_id=shop_id, name=name, description=(body.description or "").strip() or None,
                    permissions=clean_permissions(body.permissions))
    db.add(role)
    db.commit()
    db.refresh(role)
    record_audit_event(db, "role_created", request=request, actor_user_id=current_user.id,
                       actor_email=current_user.email, actor_name=current_user.full_name, shop_id=shop_id,
                       description=f"Created role \"{role.name}\"", extra={"permissions": role.permissions})
    return _role_out(role)


@router.put("/shops/{shop_id}/team/roles/{role_id}")
def update_role(shop_id: int, role_id: int, body: RoleIn, request: Request,
                current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _owner_shop(shop_id, current_user, db)
    role = db.query(ShopRole).filter(ShopRole.id == role_id, ShopRole.shop_id == shop_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Give the role a name.")
    if _name_taken(db, shop_id, name, exclude_id=role.id):
        raise HTTPException(status_code=409, detail="You already have a role with that name.")
    before = clean_permissions(role.permissions)
    role.name = name
    role.description = (body.description or "").strip() or None
    role.permissions = clean_permissions(body.permissions)
    db.commit()
    db.refresh(role)
    record_audit_event(db, "role_updated", request=request, actor_user_id=current_user.id,
                       actor_email=current_user.email, actor_name=current_user.full_name, shop_id=shop_id,
                       description=f"Updated role \"{role.name}\"", extra={"before": before, "after": role.permissions})
    count = db.query(func.count(ShopStaff.id)).filter(ShopStaff.role_id == role.id).scalar()
    return _role_out(role, count)


@router.delete("/shops/{shop_id}/team/roles/{role_id}")
def delete_role(shop_id: int, role_id: int, request: Request,
                current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _owner_shop(shop_id, current_user, db)
    role = db.query(ShopRole).filter(ShopRole.id == role_id, ShopRole.shop_id == shop_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    in_use = db.query(func.count(ShopStaff.id)).filter(ShopStaff.role_id == role.id).scalar()
    if in_use:
        raise HTTPException(status_code=409, detail=f"{in_use} team member(s) still have this role. Move them to another role first.")
    name = role.name
    db.delete(role)
    db.commit()
    record_audit_event(db, "role_deleted", request=request, actor_user_id=current_user.id,
                       actor_email=current_user.email, actor_name=current_user.full_name, shop_id=shop_id,
                       description=f"Deleted role \"{name}\"")
    return {"ok": True}


# ── Members ───────────────────────────────────────────────────────────────────

@router.get("/shops/{shop_id}/team/members")
def list_members(shop_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    shop = _owner_shop(shop_id, current_user, db)
    owner = db.query(User).filter(User.id == shop.owner_id).first()
    members = (
        db.query(ShopStaff).options(joinedload(ShopStaff.role))
        .filter(ShopStaff.shop_id == shop_id).order_by(ShopStaff.id.asc()).all()
    )
    return {
        "owner": {"email": owner.email if owner else None, "full_name": owner.full_name if owner else None},
        "members": [_member_out(m) for m in members],
    }


class InviteIn(BaseModel):
    email: EmailStr
    full_name: Optional[str] = Field(default=None, max_length=255)
    role_id: int


@router.post("/shops/{shop_id}/team/members", status_code=201)
def invite_member(shop_id: int, body: InviteIn, request: Request,
                  current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    shop = _owner_shop(shop_id, current_user, db)
    email = body.email.strip().lower()
    role = db.query(ShopRole).filter(ShopRole.id == body.role_id, ShopRole.shop_id == shop_id).first()
    if not role:
        raise HTTPException(status_code=422, detail="Pick a role for this person first.")
    if email == (current_user.email or "").lower():
        raise HTTPException(status_code=400, detail="You're already the owner of this store.")
    if db.query(ShopStaff.id).filter(ShopStaff.shop_id == shop_id, func.lower(ShopStaff.email) == email).first():
        raise HTTPException(status_code=409, detail="That person is already on your team (or has a pending invite).")
    if db.query(func.count(ShopStaff.id)).filter(ShopStaff.shop_id == shop_id).scalar() >= MAX_STAFF_PER_SHOP:
        raise HTTPException(status_code=400, detail=f"You can have up to {MAX_STAFF_PER_SHOP} team members.")

    member = ShopStaff(shop_id=shop_id, email=email, full_name=(body.full_name or "").strip() or None,
                       role_id=role.id, status="invited", invited_by_user_id=current_user.id)
    db.add(member)
    db.commit()
    db.refresh(member)
    _send_invite(member, shop, current_user, role)
    record_audit_event(db, "staff_invited", request=request, actor_user_id=current_user.id,
                       actor_email=current_user.email, actor_name=current_user.full_name, shop_id=shop_id,
                       description=f"Invited {email} as \"{role.name}\"", extra={"role_id": role.id})
    member.role = role
    return _member_out(member)


@router.post("/shops/{shop_id}/team/members/{member_id}/resend")
def resend_invite(shop_id: int, member_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    shop = _owner_shop(shop_id, current_user, db)
    member = db.query(ShopStaff).options(joinedload(ShopStaff.role)).filter(
        ShopStaff.id == member_id, ShopStaff.shop_id == shop_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")
    if member.status != "invited":
        raise HTTPException(status_code=400, detail="This person has already joined.")
    _send_invite(member, shop, current_user, member.role)
    return {"ok": True}


class MemberUpdateIn(BaseModel):
    role_id: Optional[int] = None
    status: Optional[str] = None   # active | suspended


@router.put("/shops/{shop_id}/team/members/{member_id}")
def update_member(shop_id: int, member_id: int, body: MemberUpdateIn, request: Request,
                  current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _owner_shop(shop_id, current_user, db)
    member = db.query(ShopStaff).options(joinedload(ShopStaff.role)).filter(
        ShopStaff.id == member_id, ShopStaff.shop_id == shop_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")

    events = []
    if body.role_id is not None and body.role_id != member.role_id:
        role = db.query(ShopRole).filter(ShopRole.id == body.role_id, ShopRole.shop_id == shop_id).first()
        if not role:
            raise HTTPException(status_code=422, detail="That role doesn't exist.")
        events.append(("staff_role_changed", f"Changed {member.email} from \"{member.role.name}\" to \"{role.name}\""))
        member.role_id = role.id
        member.role = role
    if body.status is not None and body.status != member.status:
        if body.status not in ("active", "suspended"):
            raise HTTPException(status_code=422, detail="Status must be active or suspended.")
        if member.status == "invited":
            raise HTTPException(status_code=400, detail="They haven't accepted the invitation yet.")
        member.status = body.status
        events.append(("staff_suspended" if body.status == "suspended" else "staff_reactivated",
                       f"{'Suspended' if body.status == 'suspended' else 'Reactivated'} {member.email}"))
    db.commit()
    for ev_type, text in events:
        record_audit_event(db, ev_type, request=request, actor_user_id=current_user.id,
                           actor_email=current_user.email, actor_name=current_user.full_name,
                           shop_id=shop_id, description=text)
    return _member_out(member)


@router.delete("/shops/{shop_id}/team/members/{member_id}")
def remove_member(shop_id: int, member_id: int, request: Request,
                  current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _owner_shop(shop_id, current_user, db)
    member = db.query(ShopStaff).filter(ShopStaff.id == member_id, ShopStaff.shop_id == shop_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")
    email = member.email
    db.delete(member)
    db.commit()
    record_audit_event(db, "staff_removed", request=request, actor_user_id=current_user.id,
                       actor_email=current_user.email, actor_name=current_user.full_name, shop_id=shop_id,
                       description=f"Removed {email} from the team")
    return {"ok": True}


# ── Team activity (what people did in this store) ─────────────────────────────

@router.get("/shops/{shop_id}/team/activity")
def team_activity(
    shop_id: int,
    actor_email: Optional[str] = None,
    before_id: Optional[int] = None,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Every change made in this store (by the owner or the team) plus team
    sign-ins, newest first. Owner-only, like the rest of /team. The same
    events feed Admin > Audit Log across all stores."""
    from app.models.audit_log import AuditLog
    _owner_shop(shop_id, current_user, db)
    limit = min(max(limit, 1), 100)

    q = db.query(AuditLog).filter(
        AuditLog.shop_id == shop_id,
        AuditLog.event_type.in_(("shop_action", "login", "social_login")),
    )
    if actor_email:
        q = q.filter(func.lower(AuditLog.actor_email) == actor_email.strip().lower())
    if before_id:
        q = q.filter(AuditLog.id < before_id)
    rows = q.order_by(AuditLog.id.desc()).limit(limit + 1).all()
    has_more = len(rows) > limit
    rows = rows[:limit]

    return {
        "events": [
            {
                "id": r.id, "event_type": r.event_type, "actor_email": r.actor_email, "actor_name": r.actor_name,
                "description": r.description, "country": r.country, "created_at": r.created_at.isoformat() if r.created_at else None,
                "acting_as": (r.extra or {}).get("as"), "role": (r.extra or {}).get("role"), "area": (r.extra or {}).get("area"),
            }
            for r in rows
        ],
        "has_more": has_more,
        "next_before_id": rows[-1].id if rows and has_more else None,
    }


# ── Accepting an invitation (public - the invitee has no account/session yet) ─

def _load_invite(token: str, db: Session) -> ShopStaff:
    bad = HTTPException(status_code=400, detail="This invitation link is invalid or has expired. Ask the store owner to send a new one.")
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise bad
    if payload.get("purpose") != "staff_invite":
        raise bad
    member = db.query(ShopStaff).options(joinedload(ShopStaff.role)).filter(ShopStaff.id == payload.get("staff_id")).first()
    # Email is signed into the token too, so a token can't be replayed against
    # a row that was later re-pointed at a different address.
    if not member or member.email != payload.get("email") or member.status != "invited":
        raise bad
    return member


@router.get("/team/invite-info")
def invite_info(token: str, db: Session = Depends(get_db)):
    member = _load_invite(token, db)
    shop = db.query(Shop).filter(Shop.id == member.shop_id).first()
    account_exists = db.query(User.id).filter(func.lower(User.email) == member.email).first() is not None
    return {
        "shop_name": shop.name if shop else "",
        "role_name": member.role.name if member.role else "",
        "email": member.email,
        "full_name": member.full_name,
        "account_exists": account_exists,
    }


class AcceptIn(BaseModel):
    token: str
    password: str = Field(min_length=1, max_length=128)
    full_name: Optional[str] = Field(default=None, max_length=255)


@router.post("/team/accept-invite")
@limiter.limit("10/minute")
def accept_invite(request: Request, body: AcceptIn, db: Session = Depends(get_db)):
    member = _load_invite(body.token, db)
    user = db.query(User).filter(func.lower(User.email) == member.email).first()
    if user:
        # They already have an ExiusCart login: prove it's theirs with the
        # existing password instead of silently attaching a team seat to
        # whatever account happens to share the address.
        if not verify_password(body.password, user.hashed_password):
            raise HTTPException(status_code=400, detail="You already have an ExiusCart account with this email - enter its existing password to accept.")
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

    record_audit_event(db, "staff_accepted", request=request, actor_user_id=user.id,
                       actor_email=user.email, actor_name=user.full_name, shop_id=member.shop_id,
                       description=f"{user.email} joined the team as \"{member.role.name if member.role else ''}\"")
    token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer", "user": UserResponse.model_validate(user)}
