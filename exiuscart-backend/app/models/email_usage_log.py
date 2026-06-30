from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base


class EmailUsageLog(Base):
    __tablename__ = "email_usage_log"
    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    email_type = Column(String(30), nullable=False)  # "invoice" | "quotation" | "marketing"
    recipient_email = Column(String(255))
    reference_id = Column(Integer)
    sent_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
