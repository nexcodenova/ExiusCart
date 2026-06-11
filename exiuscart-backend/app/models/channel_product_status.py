from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from app.core.database import Base


class ChannelProductStatus(Base):
    """Tracks approval/rejection status of each product on each connected channel."""
    __tablename__ = "channel_product_status"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)
    channel_type = Column(String(50), nullable=False)       # "thedersi"
    status = Column(String(30), nullable=False, default="pending_review")
    # pending_review | approved | rejected
    rejection_reason = Column(String(500), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("product_id", "channel_type", name="uq_product_channel"),
    )
