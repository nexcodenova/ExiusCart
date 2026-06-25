from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Reservation(Base):
    __tablename__ = "reservations"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_name = Column(String(200), nullable=False)
    customer_phone = Column(String(50), nullable=True)
    customer_email = Column(String(200), nullable=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True)
    product_name = Column(String(300), nullable=False)  # denormalized — keeps history after product edit
    quantity = Column(Integer, nullable=False, default=1)
    reservation_type = Column(String(20), nullable=False)  # 'soft_hold' | 'confirmed'
    status = Column(String(20), nullable=False, default="active")  # 'active' | 'expired' | 'fulfilled' | 'cancelled'
    notes = Column(Text, nullable=True)
    expires_at = Column(DateTime, nullable=True)   # set for soft_hold (created_at + 2 days)
    lpo_number = Column(String(100), nullable=True)  # for confirmed reservations
    advance_amount = Column(Numeric(12, 2), nullable=True)  # advance payment received
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    shop = relationship("Shop", back_populates="reservations")
    product = relationship("Product", back_populates="reservations")
