from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base


class TheDersiSeller(Base):
    """Maps TheDersi seller IDs to ExiusCart shops for webhook callbacks."""
    __tablename__ = "thedersi_sellers"

    id = Column(Integer, primary_key=True)
    thedersi_seller_id = Column(String, unique=True, index=True, nullable=False)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
