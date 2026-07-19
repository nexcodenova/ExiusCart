from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Numeric, Enum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum


class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    PROCESSING = "processing"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"
    REFUNDED = "refunded"


class OrderSource(str, enum.Enum):
    POS = "pos"
    WHATSAPP = "whatsapp"
    ONLINE = "online"
    SHOPIFY = "shopify"
    CHANNEL = "channel"


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String(50), unique=True, index=True, nullable=False)
    reference = Column(String(200), nullable=True, index=True)  # external ID e.g. SHOPIFY-123456
    status = Column(String(20), default=OrderStatus.PENDING.value)
    payment_status = Column(String(20), default=PaymentStatus.PENDING.value)
    source = Column(String(20), default=OrderSource.POS.value)
    subtotal = Column(Numeric(10, 2), nullable=False)
    tax_amount = Column(Numeric(10, 2), default=0)
    discount_amount = Column(Numeric(10, 2), default=0)
    total = Column(Numeric(10, 2), nullable=False)
    notes = Column(Text, nullable=True)
    shipping_address = Column(Text, nullable=True)
    gift_wrap = Column(Boolean, default=False)
    gift_wrap_fee = Column(Numeric(10, 2), default=0)
    gift_message = Column(Text, nullable=True)
    # Shipment tracking
    tracking_number = Column(String(200), nullable=True)
    carrier = Column(String(100), nullable=True)        # "DHL", "FedEx", "Kapruka", etc.
    delivery_charge = Column(Numeric(10, 2), nullable=True)  # what customer pays for delivery (set at ship time)
    shipped_at = Column(DateTime(timezone=True), nullable=True)
    estimated_delivery = Column(String(50), nullable=True)  # e.g. "2026-06-15"
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Foreign Keys
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)

    # Relationships
    shop = relationship("Shop", back_populates="orders")
    customer = relationship("Customer", back_populates="orders")
    items = relationship("OrderItem", back_populates="order")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    product_name = Column(String(500), nullable=True)  # snapshot at time of sale
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)
    total_price = Column(Numeric(10, 2), nullable=False)
    is_gift = Column(Boolean, default=False, server_default="false", nullable=False)  # free gift item from TheDersi checkout — always $0, still pack & ship
    # For a bundle item: which specific variant the buyer picked per component
    # — [{component_product_id, variant_id}]. Set by the channel at order time
    # (e.g. TheDersi); null/empty for non-bundle items or components with no
    # size/color choice. Kept on the order item itself (not just the webhook
    # payload) so a later payment-status change can still deduct the right
    # variant's stock, and so packing slips show exactly what to ship.
    bundle_selections = Column(JSONB, nullable=True)

    # Foreign Keys
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)  # nullable so product can be deleted without losing order history

    # Relationships
    order = relationship("Order", back_populates="items")
    product = relationship("Product", back_populates="order_items")
