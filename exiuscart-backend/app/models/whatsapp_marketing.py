from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class WhatsAppConnection(Base):
    """A seller's own WhatsApp Business Account (BYOK, same spirit as CJ/
    HyperSKU/Higgsfield/social_posting.py) — one per shop. Unlike Facebook
    Page posting (social_posting.py), connecting isn't a redirect-based
    OAuth dance: Meta's real "Embedded Signup" flow for WhatsApp requires
    their JS SDK popup with special config, not a plain authorize URL, and
    is fragile to build against without a live app to test on. Instead the
    seller pastes the 3 values Meta's own WhatsApp Manager already shows
    directly to any WABA owner (API Setup tab): waba_id, phone_number_id,
    and an access token (temporary for testing, a permanent System User
    token for real production use) — same manual-paste BYOK pattern as
    HyperSKU's username/password or Higgsfield's key_id/key_secret,
    verified against Meta's own API before saving rather than trusted
    blindly."""
    __tablename__ = "whatsapp_connections"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    waba_id = Column(String(100), nullable=False)
    phone_number_id = Column(String(100), nullable=False)
    display_phone_number = Column(String(30), nullable=True)
    verified_name = Column(String(255), nullable=True)
    access_token = Column(Text, nullable=False)  # encrypted (Fernet)

    is_active = Column(Boolean, default=True, nullable=False)
    connected_at = Column(DateTime(timezone=True), server_default=func.now())


class WhatsAppTemplate(Base):
    """A cached copy of one of the seller's Meta-approved message templates
    — WhatsApp requires marketing messages to use a pre-approved template
    (24-48hr Meta review), so templates are authored/approved in Meta's own
    WhatsApp Manager and just synced here read-only via /templates/sync,
    never created from ExiusCart."""
    __tablename__ = "whatsapp_templates"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)

    meta_template_id = Column(String(100), nullable=True)
    name = Column(String(512), nullable=False)
    language = Column(String(20), nullable=False)
    category = Column(String(20), nullable=True)   # marketing | utility | authentication
    status = Column(String(20), nullable=True)      # APPROVED | PENDING | REJECTED
    body_text = Column(Text, nullable=True)          # cached preview, e.g. "Hi {{1}}, ..."
    variable_count = Column(Integer, default=0, nullable=False)  # how many {{n}} placeholders in the body

    synced_at = Column(DateTime(timezone=True), server_default=func.now())


class WhatsAppCampaign(Base):
    """One broadcast of a single template to every customer with a phone
    number on file — same 'all customers, no segmentation' scope as the
    existing Email Marketing campaigns (marketing.py's send_email_campaign),
    kept consistent rather than inventing audience filtering this feature
    doesn't have either."""
    __tablename__ = "whatsapp_campaigns"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    template_id = Column(Integer, ForeignKey("whatsapp_templates.id", ondelete="CASCADE"), nullable=False)

    name = Column(String(255), nullable=False)
    status = Column(String(20), nullable=False, default="draft")  # draft | sending | sent | failed
    total_recipients = Column(Integer, default=0, nullable=False)
    sent_count = Column(Integer, default=0, nullable=False)
    failed_count = Column(Integer, default=0, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    sent_at = Column(DateTime(timezone=True), nullable=True)

    template = relationship("WhatsAppTemplate")
    logs = relationship("WhatsAppMessageLog", back_populates="campaign", cascade="all, delete-orphan")


class WhatsAppMessageLog(Base):
    """One row per actual send attempt — the audit trail a seller can check
    if a customer says they never got a message, and what stops a retried
    /send call from double-charging the seller's own Meta bill (checked by
    campaign_id+customer_id before sending, not a hard unique constraint,
    since a legitimate resend-to-failed-only pass should be possible)."""
    __tablename__ = "whatsapp_message_logs"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("whatsapp_campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True)

    phone = Column(String(30), nullable=False)
    status = Column(String(20), nullable=False)  # sent | failed
    whatsapp_message_id = Column(String(150), nullable=True)
    error = Column(Text, nullable=True)
    sent_at = Column(DateTime(timezone=True), server_default=func.now())

    campaign = relationship("WhatsAppCampaign", back_populates="logs")
