from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Numeric, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Affiliate(Base):
    __tablename__ = "affiliates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    phone = Column(String(30), nullable=True)
    company = Column(String(255), nullable=True)
    website = Column(String(500), nullable=True)
    how_promote = Column(Text, nullable=True)
    referral_code = Column(String(20), unique=True, index=True, nullable=False)
    # "external" = anyone | "shop_owner" = existing ExiusCart customer (higher rates)
    affiliate_type = Column(String(20), default="external")
    status = Column(String(20), default="pending")  # pending | active | suspended
    # Tier 1: first `tier_threshold` paid referrals per calendar month
    commission_rate = Column(Numeric(5, 2), default=20.00)
    # Tier 2: after `tier_threshold` referrals in the same month
    commission_rate_tier2 = Column(Numeric(5, 2), default=35.00)
    # How many paid referrals per month before tier 2 kicks in (default 10)
    tier_threshold = Column(Integer, default=10)
    password_hash = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)  # admin notes
    # Payout details supplied by the affiliate
    payout_method = Column(String(20), nullable=True)   # paypal | skrill | payoneer
    paypal_email = Column(String(255), nullable=True)
    skrill_email = Column(String(255), nullable=True)
    payoneer_id = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    approved_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    commissions = relationship("Commission", back_populates="affiliate")


class Commission(Base):
    __tablename__ = "commissions"

    id = Column(Integer, primary_key=True, index=True)
    affiliate_id = Column(Integer, ForeignKey("affiliates.id"), nullable=False)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)
    subscription_id = Column(Integer, ForeignKey("subscriptions.id"), nullable=True)
    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(10), default="AED")
    # pending → (30d lock expires) → pending (shows as pending_approval) → approved → paid
    status = Column(String(20), default="pending")  # pending | approved | paid
    approved_at = Column(DateTime(timezone=True), nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    affiliate = relationship("Affiliate", back_populates="commissions")
    shop = relationship("Shop")
