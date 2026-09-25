from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import JSONB
from app.core.database import Base


class AuditLog(Base):
    """Platform-wide event log - every signup, login, and staff/admin
    action, across every user and shop. Deliberately separate from
    ActivityLog (the narrow order/payment feed a seller glances at on
    their own Orders page) - this is the security/ops-facing trail an
    admin reviews, closer to a Google Cloud "Logs Explorer" than a seller
    notification feed.

    actor_email/actor_name are snapshotted at write time, not joined live
    from users, so a row still reads correctly if that user is later
    deleted, renamed, or removed as staff - which is also why both foreign
    keys are ON DELETE SET NULL: deleting a user or a store must never be
    blocked by (or wipe out) the history of what happened."""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    # signup | login | login_failed | social_signup | social_login |
    # staff_invited | staff_accepted | staff_removed | staff_role_changed |
    # admin_login | plan_changed
    event_type = Column(String(40), nullable=False, index=True)
    actor_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    actor_email = Column(String(255), nullable=True)
    actor_name = Column(String(255), nullable=True)
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="SET NULL"), nullable=True, index=True)
    ip_address = Column(String(64), nullable=True)
    country = Column(String(2), nullable=True)
    user_agent = Column(String(500), nullable=True)
    description = Column(String(500), nullable=True)
    extra = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
