from sqlalchemy import Column, Integer, String, ForeignKey, Numeric
from sqlalchemy.orm import relationship
from app.core.database import Base


class ProductVariant(Base):
    """
    A specific size/color combination of a product with its own stock count.
    Example: Blue Silk Saree / Size M / Color Blue → 5 in stock
    """
    __tablename__ = "product_variants"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    size = Column(String(50), nullable=True)    # "S", "M", "L", "XL", "Free Size"
    color = Column(String(100), nullable=True)  # "Blue", "Red", "Navy Blue"
    sku = Column(String(100), nullable=True)    # optional variant-level SKU
    quantity = Column(Integer, default=0)
    price = Column(Numeric(10, 2), nullable=True)  # None = use parent product price

    product = relationship("Product", back_populates="variants")
