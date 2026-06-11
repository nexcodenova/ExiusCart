from sqlalchemy import Column, Integer, String, Numeric, Text, ForeignKey, JSON
from sqlalchemy.sql import func
from sqlalchemy import DateTime
from app.core.database import Base


class ChannelOrderMeta(Base):
    """Stores channel-specific order data (commission, delivery, variants) per order."""
    __tablename__ = "channel_order_meta"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), unique=True, nullable=False)
    channel_type = Column(String(50), nullable=False)         # "thedersi"
    channel_order_id = Column(String(100), nullable=True)     # TD-20260611-AB3X

    # Commission & earnings
    seller_plan = Column(String(100), nullable=True)          # "Growth — LKR 999/mo"
    commission_rate = Column(Numeric(5, 2), nullable=True)    # 7
    commission_amount = Column(Numeric(10, 2), nullable=True) # 350.00
    seller_net_earnings = Column(Numeric(10, 2), nullable=True) # 4650.00

    # Delivery
    delivery_fee = Column(Numeric(10, 2), nullable=True)      # 500
    delivery_paid_by = Column(String(20), nullable=True)      # "customer" | "seller"
    delivery_note = Column(Text, nullable=True)

    # Full items with variants (size, color etc.) — stored as JSON
    items_detail = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
