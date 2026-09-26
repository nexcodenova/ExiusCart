"""The orchestrator: one supplier product in, evidence and a verdict out.

Two halves, because they have very different costs:

  market_snapshot()  fingerprint + competitor lookups. Slow and (for Amazon /
                     Walmart) paid, so the result is cached for 24 hours per
                     product and market.
  evaluate()         economics + verdict. Instant and free, recomputed every
                     time a target margin or ad cost changes, from the cached
                     snapshot, so tweaking a number never costs another lookup.

Paid lookups are opt-in per analysis AND capped per day and per month
(INTEL_DAILY_PAID_LIMIT / INTEL_MONTHLY_PAID_LIMIT, default sized for a small
budget). A source that is not configured or over budget says so in the result.
"""
import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Callable, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core import economics
from app.core.intel import Signal, record_event
from app.intel import fingerprint as fp_mod
from app.intel import matching, verdict as verdict_mod
from app.intel.marketplaces import MarketplaceAdapter, all_adapters
from app.intel.types import Fingerprint, Listing, ProductSource, SourceResult
from app.models.intel import PlatformEvent, ProductIntelResult
from app.models.product import Product

SNAPSHOT_TTL = timedelta(hours=24)
PAID_EVENT = "intel_paid_lookup"
QUERIES_FREE = 2      # free sources try the two best search phrases
QUERIES_PAID = 1      # paid sources try only the best one


def _int_env(name: str, default: int) -> int:
    try:
        return max(0, int(os.getenv(name, default)))
    except ValueError:
        return default


def paid_usage(db: Session) -> dict:
    now = datetime.now(timezone.utc)
    day = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month = day.replace(day=1)
    q = db.query(func.count(PlatformEvent.id)).filter(PlatformEvent.event_type == PAID_EVENT)
    return {"today": q.filter(PlatformEvent.created_at >= day).scalar() or 0,
            "month": q.filter(PlatformEvent.created_at >= month).scalar() or 0,
            "daily_limit": _int_env("INTEL_DAILY_PAID_LIMIT", 20),
            "monthly_limit": _int_env("INTEL_MONTHLY_PAID_LIMIT", 300)}


def source_from_product(p: Product) -> ProductSource:
    import json
    specs = {}
    try:
        raw = json.loads(p.specs_json) if p.specs_json else {}
        if isinstance(raw, dict):
            specs = raw
        elif isinstance(raw, list):
            specs = {str(i.get("key") or i.get("label") or i.get("name")): i.get("value") for i in raw if isinstance(i, dict)}
    except ValueError:
        pass
    dec = lambda v: Decimal(str(v)) if v is not None else None  # noqa: E731
    return ProductSource(
        title=p.name, supplier=p.supplier_name, supplier_cost=dec(p.cost_price), shipping_cost=dec(p.shipping_cost),
        listed_price=dec(p.price), image_url=p.image_url, description=p.description, specs={k: v for k, v in specs.items() if k},
        url=p.source_url, product_id=p.id,
    )


def _fresh_snapshot(db: Session, product_id: int, market: str, use_paid: bool) -> Optional[ProductIntelResult]:
    row = (db.query(ProductIntelResult)
           .filter(ProductIntelResult.product_id == product_id, ProductIntelResult.market == market)
           .order_by(ProductIntelResult.id.desc()).first())
    if not row:
        return None
    created = row.created_at if row.created_at.tzinfo else row.created_at.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) - created > SNAPSHOT_TTL:
        return None
    if use_paid and not row.snapshot.get("used_paid"):
        return None                                    # the cached one never asked the paid sources
    return row


def fetch_snapshot(db: Session, source: ProductSource, market: str, use_paid: bool,
                   adapters: Optional[List[MarketplaceAdapter]] = None, user_id: Optional[int] = None) -> dict:
    adapters = adapters if adapters is not None else all_adapters()
    fp: Fingerprint = fp_mod.build(source)
    usage = paid_usage(db)
    spent = 0
    results: List[SourceResult] = []
    candidates: List[Listing] = []

    for ad in adapters:
        if ad.paid and not use_paid:
            results.append(SourceResult(ad.name, "skipped_unpaid", paid=True, note="Not requested. This source uses a paid lookup."))
            continue
        combined = SourceResult(ad.name, "ok", paid=ad.paid)
        queries = fp.search_queries[: (QUERIES_PAID if ad.paid else QUERIES_FREE)]
        for q in queries:
            if ad.paid and (usage["today"] + spent >= usage["daily_limit"] or usage["month"] + spent >= usage["monthly_limit"]):
                combined.status, combined.note = "skipped_budget", "Paid lookup limit reached. It resets tomorrow (daily) or next month."
                break
            r = ad.search(q, market)
            if ad.paid and r.lookups:
                spent += r.lookups
                record_event(db, PAID_EVENT, user_id=user_id, entity_type="product", entity_id=source.product_id,
                             payload={"source": ad.name, "query": q})
            if r.status != "ok":
                combined.status, combined.note = r.status, r.note
                break
            known = {l.listing_id for l in combined.listings}   # the same listing often answers both search phrases
            combined.listings += [l for l in r.listings if l.listing_id not in known]
            combined.lookups += r.lookups
        results.append(combined)
        candidates += combined.listings

    found = matching.find_competitors(fp, source, candidates)
    return {
        "captured_at": datetime.now(timezone.utc).isoformat(), "market": market, "used_paid": bool(use_paid),
        "fingerprint": fp.to_dict(), "sources": [r.summary() for r in results],
        "candidates": found["candidates"], "match_method": found["method"], "rejected": found["rejected"],
        "outliers_dropped": found["outliers_dropped"], "listings": [l.to_dict() for l in found["competitors"]],
        "paid_lookups_used": spent,
    }


def evaluate(snapshot: dict, source: ProductSource, *, target_margin_pct: float = 30.0, ad_cost_per_order: Optional[float] = None) -> dict:
    """Economics + verdict from a snapshot. Free and instant."""
    if source.supplier_cost is None:
        raise ValueError("This product has no supplier cost yet. Add it first so the profit can be worked out.")
    ship = source.shipping_cost or Decimal("0")
    prices = [l["price"] for l in snapshot.get("listings", [])]
    ad = ad_cost_per_order if ad_cost_per_order not in (None, "") else None

    floor = economics.price_for_margin(source.supplier_cost, ship, target_margin_pct, ad_cost_per_order=ad or 0)
    price_range = economics.suggest_price_range(floor, prices)
    # Judge the product at the LOW end of the recommended range: the conservative case.
    basis = price_range.get("low") if prices else (float(source.listed_price) if source.listed_price else None)
    if not basis:
        raise ValueError("There is no selling price to check. Add one to the product, or run the analysis with competitor sources connected.")

    econ = economics.calculate(basis, source.supplier_cost, ship, ad_cost_per_order=ad)
    sources_ok = sum(1 for s in snapshot.get("sources", []) if s["status"] == "ok")
    v = verdict_mod.decide(economics=econ, price_range=price_range, competitor_count=len(prices),
                           target_margin_pct=target_margin_pct, sources_ok=sources_ok, method=snapshot.get("match_method", "none"),
                           shipping_known=source.shipping_cost is not None)

    ok_names = [s["source"] for s in snapshot.get("sources", []) if s["status"] == "ok" and s["count"]]
    signals: List[Signal] = [
        Signal("supplier_landed_cost", float(source.landed_cost), "high", f"supplier:{(source.supplier or 'catalogue').lower()}",
               evidence=[f"Product {float(source.supplier_cost):.2f} + shipping {float(ship):.2f}"]),
        Signal("contribution_margin_pct", econ["contribution_margin_pct"], econ["confidence"], "calculation",
               evidence=[f"Judged at ${basis:.2f}", *[f"Assumed: {a['label']} {a['value']}{'%' if a['unit'] == '%' else ''}" for a in econ["assumptions"]]]),
    ]
    if prices:
        m = price_range["market"]
        signals.append(Signal("competitor_median_price", m["median"], price_range["confidence"], "+".join(ok_names) or "marketplaces",
                              evidence=[f"{len(prices)} same-product listings", f"lowest ${m['lowest']:.2f}, highest ${m['highest']:.2f}"]))
    return {
        **v, "economics": econ, "price_range": price_range, "basis_price": basis, "target_margin_pct": target_margin_pct,
        "ad_cost_per_order": ad, "competitor_count": len(prices), "signals": [s.to_dict() for s in signals],
    }


def analyze(db: Session, product: Product, *, market: str = "US", target_margin_pct: float = 30.0,
            ad_cost_per_order: Optional[float] = None, use_paid: bool = False, force: bool = False,
            user_id: Optional[int] = None, adapters: Optional[List[MarketplaceAdapter]] = None) -> dict:
    source = source_from_product(product)
    cached = None if force else _fresh_snapshot(db, product.id, market, use_paid)
    snapshot = cached.snapshot if cached else fetch_snapshot(db, source, market, use_paid, adapters, user_id)
    evaluation = evaluate(snapshot, source, target_margin_pct=target_margin_pct, ad_cost_per_order=ad_cost_per_order)
    if cached is None:
        db.add(ProductIntelResult(product_id=product.id, market=market, snapshot=snapshot, evaluation=evaluation,
                                  verdict=evaluation["verdict"], confidence=evaluation["confidence"], created_by_user_id=user_id))
    else:
        cached.evaluation, cached.verdict, cached.confidence = evaluation, evaluation["verdict"], evaluation["confidence"]
    from app.intel import intake
    intake.sync_from_analysis(db, product.id, evaluation)       # keep the review queue's verdict current
    db.commit()
    record_event(db, "prodora_product_analyzed", user_id=user_id, entity_type="prodora_product", entity_id=product.id,
                 payload={"verdict": evaluation["verdict"], "confidence": evaluation["confidence"], "competitors": evaluation["competitor_count"],
                          "cached": cached is not None, "paid": use_paid})
    return {"product_id": product.id, "cached": cached is not None, "snapshot": snapshot, "evaluation": evaluation}
