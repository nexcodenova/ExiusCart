from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.core.database import Base


class EmailDomain(Base):
    """A seller's own sending domain (Scale plan). The domain is registered with
    Amazon SES; the seller proves they own it by adding the DKIM DNS records.
    One domain per shop. Until status == "verified" nothing changes: mail keeps
    going out from the shared ExiusCart address."""
    __tablename__ = "email_domains"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    domain = Column(String(253), nullable=False, unique=True, index=True)
    from_local = Column(String(64), nullable=False, default="invoices")     # invoices@<domain>
    # pending (records not seen yet) | verified | failed | suspended (stopped by us, see suspended_reason)
    status = Column(String(15), nullable=False, default="pending", index=True)
    dkim_tokens = Column(JSONB, nullable=True)          # the 3 tokens SES issued
    dkim_status = Column(String(20), nullable=True)     # SES's own word: PENDING / SUCCESS / FAILED ...
    verified_at = Column(DateTime(timezone=True), nullable=True)
    last_checked_at = Column(DateTime(timezone=True), nullable=True)
    suspended_reason = Column(String(255), nullable=True)
    suspended_by = Column(String(10), nullable=True)    # auto | admin
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class EmailEvent(Base):
    """One row per email ExiusCart sends (system mail and mail sent on a shop's
    behalf), then updated as Amazon SES reports what happened to it (delivered,
    bounced, complained...). The email monitor in Admin > Audit reads this."""
    __tablename__ = "email_events"

    id = Column(Integer, primary_key=True, index=True)
    event_uid = Column(String(36), nullable=False, unique=True, index=True)   # also sent to SES as a message tag
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="SET NULL"), nullable=True, index=True)
    category = Column(String(10), nullable=False, default="system")           # shop | system
    kind = Column(String(15), nullable=True)                                  # transactional | marketing
    from_address = Column(String(255), nullable=True)
    from_domain = Column(String(253), nullable=True, index=True)
    recipient = Column(String(255), nullable=True, index=True)
    subject = Column(String(300), nullable=True)
    # sent | delayed | delivered | bounced | complained | rejected | failed | blocked | suppressed | skipped
    status = Column(String(15), nullable=False, default="sent", index=True)
    bounce_type = Column(String(20), nullable=True)      # Permanent | Transient | Undetermined
    bounce_subtype = Column(String(40), nullable=True)
    detail = Column(Text, nullable=True)
    ses_message_id = Column(String(120), nullable=True, index=True)
    via_webhook = Column(Boolean, nullable=False, default=False, server_default="false")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class EmailSuppression(Base):
    """Addresses we stop sending to: they bounced permanently or reported us as
    spam. Keeps our sending reputation clean."""
    __tablename__ = "email_suppressions"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), nullable=False, unique=True, index=True)   # lower-cased
    reason = Column(String(15), nullable=False)                            # bounce | complaint | admin
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="SET NULL"), nullable=True)
    detail = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class EmailShopControl(Base):
    """Marketing email switched off for one shop, automatically (bounce/complaint
    rate too high) or by an admin. Order and invoice mail is unaffected."""
    __tablename__ = "email_shop_controls"

    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), primary_key=True)
    paused = Column(Boolean, nullable=False, default=True)
    reason = Column(String(255), nullable=True)
    source = Column(String(10), nullable=True)      # auto | admin
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
