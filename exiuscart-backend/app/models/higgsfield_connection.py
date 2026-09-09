from sqlalchemy import Column, Integer, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class HiggsfieldConnection(Base):
    """The seller's OWN Higgsfield account credentials — BYOK, not a
    platform-wide key. Switched from a shared HIGGSFIELD_API_KEY_ID/SECRET
    env var to this per-shop model: at Higgsfield's real pricing (Veo 3.1
    runs ~$1.90-$4.40/video even on their cheapest plan), ExiusCart paying
    centrally and reselling at a flat fee risks losing money on any seller
    who generates more than a handful of videos a month. Same shape as
    HyperSKU's own connection — the seller signs up for their own Higgsfield
    plan (through ExiusCart's affiliate link, 25% commission for 12 months),
    ExiusCart never touches the underlying API cost."""
    __tablename__ = "higgsfield_connections"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True, unique=True)
    api_key_id_enc = Column(Text, nullable=False)      # Fernet-encrypted (app/core/encryption.py)
    api_key_secret_enc = Column(Text, nullable=False)  # Fernet-encrypted
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    shop = relationship("Shop")
