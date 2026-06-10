from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base


class PartnerLicense(Base):
    __tablename__ = "partner_licenses"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(100), unique=True, nullable=False, index=True)
    partner_name = Column(String(50), nullable=False)   # "nexcodenova" | "thedersi"
    plan_type = Column(String(30), nullable=False)       # "premium" | "starter" | "thedersi_basic"
    duration_months = Column(Integer, nullable=True)     # NULL = forever
    max_uses = Column(Integer, default=1)
    used_count = Column(Integer, default=0)
    allowed_email = Column(String(255), nullable=True)  # restrict to specific email (NexCode Nova)
    max_shops = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)
    notes = Column(String(500), nullable=True)           # e.g. "Ahmed - 450 package"
    code_expires_at = Column(DateTime(timezone=True), nullable=True)  # when the code itself expires
    created_at = Column(DateTime(timezone=True), server_default=func.now())
