from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, SmallInteger
from sqlalchemy.sql import func
from app.core.database import Base


class ProductReview(Base):
    """
    One row = one product review request/submission.
    Created with status='requested' when an order is marked delivered.
    Customer submits via the public token link -> status='pending'.
    Seller moderates -> status='approved' (shown on storefront) or 'rejected'.
    """
    __tablename__ = "product_reviews"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)

    customer_name = Column(String(255), nullable=True)
    customer_email = Column(String(255), nullable=True)

    rating = Column(SmallInteger, nullable=True)   # 1-5, set on submission
    comment = Column(Text, nullable=True)
    photo_url = Column(String(1000), nullable=True)

    status = Column(String(20), nullable=False, default="requested")  # requested | pending | approved | rejected
    token = Column(String(64), unique=True, nullable=False, index=True)

    # Which sales channel the underlying order came from (order.source at
    # request time — "custom", "pos", "shopify", etc). Lets the Reviews page
    # show/filter where a review actually originated, and is the anchor
    # point for pulling in channel-native reviews (e.g. TheDersi) later —
    # those would land here with their own channel_source instead of going
    # through the request/token flow at all.
    channel_source = Column(String(30), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    submitted_at = Column(DateTime(timezone=True), nullable=True)
