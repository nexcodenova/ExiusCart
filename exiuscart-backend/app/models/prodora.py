from sqlalchemy import Column, Integer, ForeignKey, DateTime
from sqlalchemy.sql import func
from app.core.database import Base


class ProdoraImportLog(Base):
    """One row per Prodora product import — a ledger, not a counter, so a
    shop's monthly import count (Starter: 50/month, Premium: unlimited —
    see import_shopping_product in shopping.py) can be computed by counting
    rows in the current month rather than trusting a single mutable number."""
    __tablename__ = "prodora_import_logs"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)
    product_id = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
