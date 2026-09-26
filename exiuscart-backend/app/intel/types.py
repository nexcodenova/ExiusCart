from dataclasses import dataclass, field, asdict
from decimal import Decimal
from typing import Any, Dict, List, Optional


@dataclass
class ProductSource:
    """One supplier product in ExiusCart's own standard shape, so nothing after
    this point cares whether it came from CJ, AliExpress or anywhere else."""
    title: str
    supplier: Optional[str] = None
    supplier_cost: Optional[Decimal] = None        # per unit
    shipping_cost: Optional[Decimal] = None        # supplier shipping per order
    listed_price: Optional[Decimal] = None         # what we would sell it for today, if set
    image_url: Optional[str] = None
    description: Optional[str] = None
    specs: Dict[str, Any] = field(default_factory=dict)
    url: Optional[str] = None
    product_id: Optional[int] = None

    @property
    def landed_cost(self) -> Optional[Decimal]:
        if self.supplier_cost is None:
            return None
        return self.supplier_cost + (self.shipping_cost or Decimal("0"))


@dataclass
class Fingerprint:
    """What the product IS, in words a marketplace search understands."""
    product_type: str
    category: Optional[str] = None
    attributes: Dict[str, Any] = field(default_factory=dict)
    search_queries: List[str] = field(default_factory=list)
    audience: Optional[str] = None
    method: str = "ai"                              # ai | title-only (no AI key or the AI call failed)

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class Listing:
    """One real competitor listing from a marketplace."""
    marketplace: str
    listing_id: str
    title: str
    price: float
    currency: str = "USD"
    url: Optional[str] = None
    image_url: Optional[str] = None
    seller: Optional[str] = None
    rating: Optional[float] = None
    review_count: Optional[int] = None
    match_score: Optional[int] = None               # 0-100, set by the same-product check
    match_reason: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class SourceResult:
    """What one marketplace source returned, including WHY when it returned nothing."""
    source: str
    status: str                                     # ok | not_configured | error | skipped_budget | skipped_unpaid | unsupported_market
    listings: List[Listing] = field(default_factory=list)
    note: Optional[str] = None
    paid: bool = False
    lookups: int = 0

    def summary(self) -> dict:
        return {"source": self.source, "status": self.status, "count": len(self.listings), "note": self.note, "paid": self.paid}
