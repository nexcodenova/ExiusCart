from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Numeric, Text
from sqlalchemy.sql import func
from app.core.database import Base

# Honest v1 scope: none of CJ/HyperSKU/Printful/AliExpress expose a real
# RMA API here, so this is a manual tracking log the seller updates by hand
# as they work a return with the supplier — not an automated submission.
# Real order/dropship-order links, real timestamps; the status is just
# operator-entered rather than pulled from a supplier webhook.


class SupplierReturn(Base):
    __tablename__ = "supplier_returns"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, index=True)
    dropship_order_id = Column(Integer, ForeignKey("dropship_orders.id"), nullable=True)
    supplier_type = Column(String(20), nullable=False)
    reason = Column(Text, nullable=False)
    # requested -> approved -> shipped_back -> refunded, or rejected at any point
    status = Column(String(20), nullable=False, default="requested")
    refund_amount = Column(Numeric(10, 2), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
