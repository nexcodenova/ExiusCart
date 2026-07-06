from sqlalchemy import Column, Integer, String, Numeric, Text, Boolean, DateTime, Date, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class RecurringInvoice(Base):
    __tablename__ = "recurring_invoices"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)

    customer_name  = Column(String(200), nullable=False)
    customer_email = Column(String(200), nullable=True)
    customer_phone = Column(String(50), nullable=True)

    # [{name, qty, unit_price, total}]
    items    = Column(JSONB, nullable=False, default=list)
    subtotal = Column(Numeric(12, 2), nullable=False, default=0)
    discount = Column(Numeric(12, 2), nullable=False, default=0)
    tax      = Column(Numeric(12, 2), nullable=False, default=0)
    total    = Column(Numeric(12, 2), nullable=False, default=0)
    notes    = Column(Text, nullable=True)

    frequency      = Column(String(20), nullable=False, default="monthly")  # weekly|monthly|quarterly|yearly
    next_send_date = Column(Date, nullable=False)
    last_sent_at   = Column(DateTime(timezone=True), nullable=True)
    send_count     = Column(Integer, nullable=False, default=0, server_default="0")
    is_active      = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    shop = relationship("Shop", lazy="select")
