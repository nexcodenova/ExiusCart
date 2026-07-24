from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    image_url = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Foreign Keys
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)
    parent_id = Column(Integer, ForeignKey("categories.id"), nullable=True)

    # Relationships
    shop = relationship("Shop", back_populates="categories")
    products = relationship("Product", back_populates="category")
    children = relationship("Category", back_populates="parent", cascade="all, delete-orphan")
    parent = relationship("Category", back_populates="children", remote_side="Category.id")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    sku = Column(String(100), nullable=True)
    barcode = Column(String(100), nullable=True)
    price = Column(Numeric(10, 2), nullable=False)
    compare_at_price = Column(Numeric(10, 2), nullable=True)  # original price before discount
    cost_price = Column(Numeric(10, 2), nullable=True)
    quantity = Column(Integer, default=0)
    low_stock_threshold = Column(Integer, default=5)
    image_url = Column(String(500), nullable=True)
    size_chart_url = Column(String(500), nullable=True)  # optional — one size chart image per product
    video_url = Column(String(500), nullable=True)   # short product video (TikTok-style)
    source_url = Column(String(1000), nullable=True) # supplier source link (AliExpress, CJ, etc.)

    # Prodora catalog — winning-product research metrics, all optional/admin-entered.
    # Never fabricated: frontend hides a metric entirely when its column is null.
    winning_score = Column(Integer, nullable=True)          # 0-100
    trend_percent = Column(Numeric(6, 2), nullable=True)    # e.g. +68.00
    competition_level = Column(String(20), nullable=True)   # "Low" / "Medium" / "High"
    saturation_level = Column(String(20), nullable=True)    # "Low" / "Medium" / "High"
    orders_count = Column(Integer, nullable=True)
    supplier_name = Column(String(255), nullable=True)
    supplier_rating = Column(Numeric(3, 2), nullable=True)  # e.g. 4.80
    fulfillment_rate = Column(Numeric(5, 2), nullable=True) # e.g. 99.20 (%)
    processing_time = Column(String(50), nullable=True)     # e.g. "1-3 Days"
    shipping_time = Column(String(50), nullable=True)       # e.g. "7-12 Days"
    warehouse_country = Column(String(100), nullable=True)
    shipping_cost = Column(Numeric(10, 2), nullable=True)   # per-unit, for the cost/profit breakdown
    demand_trend_json = Column(Text, nullable=True)   # [{label, value}, ...] admin-entered trend points
    top_countries_json = Column(Text, nullable=True)  # [{country, code, percent}, ...] admin-entered
    ad_facebook_url = Column(String(1000), nullable=True)
    ad_tiktok_url = Column(String(1000), nullable=True)
    ad_instagram_url = Column(String(1000), nullable=True)
    ad_pinterest_url = Column(String(1000), nullable=True)
    specs_json = Column(Text, nullable=True)                 # free-form key/value spec pairs, JSON-encoded
    tags = Column(String(500), nullable=True)                # comma-separated feature tags
    is_active = Column(Boolean, default=True)
    is_featured = Column(Boolean, default=False)
    is_trending = Column(Boolean, default=False)     # pinned to "Trending" section
    list_on_marketplace = Column(Boolean, default=True, server_default="true")  # push to TheDersi/marketplace channels (off = POS/local only)
    is_bundle = Column(Boolean, default=False, server_default="false", nullable=False)
    is_gift = Column(Boolean, default=False, server_default="false", nullable=False)  # TheDersi-specific: offered as a free gift at TheDersi checkout
    pos_enabled = Column(Boolean, default=True, server_default="true", nullable=False)  # available for in-store POS sale
    pos_is_gift = Column(Boolean, default=False, server_default="false", nullable=False)  # marked as a gift item specifically for POS
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Foreign Keys
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)

    # Relationships
    shop = relationship("Shop", back_populates="products")
    category = relationship("Category", back_populates="products")
    supplier = relationship("Supplier", foreign_keys=[supplier_id])
    order_items = relationship("OrderItem", back_populates="product")
    attributes = relationship("ProductAttribute", back_populates="product", cascade="all, delete-orphan")
    images = relationship("ProductImage", back_populates="product", cascade="all, delete-orphan", order_by="ProductImage.sort_order")
    variants = relationship("ProductVariant", back_populates="product", cascade="all, delete-orphan")
    reservations = relationship("Reservation", back_populates="product")
