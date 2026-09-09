from sqlalchemy import Column, Integer, String, Text, Numeric, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class ProdoraDigitalBundle(Base):
    """A digital design pack (coloring book PDF, POD design set, etc.) that
    ExiusCart itself creates and sells to sellers through Prodora — same
    curation spirit as Prodora's physical winning-products, but there's no
    supplier to import from since ExiusCart made this one. Two files per
    bundle: an editable source (the seller customizes it) and a finished
    PDF/ebook (ready to resell as-is) — a seller gets both once they buy.

    Sold through ExiusCart's OWN Whop store (not a seller's — see
    prodora_digital.py's platform-level webhook), unlike every other Whop
    usage in this codebase, which is a seller selling through THEIR OWN
    connected Whop account."""
    __tablename__ = "prodora_digital_bundles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    cover_image_url = Column(Text, nullable=True)

    editable_file_url = Column(Text, nullable=True)  # source files the seller can customize
    pdf_file_url = Column(Text, nullable=True)        # finished, ready-to-resell PDF/ebook

    price = Column(Numeric(10, 2), nullable=False)                    # what the seller pays ExiusCart
    suggested_resale_price = Column(Numeric(10, 2), nullable=True)    # guidance only, not enforced
    resale_notes = Column(Text, nullable=True)                        # "where to sell this" guidance

    # Same social-proof pattern as Product's own winning-metrics fields —
    # Facebook/Instagram can be searched live via the existing Meta Ad
    # Library integration; TikTok/Pinterest are pasted manually.
    ad_facebook_url = Column(String(1000), nullable=True)
    ad_tiktok_url = Column(String(1000), nullable=True)
    ad_instagram_url = Column(String(1000), nullable=True)
    ad_pinterest_url = Column(String(1000), nullable=True)

    whop_checkout_url = Column(Text, nullable=True)
    whop_product_id = Column(String(100), nullable=True)  # matched against the platform webhook payload, best-effort — see prodora_digital.py

    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    purchases = relationship("ProdoraDigitalPurchase", back_populates="bundle", cascade="all, delete-orphan")


class ProdoraDigitalPurchase(Base):
    """One row per shop that's bought a bundle — the ledger the 'already
    purchased' badge and download/import access check against. shop_id, not
    user_id: access belongs to the store, not whoever happened to click buy."""
    __tablename__ = "prodora_digital_purchases"

    id = Column(Integer, primary_key=True, index=True)
    bundle_id = Column(Integer, ForeignKey("prodora_digital_bundles.id", ondelete="CASCADE"), nullable=False, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    whop_payment_id = Column(String(100), nullable=True, unique=True)  # idempotency — Whop can retry a webhook delivery
    purchased_at = Column(DateTime(timezone=True), server_default=func.now())

    bundle = relationship("ProdoraDigitalBundle", back_populates="purchases")
    shop = relationship("Shop")
