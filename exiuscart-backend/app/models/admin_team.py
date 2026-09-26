from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base


class AdminRole(Base):
    """A role the platform owner builds for the ADMIN panel by ticking which
    permissions it carries ("Catalogue editor", "Reviewer"...). Same idea as a
    store's ShopRole (see shop_staff.py) but platform-wide: nothing about roles
    is hardcoded, the only fixed thing is the catalog of permissions
    (app/core/admin_access.py ADMIN_PERMISSIONS)."""
    __tablename__ = "admin_roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(60), nullable=False, unique=True)
    description = Column(String(200), nullable=True)
    permissions = Column(JSONB, nullable=False, default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    members = relationship("AdminStaff", back_populates="role")


class AdminStaff(Base):
    """A person the platform owner invited to help run the admin panel.
    Superusers are NOT rows here - they always mean every permission.

    status: invited (email sent, not accepted yet - user_id NULL) | active |
    suspended (kept on the team but locked out until reactivated)."""
    __tablename__ = "admin_staff"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    email = Column(String(255), nullable=False, unique=True)
    full_name = Column(String(255), nullable=True)
    # No ON DELETE action: a role that still has people on it can't be deleted
    # (the API also checks and returns a readable error).
    role_id = Column(Integer, ForeignKey("admin_roles.id"), nullable=False, index=True)
    status = Column(String(20), nullable=False, default="invited")
    invited_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    invited_at = Column(DateTime(timezone=True), server_default=func.now())
    joined_at = Column(DateTime(timezone=True), nullable=True)

    role = relationship("AdminRole", back_populates="members")
