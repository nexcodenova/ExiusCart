from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, Index, func
from app.core.database import Base


class CoachItem(Base):
    """One supplier link a SELLER pasted into their own store to price-check.

    Lifecycle:  importing -> imported -> checked -> launched   (or failed, or discarded)

    The product it points at belongs to the seller's shop and stays HIDDEN
    (is_active=False) the whole time, so it never shows on their storefront and
    never in the public Prodora catalogue (that only lists products with no shop).
    'launched' means the price and an AI-written draft were applied; the seller
    still reviews it and publishes it themselves. The verdict fields are copies of
    the latest analysis so the list can show them without opening every check."""
    __tablename__ = "coach_items"
    __table_args__ = (
        Index("ix_coach_shop_created", "shop_id", "created_at"),
        Index("ix_coach_shop_supplier_ref", "shop_id", "supplier_type", "supplier_ref"),
    )

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    source_url = Column(Text, nullable=False)
    supplier_type = Column(String(20), nullable=False)          # cj | aliexpress
    supplier_ref = Column(String(255), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True, index=True)
    status = Column(String(20), nullable=False, default="importing", server_default="importing")
    error = Column(Text, nullable=True)

    verdict = Column(String(10), nullable=True)                 # TEST | WATCH | AVOID
    confidence = Column(String(10), nullable=True)
    margin_pct = Column(Float, nullable=True)
    competitor_count = Column(Integer, nullable=True)
    checked_at = Column(DateTime(timezone=True), nullable=True)

    original_name = Column(String(255), nullable=True)          # the supplier's own title, kept after the AI rewrite
    launched_price = Column(Float, nullable=True)
    launched_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
