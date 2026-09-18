from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from app.core.database import Base


class CustomerSegment(Base):
    """A saved filter, not a static list — membership is computed live from
    `rules` every time the segment is viewed (see customer_segments.py's
    _matching_customers), so it never drifts out of date the way a stored
    customer_id list would as new orders come in.

    `rules` shape (all optional, combined with AND):
      {"tags": ["vip", "wholesale"], "sources": ["website", "pos"],
       "min_orders": 3, "max_orders": null, "min_ltv": 100, "max_ltv": null}
    tags/sources are OR within themselves (any tag, any source matches),
    AND'd against the numeric range filters."""
    __tablename__ = "customer_segments"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    rules = Column(JSON, nullable=False, default=dict)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
