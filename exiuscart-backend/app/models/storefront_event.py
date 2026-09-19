from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class StorefrontEvent(Base):
    """A single visitor-behavior event on a Custom Website storefront — view,
    on-site search, or add-to-cart. Deliberately minimal (no session/cookie
    tracking, no PII) — just enough to build a real per-product funnel and
    surface search terms that aren't converting, feeding into the existing
    AI SEO Tools rather than duplicating them.

    Scoped to the Custom Website channel only — this can only ever see what
    ExiusCart itself renders. Shopify/eBay/Daraz/etc. own their own
    frontend; there's no way to observe on-page behavior there."""
    __tablename__ = "storefront_events"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String(20), nullable=False, index=True)  # view | search | add_to_cart
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)  # set for view/add_to_cart
    query = Column(Text, nullable=True)  # set for search
    # Visitor's country (ISO 3166-1 alpha-2) from an IP lookup at the tracking
    # endpoint — the IP itself is never stored, only this coarse country code,
    # so the "no PII" property in the class docstring still holds. NULL for
    # events recorded before this existed or when the lookup failed.
    country = Column(String(2), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    shop = relationship("Shop")
    product = relationship("Product")
