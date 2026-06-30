from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class BundleComponent(Base):
    __tablename__ = "bundle_components"

    id = Column(Integer, primary_key=True, index=True)
    bundle_product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    component_product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    variant_size = Column(String(100), nullable=True)
    variant_color = Column(String(100), nullable=True)
    quantity = Column(Integer, default=1, nullable=False)
