from sqlalchemy import Column, Integer, String, Boolean, Float
from sqlalchemy.dialects.postgresql import JSONB
from app.core.database import Base


class AdminSettings(Base):
    __tablename__ = "admin_settings"

    id = Column(Integer, primary_key=True, default=1)

    # General
    platform_name = Column(String, default="ExiusCart")
    support_email = Column(String, default="support@exiuscart.com")
    contact_phone = Column(String, default="+971 4 123 4567")
    website_url = Column(String, default="https://exiuscart.com")
    platform_description = Column(String, default="Multi-tenant SaaS platform for UAE mobile store businesses")

    # Notifications
    notify_new_store = Column(Boolean, default=True)
    notify_payment_received = Column(Boolean, default=True)
    notify_payment_pending = Column(Boolean, default=True)
    notify_subscription_expiring = Column(Boolean, default=True)
    notify_support_tickets = Column(Boolean, default=False)
    alert_system_errors = Column(Boolean, default=True)
    alert_high_traffic = Column(Boolean, default=True)
    alert_failed_logins = Column(Boolean, default=True)
    notification_email_primary = Column(String, default="admin@exiuscart.com")
    notification_email_secondary = Column(String, default="")

    # Security
    require_2fa_admins = Column(Boolean, default=True)
    require_2fa_store_owners = Column(Boolean, default=False)
    session_timeout_minutes = Column(Integer, default=30)
    max_active_sessions = Column(Integer, default=3)

    # Payment — Lemon Squeezy
    lemonsqueezy_api_key = Column(String, default="")
    lemonsqueezy_store_id = Column(String, default="")
    lemonsqueezy_webhook_secret = Column(String, default="")

    # Bank Transfer
    bank_transfer_enabled = Column(Boolean, default=True)
    bank_name = Column(String, default="")
    account_name = Column(String, default="")
    account_number = Column(String, default="")
    iban = Column(String, default="")
    swift_code = Column(String, default="")
    branch = Column(String, default="")

    # Invoice
    invoice_prefix = Column(String, default="INV-")
    vat_number = Column(String, default="")
    vat_rate_aed = Column(Float, default=5.0)
    vat_rate_usd = Column(Float, default=0.0)
    auto_generate_invoices = Column(Boolean, default=True)
