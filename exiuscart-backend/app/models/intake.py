from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey, Index, func
from app.core.database import Base


class IntakeItem(Base):
    """One supplier product on its way into the Prodora catalogue.

    Lifecycle:  queued -> importing -> analyzing -> ready -> approved -> published
                                          (or failed at any step, or rejected)

    The product itself is created HIDDEN (is_active=False) as soon as it is
    imported, so a person can review it with the real photos and prices, and it
    only becomes visible to sellers when it is published. The verdict fields are
    copies of the latest analysis so the review queue can sort and filter without
    opening every analysis."""
    __tablename__ = "intake_items"
    __table_args__ = (
        Index("ix_intake_status_created", "status", "created_at"),
        Index("ix_intake_supplier_ref", "supplier_type", "supplier_ref"),
    )

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(36), nullable=False, index=True)
    source_url = Column(Text, nullable=False)
    supplier_type = Column(String(20), nullable=False)          # cj | aliexpress
    supplier_ref = Column(String(255), nullable=False)          # CJ product id / AliExpress product id
    status = Column(String(20), nullable=False, default="queued", server_default="queued")
    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True, index=True)
    error = Column(Text, nullable=True)

    verdict = Column(String(10), nullable=True)                 # TEST | WATCH | AVOID
    confidence = Column(String(10), nullable=True)
    margin_pct = Column(Float, nullable=True)
    competitor_count = Column(Integer, nullable=True)

    added_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reject_reason = Column(String(300), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    published_at = Column(DateTime(timezone=True), nullable=True)


class IntakeSettings(Base):
    """Singleton (id=1): how the intake queue behaves."""
    __tablename__ = "intake_settings"

    id = Column(Integer, primary_key=True, default=1, autoincrement=False)
    daily_publish_limit = Column(Integer, nullable=False, default=100, server_default="100")
    publish_hour_utc = Column(Integer, nullable=False, default=6, server_default="6")
    auto_publish_enabled = Column(Boolean, nullable=False, default=False, server_default="false")
    auto_analyze = Column(Boolean, nullable=False, default=True, server_default="true")
    updated_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
