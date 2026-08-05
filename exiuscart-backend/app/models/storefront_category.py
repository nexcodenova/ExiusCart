from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from app.core.database import Base

# Channels allowed here for now — TheDersi/Daraz/Noon/eBay already have
# their own category systems (ChannelCategory/ProductChannelCategory).
# Shopify and Custom Website have no storefront category concept at all
# (see channel_category.py's own comment on this), which is the actual
# gap this model fills.
STOREFRONT_CATEGORY_CHANNELS = ("shopify", "custom")


class StorefrontCategory(Base):
    """A shop's customer-facing category list for a channel that has no
    category system of its own (Shopify, Custom Website) — separate from
    Category (app/models/product.py), which is generic internal product
    organization unrelated to what a storefront shows shoppers."""
    __tablename__ = "storefront_categories"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)
    channel_type = Column(String(20), nullable=False)  # "shopify" | "custom"
    name = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=False)
    icon_url = Column(String(500), nullable=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("shop_id", "channel_type", "slug", name="uq_storefront_cat_shop_channel_slug"),
    )
