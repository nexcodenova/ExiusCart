from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class SMSConnection(Base):
    """A seller's own Twilio account (BYOK, same spirit as WhatsAppConnection/
    DropshipConnection/social_posting.py) — one per shop. Twilio bills per
    message with no free tier for marketing sends, so the seller pays their
    own bill directly, ExiusCart never touches it. `provider` is a plain
    string (not an enum) so a second SMS provider can be added later without
    a migration — only "twilio" is actually wired up today.

    Unlike WhatsAppConnection, SMS has no pre-approved-template requirement
    from the provider side, so there's no SMSTemplate model — a campaign's
    own free-text `message` field (see SMSCampaign in app/models/marketing.py)
    is sent as-is."""
    __tablename__ = "sms_connections"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    provider = Column(String(20), nullable=False, default="twilio")
    account_sid = Column(String(100), nullable=False)
    auth_token = Column(Text, nullable=False)  # encrypted (Fernet)
    from_number = Column(String(30), nullable=False)  # E.164, e.g. "+14155552671"

    is_active = Column(Boolean, default=True, nullable=False)
    connected_at = Column(DateTime(timezone=True), server_default=func.now())


class SMSMessageLog(Base):
    """One row per actual send attempt — the audit trail a seller can check
    if a customer says they never got a text, and what a retried /send call
    checks before resending (same reasoning as WhatsAppMessageLog)."""
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
