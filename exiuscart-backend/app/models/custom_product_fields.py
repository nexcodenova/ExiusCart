from sqlalchemy import Column, Integer, ForeignKey, DateTime, JSON
from sqlalchemy.sql import func
from app.core.database import Base

# Field types a seller can define for their Custom Website products.
# "quantity_tiers" is special-cased by checkout.py to actually price an
# order line — every other type is display-only data passed through to
# the storefront as-is.
CUSTOM_FIELD_TYPES = ("text", "number", "checkbox", "dropdown", "quantity_tiers")


class CustomProductFieldSettings(Base):
    """One row per shop — the seller-defined schema of extra product
    fields for their Custom Website channel (e.g. "Quantity Tiers", "Gift
    Wrap Available"). Not hardcoded by ExiusCart and not fetched from the
    seller's own website (which would require every connecting site to
    host its own API) — the seller builds this directly in the dashboard,
    same pattern as the Signup Forms field builder. Values for these
    fields, per product, live on Product.custom_field_values."""
    __tablename__ = "custom_product_field_settings"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    # Ordered list of {id, label, type, required, options?}
    fields = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
