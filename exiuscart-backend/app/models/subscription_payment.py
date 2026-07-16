from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class SubscriptionPayment(Base):
    """
    One row per confirmed payment — the single source of truth for 'did this shop
    actually pay this cycle'. Created either by a Lemon Squeezy webhook (real charge)
    or by a manual admin approval (offline payment, e.g. bank transfer).

    Affiliate commissions are generated from these rows, never from a blind timer —
    a commission can only exist if a real payment record backs it.
    """
    __tablename__ = "subscription_payments"

    id = Column(Integer, primary_key=True, index=True)
    subscription_id = Column(Integer, ForeignKey("subscriptions.id"), nullable=False)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False, index=True)

    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(10), default="AED")
    plan_type = Column(String(20), nullable=False)     # snapshot at time of payment
    billing_type = Column(String(20), nullable=False)  # monthly | yearly, snapshot

    source = Column(String(20), nullable=False, default="manual")  # lemon_squeezy | manual
    lemon_squeezy_order_id = Column(String(100), unique=True, nullable=True, index=True)
    lemon_squeezy_subscription_id = Column(String(100), nullable=True, index=True)

    confirmed_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    refunded_at = Column(DateTime(timezone=True), nullable=True)

    subscription = relationship("Subscription")
    shop = relationship("Shop")
