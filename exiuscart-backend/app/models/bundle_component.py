from sqlalchemy import Column, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base


class BundleComponent(Base):
    __tablename__ = "bundle_components"

    id = Column(Integer, primary_key=True, index=True)
    bundle_product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    component_product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    # Which of the component product's real ProductVariant rows the buyer may
    # pick between for this bundle slot — e.g. the shoe can be size 39, 40, or
    # 41. Null/empty means the component has no size/color choice at all.
    allowed_variant_ids = Column(JSONB, nullable=True)
    quantity = Column(Integer, default=1, nullable=False)
