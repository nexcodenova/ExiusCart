from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from app.core.database import Base


class ActivityLog(Base):
    """A real, append-only feed of order/payment lifecycle events per shop —
    powers the Orders page's Recent Activity panel. Deliberately narrow:
    not a general audit log (no login/settings-change events), just the
    handful of moments a seller actually wants to glance at — new order,
    payment received, shipped, delivered, cancelled.

    Coverage note: written from POS/manual order creation, Custom Website
    checkout, the generic connected-channel webhook (TheDersi/Wix/Noon/
    Custom's own webhook path), and every order status change made through
    the dashboard (cancel/ship/deliver) — which covers status changes for
    orders from every channel, since they all go through those same
    endpoints. The handful of channels with their own pull-sync integration
    file (eBay, Daraz, Etsy, TikTok, Whop, Gumroad, WooCommerce,
    BigCommerce) don't yet log their own order-creation moment here — only
    what happens to those orders afterwards, through the dashboard.
    """
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False, index=True)
    # order_created | payment_received | order_shipped | order_delivered | order_cancelled
    event_type = Column(String(30), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(String(300), nullable=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
