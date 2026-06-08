from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Webhook(Base):
    __tablename__ = "webhooks"

    id = Column(Integer, primary_key=True, index=True)
    url = Column(String(500), nullable=False)
    secret = Column(String(64), nullable=True)  # optional HMAC secret
    events = Column(String(500), nullable=False, default="order.created")  # comma-separated
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # FK
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)


class WebhookLog(Base):
    __tablename__ = "webhook_logs"

    id = Column(Integer, primary_key=True, index=True)
    event = Column(String(50), nullable=False)
    payload = Column(Text, nullable=True)
    response_status = Column(Integer, nullable=True)
    response_body = Column(Text, nullable=True)
    success = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # FK
    webhook_id = Column(Integer, ForeignKey("webhooks.id"), nullable=False)
    webhook = relationship("Webhook")
