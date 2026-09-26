from sqlalchemy import Column, Integer, String, Text, Numeric, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from app.core.database import Base

KDP_STATUSES = ("not_started", "files_ready", "submitted", "live")


class KdpBook(Base):
    """One book a seller is taking to Amazon KDP. KDP has no API, so this is a
    tracker the seller moves along by hand (not_started -> files_ready ->
    submitted -> live); nothing here talks to Amazon, and the numbers are only
    what the seller typed in (royalties live in the KDP dashboard)."""
    __tablename__ = "kdp_books"
    __table_args__ = (UniqueConstraint("shop_id", "bundle_id", name="uq_kdp_books_shop_bundle"),)

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    # The purchased Prodora bundle it comes from; NULL for a book the seller brought themselves.
    bundle_id = Column(Integer, ForeignKey("prodora_digital_bundles.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(255), nullable=False)
    status = Column(String(20), nullable=False, default="not_started", server_default="not_started")
    trim = Column(String(10), nullable=False, default="8.5x11", server_default="8.5x11")
    paper = Column(String(20), nullable=False, default="white_bw", server_default="white_bw")
    amazon_url = Column(String(1000), nullable=True)
    list_price = Column(Numeric(10, 2), nullable=True)   # price set on KDP, typed by the seller
    print_cost = Column(Numeric(10, 2), nullable=True)   # from KDP's own calculator, typed by the seller
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
