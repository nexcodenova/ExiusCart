from sqlalchemy import Column, Integer, String, Numeric, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class WholesaleProduct(Base):
    __tablename__ = "wholesale_products"

    id           = Column(Integer, primary_key=True, index=True)
    shop_id      = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False)
    name         = Column(String(300), nullable=False)
    description  = Column(Text, nullable=True)
    sku          = Column(String(100), nullable=True)
    images       = Column(JSONB, nullable=True, default=list)
    wholesale_price = Column(Numeric(12, 2), nullable=False, default=0)
    retail_price    = Column(Numeric(12, 2), nullable=True)
    moq          = Column(Integer, nullable=False, default=1)
    stock        = Column(Integer, nullable=True)
    unit         = Column(String(50), nullable=False, default="pcs")
    show_in_pos         = Column(Boolean, nullable=False, default=False)
    show_in_thedersi    = Column(Boolean, nullable=False, default=False)
    show_in_storefront  = Column(Boolean, nullable=False, default=False)
    is_active    = Column(Boolean, nullable=False, default=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    updated_at   = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class WholesaleBuyer(Base):
    __tablename__ = "wholesale_buyers"

    id       = Column(Integer, primary_key=True, index=True)
    shop_id  = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False)
    name     = Column(String(200), nullable=False)
    email    = Column(String(200), nullable=True)
    phone    = Column(String(50), nullable=True)
    company  = Column(String(200), nullable=True)
    address  = Column(Text, nullable=True)
    notes    = Column(Text, nullable=True)
    token    = Column(String(64), unique=True, nullable=False, index=True)
    is_active      = Column(Boolean, nullable=False, default=True)
    total_orders   = Column(Integer, nullable=False, default=0)
    total_spent    = Column(Numeric(14, 2), nullable=False, default=0)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())

    orders = relationship("WholesaleOrder", back_populates="buyer", lazy="select")


class WholesaleOrder(Base):
    __tablename__ = "wholesale_orders"

    id           = Column(Integer, primary_key=True, index=True)
    shop_id      = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False)
    buyer_id     = Column(Integer, ForeignKey("wholesale_buyers.id", ondelete="SET NULL"), nullable=True)
    order_number = Column(String(30), unique=True, nullable=False)
    items        = Column(JSONB, nullable=False, default=list)
    subtotal     = Column(Numeric(14, 2), nullable=False, default=0)
    discount     = Column(Numeric(14, 2), nullable=False, default=0)
    total        = Column(Numeric(14, 2), nullable=False, default=0)
    # pending | confirmed | fulfilled | cancelled
    status       = Column(String(20), nullable=False, default="pending")
    notes        = Column(Text, nullable=True)
    quotation_id = Column(Integer, nullable=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    updated_at   = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    buyer = relationship("WholesaleBuyer", back_populates="orders", lazy="joined")
