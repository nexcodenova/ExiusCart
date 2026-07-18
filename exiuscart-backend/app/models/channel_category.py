from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, UniqueConstraint
from app.core.database import Base


class ChannelCategory(Base):
    """Cached category list fetched from a connected channel (TheDersi etc.)"""
    __tablename__ = "channel_categories"

    id = Column(Integer, primary_key=True, index=True)
    channel_connection_id = Column(Integer, ForeignKey("channel_connections.id"), nullable=False)
    channel_category_id = Column(String(100), nullable=False)  # TheDersi's own category ID/slug
    name = Column(String(255), nullable=False)                  # "Festival Wear"
    parent_id = Column(String(100), nullable=True)              # for nested categories

    __table_args__ = (
        UniqueConstraint("channel_connection_id", "channel_category_id", name="uq_conn_cat"),
    )


class ProductChannelCategory(Base):
    """Per-product, per-channel-connection listing state: is this product
    listed on this channel at all (is_listed), is it flagged as a gift item
    on this channel (is_gift), and — for channels that have a category
    concept (TheDersi, Daraz) — which category. Channels with no category
    concept (Shopify, Custom Website) just use is_listed/is_gift with the
    category fields left null."""
    __tablename__ = "product_channel_categories"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    channel_connection_id = Column(Integer, ForeignKey("channel_connections.id"), nullable=False)
    is_listed = Column(Boolean, default=False, server_default="false", nullable=False)
    is_gift = Column(Boolean, default=False, server_default="false", nullable=False)
    channel_category_id = Column(String(100), nullable=True)           # TheDersi/Daraz category ID
    channel_category_name = Column(String(255), nullable=True)          # "Festival Wear"
    channel_sub_category_id = Column(String(100), nullable=True)       # TheDersi sub-category ID
    channel_sub_category_name = Column(String(255), nullable=True)     # "Summer Dresses"

    __table_args__ = (
        UniqueConstraint("product_id", "channel_connection_id", name="uq_product_conn_cat"),
    )
