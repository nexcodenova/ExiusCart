from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.sql import func
from app.core.database import Base

# Same channel restriction as storefront_categories (app/models/storefront_category.py)
# and for the same reason: a form embedded on a seller's own storefront only
# makes sense for channels where the seller controls the page HTML.
SIGNUP_FORM_CHANNELS = ("shopify", "custom")

SIGNUP_FORM_FIELD_TYPES = ("text", "email", "phone", "textarea", "dropdown", "checkbox")


class SignupForm(Base):
    """A seller-built form (newsletter signup, inquiry/contact form, etc.)
    shown via an embeddable JS widget on their Custom Website / Shopify
    theme — same delivery mechanism as StorefrontPopup (app/models/popup.py),
    but with a seller-defined field schema instead of a fixed shape."""
    __tablename__ = "signup_forms"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False, index=True)
    channel_type = Column(String(20), nullable=False)  # "shopify" | "custom"

    name = Column(String(200), nullable=False)          # internal label
    title = Column(String(200), nullable=False)          # shown to visitors
    description = Column(Text, nullable=True)

    # Ordered list of {id, label, type, required, options?} — schema-less by
    # design, same JSON-column approach already used for ShopLead.score_breakdown
    # (app/models/marketing.py) rather than a separate normalized field table.
    fields = Column(JSON, nullable=False, default=list)

    success_message = Column(String(300), nullable=True)
    discount_code = Column(String(50), nullable=True)

    delay_seconds = Column(Integer, default=3)
    is_active = Column(Boolean, default=True)
    impressions = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class SignupFormSubmission(Base):
    """One visitor's answers to a SignupForm. Kept separately from ShopLead
    (app/models/marketing.py) since a form's fields are arbitrary and don't
    fit ShopLead's fixed name/email/phone/company columns — this is the
    full-fidelity record, `lead_id` links to the CRM row created from it
    when the form has an email field."""
    __tablename__ = "signup_form_submissions"

    id = Column(Integer, primary_key=True, index=True)
    form_id = Column(Integer, ForeignKey("signup_forms.id", ondelete="CASCADE"), nullable=False, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False, index=True)

    data = Column(JSON, nullable=False)  # {field_label: value}
    lead_id = Column(Integer, ForeignKey("shop_leads.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CapturedFormSubmission(Base):
    """A submission from a form the SELLER already built themselves (their
    own Contact Us page, a Shopify theme's native newsletter box, etc.) —
    not one built through the SignupForm builder above. The seller tags
    their existing <form> with a data-exiuscart-capture attribute; the
    same embed widget script then watches it and mirrors every submission
    here, without touching how their form already behaves. Since we don't
    control the field names, `data` stores whatever the visitor's browser
    sent verbatim, and `lead_id` is only set when an email-like field was
    confidently detected (see _classify_captured_fields in signup_forms.py)."""
    __tablename__ = "captured_form_submissions"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False, index=True)

    source_url = Column(String(500), nullable=True)
    data = Column(JSON, nullable=False)  # {field_name: value} — raw, as submitted
    lead_id = Column(Integer, ForeignKey("shop_leads.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
