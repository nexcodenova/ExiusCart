from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from app.core.database import Base


class StorefrontPopup(Base):
    """Storefront popup/upsell shown via the embeddable widget script on a seller's website."""
    __tablename__ = "storefront_popups"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False, index=True)

    name = Column(String(200), nullable=False)               # internal label, e.g. "Summer Sale Exit Popup"
    popup_type = Column(String(30), nullable=False)          # exit_intent | announcement | email_capture | countdown

    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=True)
    button_text = Column(String(100), nullable=True)
    button_link = Column(String(500), nullable=True)
    discount_code = Column(String(50), nullable=True)
    image_url = Column(String(1000), nullable=True)

    delay_seconds = Column(Integer, default=3)                # for announcement/countdown types
    is_active = Column(Boolean, default=True)

    impressions = Column(Integer, default=0)
    clicks = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
