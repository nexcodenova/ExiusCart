from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)
    whatsapp = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    # Nullable — most customers (POS, manual, synced from a channel) never
    # log in and have no password. Only set for storefront self-signup.
    password_hash = Column(String(255), nullable=True)
    # Nullable — existing/POS/synced customers are left untagged rather
    # than guessed at. Only the new storefront signup flow sets this
    # (to "signup"), which is what the Customers page's source filter reads.
    source = Column(String(30), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Foreign Keys
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)

    # Relationships
    shop = relationship("Shop", back_populates="customers")
    orders = relationship("Order", back_populates="customer")
