from sqlalchemy import Column, Integer, String, Text, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy import DateTime
from app.core.database import Base


class EmailTemplate(Base):
    """A seller's own saved, reusable marketing email design — the fields
    that fill into the shared email builder, not pre-rendered HTML, so it
    stays editable next time it's reused."""
    __tablename__ = "email_templates"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(200), nullable=False)

    heading = Column(String(300), nullable=True)
    subtitle = Column(Text, nullable=True)
    hero_image_url = Column(String(1000), nullable=True)
    button_text = Column(String(100), nullable=True)
    button_color = Column(String(7), nullable=True)     # "#RRGGBB"
    button_shape = Column(String(20), nullable=True)     # "pill" | "rounded" | "square"
    font_key = Column(String(30), nullable=True)         # key into the frontend's curated font list

    created_at = Column(DateTime(timezone=True), server_default=func.now())
