"""Prodora intelligence foundation: the shared building blocks every later phase
uses - a `Signal` (a number that always carries its source and how much to trust
it), one place to record platform events, and one place to record supplier
price snapshots.

Rules this module enforces by construction:
  * a Signal without a source or a confidence cannot be created - no bare
    "Demand 87/100" with nothing behind it;
  * recording an event or a snapshot can NEVER break the request it is attached
    to (same "observability can't take down the feature it observes" principle
    as record_audit_event).
"""
import logging
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, List, Optional

from sqlalchemy.orm import Session

from app.models.intel import PlatformEvent, SupplierPriceSnapshot

logger = logging.getLogger(__name__)

CONFIDENCE_LEVELS = ("high", "medium", "low")


@dataclass
class Signal:
    """One piece of evidence: what, how sure, where from, when."""
    key: str                       # e.g. "competitor_median_price"
    value: Any
    confidence: str                # high | medium | low
    source: str                    # e.g. "ebay_browse_api", "supplier:cj", "calculation"
    captured_at: Optional[str] = None
    evidence: List[str] = field(default_factory=list)   # short plain-English reasons

    def __post_init__(self):
        if not self.source or not str(self.source).strip():
            raise ValueError("A signal needs a source.")
        if self.confidence not in CONFIDENCE_LEVELS:
            raise ValueError(f"Confidence must be one of {CONFIDENCE_LEVELS}.")
        if not self.captured_at:
            self.captured_at = datetime.now(timezone.utc).isoformat()

    def to_dict(self) -> dict:
        return asdict(self)


def record_event(
    db: Session, event_type: str, *, user_id: Optional[int] = None, shop_id: Optional[int] = None,
    entity_type: Optional[str] = None, entity_id: Optional[Any] = None, payload: Optional[dict] = None,
) -> None:
    """Append one row to the platform event stream. Never raises. Call it AFTER
    the caller's own commit: it commits on its own so a still-pending business
    transaction is never committed early by accident."""
    try:
        db.add(PlatformEvent(
            event_type=event_type[:60], user_id=user_id, shop_id=shop_id,
            entity_type=entity_type, entity_id=str(entity_id) if entity_id is not None else None, payload=payload,
        ))
        db.commit()
    except Exception as e:  # noqa: BLE001 - logging must not break the request
        logger.warning(f"[intel] could not record event {event_type}: {e}")
        try:
            db.rollback()
        except Exception:  # noqa: BLE001
            pass


def _num(v) -> Optional[Decimal]:
    if v is None or v == "":
        return None
    try:
        return Decimal(str(v))
    except Exception:  # noqa: BLE001
        return None


def record_supplier_snapshot(
    db: Session, supplier_type: str, supplier_product_id: Any, *, cost=None, shipping=None, currency: str = "USD",
    stock: Optional[int] = None, product_id: Optional[int] = None, source: str = "import",
) -> None:
    """Append one supplier price observation. Skipped when there is nothing to
    record (no id, or no cost and no shipping). Never raises."""
    if supplier_product_id in (None, "") or (_num(cost) is None and _num(shipping) is None):
        return
    try:
        db.add(SupplierPriceSnapshot(
            supplier_type=str(supplier_type)[:20], supplier_product_id=str(supplier_product_id)[:255],
            product_id=product_id, cost=_num(cost), shipping=_num(shipping), currency=(currency or "USD")[:3].upper(),
            stock=stock, source=source[:40],
        ))
        db.commit()
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[intel] could not record supplier snapshot: {e}")
        try:
            db.rollback()
        except Exception:  # noqa: BLE001
            pass
