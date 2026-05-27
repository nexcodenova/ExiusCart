from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class ShopField(Base):
    """Custom product fields defined by each shop owner."""
    __tablename__ = "shop_fields"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)

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
