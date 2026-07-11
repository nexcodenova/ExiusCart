from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base


class ChannelConnection(Base):
    __tablename__ = "channel_connections"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)
    channel_type = Column(String(50), nullable=False)       # "thedersi" | "shopify" | "woocommerce"
    channel_api_key = Column(String(500), nullable=True)    # API key to call channel's product API
    channel_api_url = Column(String(500), nullable=True)    # override default channel API URL
    channel_seller_id = Column(String(100), nullable=True)  # seller ID on the channel
    webhook_secret = Column(String(100), nullable=False, unique=True)  # channel calls this back
    is_active = Column(Boolean, default=True)
    seller_status = Column(String(20), nullable=True)  # approved | suspended | rejected (set by channel partner)
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
