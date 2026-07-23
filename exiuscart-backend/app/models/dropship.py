from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Numeric, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class DropshipConnection(Base):
    __tablename__ = "dropship_connections"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)
    supplier_type = Column(String(20), nullable=False)  # cj / zendrop / hypersku / wiio
    # Legacy — CJ's email+password login API was deprecated in favor of
    # apiKey mode (confirmed live, 2026-07-23); no longer written, kept only
    # so any pre-existing connections don't lose their column on migration.
    supplier_email = Column(String(255), nullable=True)
    supplier_password_enc = Column(Text, nullable=True)
    access_token = Column(Text, nullable=True)                  # CJ access token (all suppliers use api_key to get one)
    token_expires_at = Column(DateTime(timezone=True), nullable=True)
    api_key = Column(Text, nullable=True)                       # CJ / Zendrop / HyperSKU / Wiio — Fernet-encrypted (app/core/encryption.py)
    is_active = Column(Boolean, default=True)
    auto_fulfill_enabled = Column(Boolean, default=False)       # Premium: auto-send orders to supplier
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    shop = relationship("Shop")


class DropshipProductLink(Base):
    __tablename__ = "dropship_product_links"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    supplier_type = Column(String(20), nullable=False)
    supplier_product_id = Column(String(255), nullable=True)    # CJ product ID
    supplier_product_url = Column(String(1000), nullable=True)  # CJ URL pasted by seller
    supplier_sku = Column(String(255), nullable=True)           # specific variant SKU
    supplier_product_name = Column(String(500), nullable=True)  # snapshot from CJ
    cost_price = Column(Numeric(10, 2), nullable=True)
    shipping_estimate_days = Column(Integer, nullable=True)
    warehouse = Column(String(50), nullable=True)               # CN / AE / US
    is_primary = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    product = relationship("Product")
    shop = relationship("Shop")


class DropshipOrder(Base):
    __tablename__ = "dropship_orders"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    supplier_type = Column(String(20), nullable=False)
    supplier_order_id = Column(String(255), nullable=True)      # CJ's own order ID
    status = Column(String(30), default="pending")              # pending/processing/shipped/delivered/failed
    tracking_number = Column(String(255), nullable=True)
    tracking_url = Column(String(1000), nullable=True)
    carrier = Column(String(100), nullable=True)
    cost_paid = Column(Numeric(10, 2), nullable=True)
    error_message = Column(Text, nullable=True)
    shipped_at = Column(DateTime(timezone=True), nullable=True)
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    order = relationship("Order")
    shop = relationship("Shop")
