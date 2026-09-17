from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Numeric, Index, text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum


class PlanType(str, enum.Enum):
    FREE_TRIAL = "free_trial"
    THEDERSI_FREE_FOREVER = "thedersi_free_forever"
    THEDERSI_LITE = "thedersi_lite"
    # TheDersi's "Pro" tier maps to LAUNCH below (with is_thedersi_pro_shop()
    # in app/core/thedersi.py layering Pro-specific restrictions on top) and
    # "Official" maps to SCALE — neither gets its own PlanType value.
    # ExiusCart's own three plans. Named exactly as shown on the pricing
    # page — never "starter"/"premium" anywhere in this codebase, so the
    # plan name in code, the DB, and what the user sees always match.
    LAUNCH = "launch"
    GROWTH = "growth"
    SCALE = "scale"


class BillingType(str, enum.Enum):
    MONTHLY = "monthly"
    YEARLY = "yearly"


class SubscriptionStatus(str, enum.Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    CANCELLED = "cancelled"
    # Launch: TRIAL (7 days free, no card) -> ACTIVE (full price directly).
    # Growth/Scale (no free week): TRIAL_DOLLAR ($1, 7 days) -> ACTIVE (full price).
    TRIAL = "trial"
    TRIAL_DOLLAR = "trial_dollar"
    PENDING_APPROVAL = "pending_approval"


class Plan(Base):
    __tablename__ = "plans"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)  # starter, business, pro
    max_products = Column(Integer, nullable=False)
    max_users = Column(Integer, nullable=False)
    features = Column(String(1000), nullable=True)  # JSON string of features
    is_active = Column(Boolean, default=True)


class Subscription(Base):
    __tablename__ = "subscriptions"
    __table_args__ = (
        # Partial unique index — only enforced when set, since most
        # subscriptions aren't billed through Lemon Squeezy at all.
        Index(
            "ix_subscriptions_ls_sub_id",
            "lemon_squeezy_subscription_id",
            unique=True,
            postgresql_where=text("lemon_squeezy_subscription_id IS NOT NULL"),
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    plan_type = Column(String(20), nullable=False)
    billing_type = Column(String(20), nullable=False)  # one_time or monthly
    status = Column(String(20), default=SubscriptionStatus.TRIAL.value)
    amount_paid = Column(Numeric(10, 2), nullable=True)
    currency = Column(String(10), default="AED")
    promo_code = Column(String(50), nullable=True)
    discount_percent = Column(Integer, default=0)
    # trial_ends_at: end of Launch's free 7-day phase (no card required up
    # to here; Launch has no $1 stage — goes straight to full price after).
    # trial_dollar_ends_at: end of Growth/Scale's $1 phase (7 days, no free
    # week beforehand). Both null for a subscription that was never on a
    # trial (e.g. TheDersi-provisioned).
    trial_ends_at = Column(DateTime(timezone=True), nullable=True)
    trial_dollar_ends_at = Column(DateTime(timezone=True), nullable=True)
    starts_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Lemon Squeezy payment gateway linkage — set when this subscription is billed
    # through Lemon Squeezy rather than manually approved by an admin.
    payment_source = Column(String(20), default="manual")  # manual | lemon_squeezy
    lemon_squeezy_subscription_id = Column(String(100), nullable=True)
    lemon_squeezy_customer_id = Column(String(100), nullable=True)

    # Foreign Keys
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)
    plan_id = Column(Integer, ForeignKey("plans.id"), nullable=True)

    # Relationships
    shop = relationship("Shop", back_populates="subscription")
