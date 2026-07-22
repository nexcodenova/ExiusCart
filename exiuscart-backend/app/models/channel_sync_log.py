from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base


class ChannelSyncLog(Base):
    """Append-only history of every channel sync attempt — listing creation,
    stock push, price update, order pull, etc. Complements
    ChannelProductStatus (which only tracks current state per product) by
    keeping every attempt including failures, so a seller can see what went
    wrong and when instead of a transient error that vanishes on page leave.
    """
    __tablename__ = "channel_sync_logs"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)  # null for shop-level actions
    channel_type = Column(String(50), nullable=False)  # "noon" | "daraz" | "thedersi" | ...
    action = Column(String(50), nullable=False)         # "create_listing" | "update_stock" | "update_price" | "sync_order"
    success = Column(Boolean, nullable=False)
    external_id = Column(String(100), nullable=True)    # e.g. Noon's sku_parent, Daraz's item_id
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
