from sqlalchemy import Column, Integer, String, Numeric, Text, Date, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Quotation(Base):
    __tablename__ = "quotations"
    __table_args__ = (UniqueConstraint("shop_id", "quote_number", name="uq_quotations_shop_quote_number"),)

    id = Column(Integer, primary_key=True, index=True)
    quote_number = Column(String(30), nullable=False)
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False)

    customer_name = Column(String(200), nullable=False)
    customer_email = Column(String(200), nullable=True)
    customer_phone = Column(String(50), nullable=True)

    # [{product_id, name, sku, quantity_available, qty, unit_price, total}]
    items = Column(JSONB, nullable=False, default=list)

    subtotal = Column(Numeric(12, 2), nullable=False, default=0)
    discount = Column(Numeric(12, 2), nullable=False, default=0)
    tax = Column(Numeric(12, 2), nullable=False, default=0)
    total = Column(Numeric(12, 2), nullable=False, default=0)
    notes = Column(Text, nullable=True)
    terms = Column(Text, nullable=True)
    tax_rate = Column(Numeric(5, 2), nullable=False, default=0, server_default='0')
    tax_type = Column(String(10), nullable=False, default='fixed', server_default="'fixed'")
    payment_schedule = Column(JSONB, nullable=True)
    company_address = Column(Text, nullable=True)
    company_trn = Column(String(100), nullable=True)
    company_bank = Column(Text, nullable=True)
    client_token = Column(String(64), unique=True, nullable=True, index=True)
    client_accepted_at = Column(DateTime(timezone=True), nullable=True)
    client_accepted_name = Column(String(200), nullable=True)

    status = Column(String(20), nullable=False, default="pending")
    valid_until = Column(Date, nullable=False)
    reminder_count = Column(Integer, nullable=False, default=0, server_default="0")
    last_reminded_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    shop = relationship("Shop", lazy="joined")
