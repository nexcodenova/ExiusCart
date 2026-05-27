from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.sql import func
from app.core.database import Base


class Lead(Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    shop_name = Column(String(255), nullable=True)
    phone = Column(String(30), nullable=True)
    email = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    business_type = Column(String(100), nullable=True)  # mobile, grocery, abaya, etc.
    notes = Column(Text, nullable=True)
    status = Column(String(30), default="new")  # new | contacted | demo | converted | lost
    source = Column(String(50), default="manual")  # manual | website | whatsapp | referral
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
