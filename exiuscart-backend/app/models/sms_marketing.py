from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class SMSMessageLog(Base):
    """One row per actual send attempt — the audit trail a seller can check
    if a customer says they never got a text, what daily/monthly SMS_LIMITS
    quota checks in sms_marketing.py count against, and what a retried
    /send call checks before resending (same reasoning as
    whatsapp_marketing.py's WhatsAppMessageLog). Sent via ExiusCart's own
    centralized Twilio account (app/core/sms.py) — there's no per-shop
    SMSConnection model since this isn't BYOK."""
    __tablename__ = "sms_message_logs"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("sms_campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True)

    phone = Column(String(30), nullable=False)
    status = Column(String(20), nullable=False)  # sent | failed
    twilio_message_sid = Column(String(50), nullable=True)
    error = Column(Text, nullable=True)
    sent_at = Column(DateTime(timezone=True), server_default=func.now())

    campaign = relationship("SMSCampaign", back_populates="logs")
