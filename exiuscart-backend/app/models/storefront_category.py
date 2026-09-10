from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

# "Your own store" channels — the seller controls the whole storefront, so
# ExiusCart owns the category tree. Marketplace channels (TheDersi/Daraz/
# Noon/eBay) keep their own category systems (ChannelCategory/
# ProductChannelCategory) and are shown read-only on the dashboard.
STOREFRONT_CATEGORY_CHANNELS = ("custom", "shopify", "wix", "woocommerce", "bigcommerce")

# Marketplace channels whose categories are synced from their side and shown
# read-only in the Storefront Categories screen.
READ_ONLY_CATEGORY_CHANNELS = ("thedersi", "daraz", "noon", "ebay")


class StorefrontCategory(Base):
    """A shop's customer-facing category list for a channel that has no
    category system of its own (Custom Website, Shopify, Wix, WooCommerce,
    BigCommerce) — separate from Category (app/models/product.py), which is
    generic internal product organization unrelated to what a storefront
    shows shoppers."""
    __tablename__ = "storefront_categories"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)
    channel_type = Column(String(20), nullable=False)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=False)
    icon_url = Column(String(500), nullable=True)
    sort_order = Column(Integer, default=0)
    # Self-referential — Main (parent_id=None) → Sub (parent_id=Main.id) →
    # Sub-sub (parent_id=Sub.id). Same pattern as the existing generic
    # Category model in app/models/product.py, no depth limit enforced at
    # the DB level, though the dashboard UI only offers 3 levels.
    parent_id = Column(Integer, ForeignKey("storefront_categories.id"), nullable=True)

    # Draft = kept in the dashboard but hidden from the live storefront.
    is_published = Column(Boolean, default=True, server_default="true", nullable=False)
    # "nav_and_grid" (menu + category grid) | "nav_only" | "hidden"
    visibility = Column(String(20), default="nav_and_grid", server_default="nav_and_grid", nullable=False)
    # Surface this category on the storefront homepage.
    is_featured = Column(Boolean, default=False, server_default="false", nullable=False)
    seo_title = Column(String(80), nullable=True)
    seo_description = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    children = relationship("StorefrontCategory", back_populates="parent", cascade="all, delete-orphan")
    parent = relationship("StorefrontCategory", back_populates="children", remote_side="StorefrontCategory.id")

    __table_args__ = (
        UniqueConstraint("shop_id", "channel_type", "slug", name="uq_storefront_cat_shop_channel_slug"),
    )
