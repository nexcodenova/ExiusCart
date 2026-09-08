from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class ProductAdVideo(Base):
    """An AI-generated product ad video (Higgsfield). Named "AdVideo", not
    "Video" — product_fields.py's own ProductVideo/product_videos table
    already exists for a different feature (seller-pasted YouTube/TikTok
    embed links), a real naming collision caught at import time, not a
    style choice. One row per generation job — a seller can generate more
    than one for the same product (different prompt/style), same "ledger
    not a single field" discipline as everything else that tracks an async
    external job in this codebase."""
    __tablename__ = "product_ad_videos"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)

    status = Column(String(20), nullable=False, default="queued")  # queued / processing / ready / failed
    model = Column(String(100), nullable=False)  # e.g. "veo3.1/image-to-video"
    prompt = Column(Text, nullable=True)
    source_image_url = Column(Text, nullable=False)  # the product photo sent to Higgsfield

    request_id = Column(String(100), nullable=True)  # Higgsfield's own job id, used for polling
    video_url = Column(Text, nullable=True)  # our own R2-hosted copy, set once ready (Higgsfield's own URL expires after 7 days)
    error_message = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

    shop = relationship("Shop")
    product = relationship("Product")
