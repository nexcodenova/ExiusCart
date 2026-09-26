"""Who may do what in the ADMIN panel.

Two kinds of people get in:
  * the owner (User.is_superuser) - always every permission, unchanged from before;
  * admin staff (AdminStaff row, active) - only what their role ticks.

It is deny-by-default in two layers:
  1. Staff are not superusers, so every existing `require_superuser` endpoint
     (payments, subscriptions, users, settings...) already refuses them.
  2. Only endpoints that explicitly use `require_admin_perm("...")` admit staff,
     and only with that permission. Nothing is opened by accident.

Every non-GET request a staff member makes is written to the audit log with
their name, so the owner can always see who changed what.
"""
from typing import Iterable, List, Optional

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session, joinedload

from app.api.v1.deps import get_current_user
from app.core.audit_log import record_audit_event
from app.core.database import get_db
from app.models.admin_team import AdminStaff
from app.models.user import User

# The catalog roles are built from. `label`/`hint` are shown as-is in the admin
# team page, so the wording is for a non-technical owner.
ADMIN_PERMISSION_AREAS = [
    {
        "area": "prodora",
        "label": "Prodora catalogue",
        "permissions": [
            {"key": "prodora.view", "label": "View products", "hint": "See the catalogue and the review queue. Every other Prodora permission includes this one."},
            {"key": "prodora.add", "label": "Add products", "hint": "Paste supplier links, import from CJ or AliExpress, upload photos."},
            {"key": "prodora.edit", "label": "Edit products and categories", "hint": "Change details, prices, categories, trending and bestseller flags."},
            {"key": "prodora.delete", "label": "Delete products", "hint": "Remove products and categories for good."},
            {"key": "prodora.digital", "label": "Digital bundles", "hint": "Create and edit digital bundles (drawing books, design packs)."},
            {"key": "prodora.review", "label": "Review and approve", "hint": "Approve or reject products waiting in the intake queue."},
            {"key": "prodora.publish", "label": "Publish and schedule", "hint": "Publish approved products and change the daily schedule."},
            {"key": "prodora.analyze", "label": "Run product analysis", "hint": "Check competitors and get a verdict. Can use paid lookups, so give it only to people you trust with that."},
        ],
    },
]

ALL_PERMISSIONS = {p["key"] for area in ADMIN_PERMISSION_AREAS for p in area["permissions"]}


def clean_permissions(perms: Optional[Iterable[str]]) -> List[str]:
    """Only known keys, no duplicates, in catalog order."""
    wanted = set(perms or [])
    return [p["key"] for area in ADMIN_PERMISSION_AREAS for p in area["permissions"] if p["key"] in wanted]


def expand(perms: Iterable[str]) -> set:
    """Any prodora.* permission implies prodora.view, so a role that can add
    products can also open the list it adds to."""
    out = set(perms or [])
    if any(p.startswith("prodora.") for p in out):
        out.add("prodora.view")
    return out & ALL_PERMISSIONS


def staff_record(db: Session, user: User) -> Optional[AdminStaff]:
    """The user's ACTIVE admin-staff row, if any."""
    if not user or not user.is_active:
        return None
    return (
        db.query(AdminStaff).options(joinedload(AdminStaff.role))
        .filter(AdminStaff.user_id == user.id, AdminStaff.status == "active").first()
    )


def admin_summary(db: Session, user: User) -> Optional[dict]:
    """What the admin UI needs to draw itself, or None if this person has no
    admin access at all."""
    if user.is_superuser:
        return {"is_owner": True, "role": None, "permissions": sorted(ALL_PERMISSIONS)}
    rec = staff_record(db, user)
    if not rec:
        return None
    return {"is_owner": False, "role": rec.role.name if rec.role else None,
            "permissions": sorted(expand(rec.role.permissions if rec.role else []))}


def require_admin_perm(permission: str):
    """Dependency factory: `Depends(require_admin_perm("prodora.add"))`.
    The owner always passes. Staff pass only when their role carries the
    permission (directly or through the view implication)."""
    if permission not in ALL_PERMISSIONS:
        raise ValueError(f"Unknown admin permission: {permission}")

    def _dep(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
        if current_user.is_superuser:
            return current_user
        rec = staff_record(db, current_user)
        if not rec or permission not in expand(rec.role.permissions if rec.role else []):
            raise HTTPException(status_code=403, detail="You don't have permission to do that.")
        if request.method not in ("GET", "HEAD", "OPTIONS"):
            record_audit_event(
                db, "admin_staff_action", request=request, actor_user_id=current_user.id,
                actor_email=current_user.email, actor_name=current_user.full_name,
                description=f"{rec.role.name if rec.role else 'Staff'}: {request.method} {request.url.path}",
                extra={"permission": permission, "role": rec.role.name if rec.role else None, "as": "admin_staff"},
            )
        return current_user

    return _dep
