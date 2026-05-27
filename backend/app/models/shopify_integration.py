"""Shopify Integration models."""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base


class ShopifyStore(Base):
    __tablename__ = "shopify_stores"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False, unique=True)
    shopify_domain = Column(String(255), nullable=False)  # e.g. mystore.myshopify.com
    access_token = Column(Text, nullable=True)
    scope = Column(Text, nullable=True)
    is_connected = Column(Boolean, default=False)
    shop_name = Column(String(255), nullable=True)
    shop_email = Column(String(255), nullable=True)
    plan_name = Column(String(100), nullable=True)
    currency = Column(String(10), nullable=True)
    # Sync settings
    sync_products = Column(Boolean, default=True)
    sync_orders = Column(Boolean, default=True)
    sync_inventory = Column(Boolean, default=True)
    # Sync status
    last_product_sync = Column(DateTime(timezone=True), nullable=True)
    last_order_sync = Column(DateTime(timezone=True), nullable=True)
    products_synced = Column(Integer, default=0)
    orders_synced = Column(Integer, default=0)
    sync_errors = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    shop = relationship("Shop", backref="shopify_store")


class ShopifyWebhook(Base):
    __tablename__ = "shopify_webhooks"

    id = Column(Integer, primary_key=True, index=True)
    shopify_store_id = Column(Integer, ForeignKey("shopify_stores.id"), nullable=False)
    shopify_webhook_id = Column(String(100), nullable=True)
    topic = Column(String(100), nullable=False)  # orders/create, products/update, etc.
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    store = relationship("ShopifyStore", backref="webhooks")


class ShopifySyncLog(Base):
    __tablename__ = "shopify_sync_logs"

    id = Column(Integer, primary_key=True, index=True)
    shopify_store_id = Column(Integer, ForeignKey("shopify_stores.id"), nullable=False)
    sync_type = Column(String(50), nullable=False)  # products, orders, inventory
    direction = Column(String(20), nullable=False)  # push, pull, bidirectional
    status = Column(String(20), nullable=False)  # success, partial, failed
    records_processed = Column(Integer, default=0)
    records_failed = Column(Integer, default=0)
    error_details = Column(Text, nullable=True)
    started_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime(timezone=True), nullable=True)

    store = relationship("ShopifyStore", backref="sync_logs")
