import secrets
import uuid
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


def _generate_token() -> str:
    return uuid.uuid4().hex


def _generate_access_code() -> str:
    # 8 chars from an unambiguous alphabet (no 0/O/1/I) — short enough to
    # type from an email, long enough (32^8 ≈ 1.1e12 combinations) that the
    # attempt-cap in the verify endpoint is what actually stops guessing,
    # not the code length alone.
    alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
    return "".join(secrets.choice(alphabet) for _ in range(8))


class DigitalDelivery(Base):
    """One row per digital product a customer actually paid for — the
    gate a download link and access code both point back to. Not a
    license-key pool (Product.digital_file_url is one file, shared by
    every buyer) — this table's job is purely "does this token+code pair
    match a real paid order," not tracking per-copy license assignment."""
    __tablename__ = "digital_deliveries"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    order_item_id = Column(Integer, ForeignKey("order_items.id"), nullable=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)  # nullable so product can be deleted without losing delivery history

    download_token = Column(String(64), unique=True, index=True, nullable=False, default=_generate_token)
    access_code = Column(String(16), nullable=False, default=_generate_access_code)
    delivered_to_email = Column(String(255), nullable=True)

    view_count = Column(Integer, default=0)
    last_accessed_at = Column(DateTime(timezone=True), nullable=True)
    # Gate stops honoring the code after this — the underlying R2 file
    # itself isn't cryptographically locked (see the storage.py docstring
    # for why: unguessable UUID key is the real protection there), but the
    # gate page — the only place a normal buyer ever sees the link — won't
    # reveal it past this point.
    expires_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    shop = relationship("Shop")
    order = relationship("Order")
    product = relationship("Product")
