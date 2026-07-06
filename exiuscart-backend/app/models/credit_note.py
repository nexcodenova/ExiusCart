from sqlalchemy import Column, Integer, String, Numeric, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class CreditNote(Base):
    __tablename__ = "credit_notes"

    id = Column(Integer, primary_key=True, index=True)
    cn_number = Column(String(30), nullable=False, unique=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    reason = Column(String(500), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False, default=0)
    status = Column(String(20), default="issued")  # issued | applied | voided
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    order = relationship("Order", foreign_keys=[order_id])
