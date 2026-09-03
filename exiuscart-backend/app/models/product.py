from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Numeric, JSON
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

    # Digital products — no shipping, no stock tracking (quantity gets set
    # to a large sentinel at creation, same "always available" convention
    # Printful POD products already use). Delivery is a single file, not a
    # license-key pool — see DigitalDelivery (app/models/digital_delivery.py)
    # for the per-order access-code-gated download link this powers.
    product_type = Column(String(20), default="physical", server_default="physical", nullable=False)  # "physical" | "digital" | "affiliate"
    digital_file_url = Column(String(1000), nullable=True)
    digital_file_name = Column(String(255), nullable=True)  # original filename, shown to the buyer
    # Affiliate products — no cart, no checkout, no order in ExiusCart at
    # all. The storefront shows affiliate_cta_text as the button (falls
    # back to "Buy Now" if blank) instead of "Add to Cart", linking
    # straight to affiliate_url. Same "always available" quantity
    # sentinel as digital products — nothing to ship or count down.
    affiliate_url = Column(String(1000), nullable=True)
    affiliate_cta_text = Column(String(60), nullable=True)
    # Optional per-product override for the delivery email — see
    # send_digital_product_email (app/core/email.py). Null = the default
    # subject/greeting is used; the rest of the branded email (header,
    # access-code box, download button, footer) is never customizable,
    # only the subject line and the greeting/message text, to keep the
    # access-code delivery mechanism itself consistent and trustworthy.
    digital_email_subject = Column(String(255), nullable=True)
    digital_email_message = Column(Text, nullable=True)

    # Product page FAQ — [{question, answer}, ...], seller-written, shown on
    # the storefront product page below the description. Same JSON-column
    # pattern as custom_field_values, not the admin-only *_json Text columns
    # above (those are Prodora catalog data, entered through admin.py only).
    faq = Column(JSON, nullable=True)
    # Physical-product shipping/returns blurb ("Ships in 2-3 days, 7-day
    # returns") — free text, seller's own words, shown on the storefront
    # product page. Not type-restricted at the model/API level (an affiliate
    # or digital seller could theoretically use the field for something
    # else), but the dashboard only shows the field for physical products.
    shipping_note = Column(Text, nullable=True)
    # Optional structured delivery/fulfillment steps — ["Order confirmed",
    # "Packed", "Shipped", ...], rendered as a connected arrow-flow on the
    # storefront product page instead of a paragraph. Separate from
    # shipping_note above rather than replacing it: sellers who already
    # wrote a plain-text note keep it working, this is an opt-in upgrade.
    # Null/empty = storefront falls back to shipping_note.
    shipping_steps = Column(JSON, nullable=True)

    # SEO focus keywords the seller is targeting for this product —
    # ["wireless earbuds", "bluetooth headphones", ...]. Not rendered as a
    # legacy <meta name="keywords"> tag (Google stopped using that for
    # ranking around 2009) — the storefront app uses these to help build
    # the actual meta title/description and schema.org Product data, which
    # is where keyword targeting still matters for search and AI crawlers.
    seo_keywords = Column(JSON, nullable=True)

    # Short per-product highlight facts shown under the price — [{icon,
    # label}, ...], e.g. {"icon": "calendar", "label": "1 Year Access"} or
    # {"icon": "truck", "label": "Ships in 24h"}. Physical and digital both
    # (unlike shipping_note/shipping_steps above, not restricted to
    # physical — a digital product benefits just as much, e.g. "Delivered
    # by Email"). `icon` is one of a fixed key set (see
    # PRODUCT_HIGHLIGHT_ICONS in schemas/product.py) so every consuming
    # storefront can map it to a real icon component instead of trusting
    # arbitrary seller input.
    highlights = Column(JSON, nullable=True)

    # Real, earned social proof for products with no reviews yet — never
    # fabricated. view_count increments on every real product-detail page
    # load (raw hits, not unique visitors — see public_store_product_detail
    # in public.py); units_sold increments wherever stock already decrements
    # on a real sale (same "counts as sold" moment used throughout the order
    # pipeline, not a separately-invented definition).
    view_count = Column(Integer, default=0, server_default="0", nullable=False)
    units_sold = Column(Integer, default=0, server_default="0", nullable=False)

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
    orders_trend_json = Column(Text, nullable=True)   # [{label, value}, ...] admin-entered orders-over-time points (separate signal from demand_trend_json)
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
    # Values for whatever extra fields the seller defined for the Custom
    # Website channel (see CustomProductFieldSettings) — {field_id: value}.
    # A "quantity_tiers" field's value is itself a list of
    # {quantity, price} rows, read directly by checkout.py to price an
    # order line instead of always using `price` above.
    custom_field_values = Column(JSON, nullable=True)
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
    videos = relationship("ProductVideo", back_populates="product", cascade="all, delete-orphan", order_by="ProductVideo.sort_order")
    variants = relationship("ProductVariant", back_populates="product", cascade="all, delete-orphan")
    reservations = relationship("Reservation", back_populates="product")
