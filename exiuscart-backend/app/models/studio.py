from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func

from app.core.database import Base


class StudioAsset(Base):
    """One item in a seller's Brand Assets library: a print design, a mockup,
    an AI product image, an upload, or a product photo brought in from their
    catalogue (including Prodora imports). Everything Design Studio, Mockup
    Studio and the AI image pages make is saved here automatically."""
    __tablename__ = "studio_assets"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    kind = Column(String(20), nullable=False, index=True)    # design | mockup | image | upload
    source = Column(String(20), nullable=False, default="ai")  # ai | upload | product | prodora
    title = Column(String(255), nullable=True)
    url = Column(String(1000), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True)
    meta = Column(JSON, nullable=True)                       # prompt, garment, colour, style...
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
