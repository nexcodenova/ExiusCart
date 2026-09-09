from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class CheckoutAttempt(Base):
    """A shopper started checkout (gave a real email) on a custom storefront,
    with real items in cart — captured BEFORE order submission, specifically
    so cart-abandonment recovery has something to fire on. Not full
    cart-session tracking: one row per checkout-start call from the
    storefront, not a running session log.

    Powers the "cart_abandoned" DripFlow trigger (see marketing.py's
    sync_abandoned_carts_job) — `handled` is set once either a matching
    order shows up (order_id filled in) or the abandonment window has
    passed and a lead was enrolled into a recovery flow, whichever comes
    first, so this never gets reprocessed twice."""
    __tablename__ = "checkout_attempts"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    email = Column(String(255), nullable=False, index=True)
    # [{"product_id": int, "name": str, "quantity": int, "price": float}, ...]
    # Snapshotted at checkout-start time, same reasoning as OrderItem.product_name
    # — a later price/name change on the product shouldn't rewrite history.
    cart_snapshot = Column(JSON, nullable=False)

    handled = Column(Boolean, default=False, nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)  # set if a real order matched before the window ran out

    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    shop = relationship("Shop")
    order = relationship("Order")
