"""Admin > Prodora > Intelligence: analyse a catalogue product against real
marketplace prices and get a verdict (see app/intel/engine.py).

Viewing needs prodora.view; running an analysis needs prodora.analyze (it can
spend paid lookups); testing a data source's connection is owner-only because
it makes a real (sometimes paid) search.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.v1.endpoints.admin import require_superuser
from app.core.admin_access import require_admin_perm
from app.core.database import get_db
from app.core.intel import record_event
from app.intel import ai, engine
from app.intel.marketplaces import SUPPORTED_MARKETS, adapter_by_name, all_adapters
from app.models.intel import ProductIntelResult
from app.models.product import Product
from app.models.user import User

router = APIRouter()


def _catalogue_product(db: Session, product_id: int) -> Product:
    p = db.query(Product).filter(Product.id == product_id, Product.shop_id.is_(None)).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found in the Prodora catalogue.")
    return p


def _result_out(row: ProductIntelResult) -> dict:
    return {"product_id": row.product_id, "cached": True, "analysed_at": row.created_at.isoformat() if row.created_at else None,
            "snapshot": row.snapshot, "evaluation": row.evaluation}


@router.get("/admin/intel/status")
def intel_status(db: Session = Depends(get_db), _: User = Depends(require_admin_perm("prodora.view"))):
    """Which data sources are connected and how much of the paid budget is used.
    Never returns any key."""
    return {
        "ai_configured": ai._get_client() is not None,
        "markets": sorted(SUPPORTED_MARKETS),
        "sources": [{"source": a.name, "paid": a.paid, "configured": a.configured(), "hint": None if a.configured() else a.missing_hint()}
                    for a in all_adapters()],
        "paid_usage": engine.paid_usage(db),
    }


class AnalyzeIn(BaseModel):
    product_id: int
    market: str = "US"
    target_margin_pct: float = Field(default=30.0, ge=5, le=80)
    ad_cost_per_order: Optional[float] = Field(default=None, ge=0, le=1000)
    use_paid: bool = False
    force: bool = False


@router.post("/admin/intel/analyze")
def analyze_product(body: AnalyzeIn, db: Session = Depends(get_db), user: User = Depends(require_admin_perm("prodora.analyze"))):
    market = body.market.strip().upper()
    if market not in SUPPORTED_MARKETS:
        raise HTTPException(status_code=422, detail="Only the US market is supported so far.")
    product = _catalogue_product(db, body.product_id)
    try:
        out = engine.analyze(db, product, market=market, target_margin_pct=body.target_margin_pct,
                             ad_cost_per_order=body.ad_cost_per_order, use_paid=body.use_paid, force=body.force, user_id=user.id)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    out["paid_usage"] = engine.paid_usage(db)
    return out


@router.get("/admin/intel/products/{product_id}")
def latest_result(product_id: int, market: str = "US", db: Session = Depends(get_db), _: User = Depends(require_admin_perm("prodora.view"))):
    row = (db.query(ProductIntelResult).filter(ProductIntelResult.product_id == product_id, ProductIntelResult.market == market.upper())
           .order_by(ProductIntelResult.id.desc()).first())
    p = _catalogue_product(db, product_id)
    return {"result": _result_out(row) if row else None,
            "product": {"id": p.id, "name": p.name, "code": p.prodora_code, "cost_price": float(p.cost_price) if p.cost_price is not None else None}}


class TestSourceIn(BaseModel):
    source: str


@router.post("/admin/intel/test-source")
def test_source(body: TestSourceIn, db: Session = Depends(get_db), admin: User = Depends(require_superuser)):
    """Runs ONE real search against a source and reports plainly what happened.
    Owner-only: a paid source spends a lookup (and it is counted like any other)."""
    ad = adapter_by_name(body.source)
    if not ad:
        raise HTTPException(status_code=404, detail="Unknown source.")
    out = ad.check()
    if ad.paid and out.get("status") not in ("not_configured",):
        record_event(db, engine.PAID_EVENT, user_id=admin.id, payload={"source": ad.name, "query": "connection test"})
    return out
