from sqlalchemy import Column, Integer, BigInteger, String, Numeric, DateTime, ForeignKey, Index, func
from sqlalchemy.dialects.postgresql import JSONB
from app.core.database import Base


class SupplierPriceSnapshot(Base):
    """One observation of what a supplier charged for a product at a moment in
    time. A ledger, never updated: history is what lets Prodora say "this
    supplier's price rose 7% this month" (Phase 7) instead of only knowing
    today's number."""
    __tablename__ = "supplier_price_snapshots"
    __table_args__ = (Index("ix_snapshot_supplier_product", "supplier_type", "supplier_product_id", "captured_at"),)

    id = Column(Integer, primary_key=True, index=True)
    supplier_type = Column(String(20), nullable=False)             # cj / aliexpress / hypersku / ...
    supplier_product_id = Column(String(255), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True, index=True)
    cost = Column(Numeric(12, 2), nullable=True)                   # supplier price per unit
    shipping = Column(Numeric(12, 2), nullable=True)               # supplier shipping per unit, when known
    currency = Column(String(3), nullable=False, default="USD", server_default="USD")
    stock = Column(Integer, nullable=True)
    source = Column(String(40), nullable=False, default="import", server_default="import")  # import | refresh | manual
    captured_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class PlatformEvent(Base):
    """The one event stream for the whole platform: every meaningful thing that
    happens (a Prodora product viewed, imported, launched...) becomes a row.
    This is the raw material for Prodora's data advantage - it only ever grows,
    so it starts filling on day one even before any feature reads it.

    Kept deliberately small: who (user/shop, both optional), what
    (event_type), about what (entity_type + entity_id) and a JSON payload for
    the details. No IPs and no personal data beyond the ids."""
    __tablename__ = "platform_events"
    __table_args__ = (Index("ix_platform_events_entity", "entity_type", "entity_id", "created_at"),)

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, index=True)
    event_type = Column(String(60), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="SET NULL"), nullable=True, index=True)
    entity_type = Column(String(40), nullable=True)                # prodora_product | product | order | ...
    entity_id = Column(String(64), nullable=True)
    payload = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
