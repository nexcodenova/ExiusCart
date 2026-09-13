from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Numeric, UniqueConstraint
from sqlalchemy.sql import func
from app.core.database import Base

# v1 scope: direct storefront checkout + POS only — not synced to any
# marketplace channel (Shopify/eBay/Daraz/etc. each have their own separate
# promotions API; that's a per-channel integration, not a checkbox here).


class Discount(Base):
    __tablename__ = "discounts"
    __table_args__ = (UniqueConstraint("shop_id", "code", name="uq_discount_shop_code"),)

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    code = Column(String(50), nullable=False, index=True)
    # "percentage" | "fixed" — value is a % (0-100) or a flat amount in the
    # shop's own base currency, matching how the rest of the app already
    # treats seller-entered money (no per-discount currency of its own).
    discount_type = Column(String(20), nullable=False)
    value = Column(Numeric(10, 2), nullable=False)
    min_order_amount = Column(Numeric(10, 2), nullable=True)
    usage_limit = Column(Integer, nullable=True)  # None = unlimited
    times_used = Column(Integer, nullable=False, default=0)
    starts_at = Column(DateTime(timezone=True), nullable=True)
    ends_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
