from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class ShopField(Base):
    """Custom product fields defined by each shop owner, optionally scoped to a category."""
    __tablename__ = "shop_fields"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)  # NULL = applies to all categories

    # Field definition
    label = Column(String(100), nullable=False)       # "Brand", "Storage", "Expiry Date"
    field_key = Column(String(100), nullable=False)   # "brand", "storage", "expiry_date"
    field_type = Column(String(50), nullable=False)   # text | number | dropdown | date | toggle | multiselect
    options = Column(JSON, nullable=True)              # ["S","M","L","XL"] for dropdown/multiselect
    is_required = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    shop = relationship("Shop", back_populates="fields")


class ProductAttribute(Base):
    """Actual values of custom fields per product."""
    __tablename__ = "product_attributes"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    field_key = Column(String(100), nullable=False)
    value = Column(Text, nullable=True)               # stored as string/JSON string

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    product = relationship("Product", back_populates="attributes")


class ProductImage(Base):
    """Up to 6 images per product, stored as URLs."""
    __tablename__ = "product_images"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)

    url = Column(String(1000), nullable=False)        # S3/Cloudinary/VPS URL
    alt_text = Column(String(255), nullable=True)
    sort_order = Column(Integer, default=0)           # 0 = primary image
    is_primary = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    product = relationship("Product", back_populates="images")


class ProductVideo(Base):
    """Seller-pasted YouTube/TikTok links — up to 6 per product. thumbnail_url/
    title/embed_html come from that platform's own oEmbed lookup (see
    app/core/video_oembed.py), fetched once server-side and cached here, so
    every storefront gets a ready thumbnail without talking to YouTube/TikTok
    itself."""
    __tablename__ = "product_videos"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)

    url = Column(String(1000), nullable=False)          # the link the seller pasted
    platform = Column(String(20), nullable=False)         # "youtube" | "tiktok"
    thumbnail_url = Column(String(1000), nullable=True)
    title = Column(String(500), nullable=True)
    embed_html = Column(Text, nullable=True)              # oEmbed's ready-to-use embed snippet
    sort_order = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    product = relationship("Product", back_populates="videos")
