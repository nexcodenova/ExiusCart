"""Price Coach: the seller-facing side of Product Intelligence.

A Growth or Scale seller pastes ONE supplier link (AliExpress or CJ) inside their
own store. We import it as a private, hidden draft in THEIR shop, price-check it
against eBay with the same engine the admin uses, and on request "launch" it: the
price is set to the suggested range and Claude writes a store-ready title,
description and keywords. The result is still a draft; the seller reviews and
publishes it themselves. Nothing here can ever publish anything.

Rules that keep it honest and cheap:
  * eBay only for sellers (free). The paid Amazon/Walmart lookups stay operator-only.
  * A CHECK spends one of the shop's monthly checks (Growth 20, Scale 100) only when
    fresh market data was actually fetched and at least one source answered. Re-checking
    within 24 hours, or a check where nothing answered, is free.
  * Products live in the seller's shop (shop_id set), so they never appear in the
    public Prodora catalogue, which lists only products that belong to no shop.
  * Demand (Google Trends) rides along from the shared per-keyword cache when it is
    available; it is never required.
"""
import asyncio
import logging
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Callable, Dict, Optional

from sqlalchemy.orm import Session

from app.core.intel import record_event
from app.intel import ai, engine, intake
from app.models.coach import CoachItem
from app.models.dropship import DropshipConnection, DropshipProductLink
from app.models.intel import PlatformEvent, ProductIntelResult
from app.models.product import Product

logger = logging.getLogger(__name__)

CHECK_EVENT = "coach_check"
PLANS = ("growth", "scale")
DEFAULT_LIMITS = {"growth": 20, "scale": 100}


class CoachError(Exception):
    """A problem the seller can understand and act on. `code` is for the screen."""

    def __init__(self, message: str, code: str = "coach_error", status: int = 400):
        super().__init__(message)
        self.message, self.code, self.status = message, code, status


# ── Plan and monthly allowance ───────────────────────────────────────────────

def monthly_limit(plan: Optional[str]) -> int:
    if plan not in PLANS:
        return 0
    try:
        return max(0, int(os.getenv(f"COACH_{plan.upper()}_LIMIT", DEFAULT_LIMITS[plan])))
    except ValueError:
        return DEFAULT_LIMITS[plan]


def _month_start(now: Optional[datetime] = None) -> datetime:
    now = now or datetime.now(timezone.utc)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def usage(db: Session, shop_id: int, plan: Optional[str], now: Optional[datetime] = None) -> dict:
    start = _month_start(now)
    used = (db.query(PlatformEvent).filter(PlatformEvent.event_type == CHECK_EVENT, PlatformEvent.shop_id == shop_id,
                                           PlatformEvent.created_at >= start).count())
    limit = monthly_limit(plan)
    nxt = start.replace(year=start.year + 1, month=1) if start.month == 12 else start.replace(month=start.month + 1)
    return {"used": used, "limit": limit, "remaining": max(limit - used, 0), "resets_on": nxt.date().isoformat()}


# ── Adding a link ────────────────────────────────────────────────────────────

def _import_cj_for_shop(db: Session, shop, item: CoachItem) -> Product:
    from app.api.v1.endpoints import admin as A

    async def run() -> Product:
        # Public product data is read through the platform's own supplier account; the
        # link saved on the product carries the SELLER's shop, and ordering later uses
        # the seller's own supplier connection.
        conn = A._get_system_cj_connection(db, A._CATALOGUE)
        token = await A._cj_ensure_token(conn, db)
        product = await A._cj_import_one(db, shop, token, item.supplier_ref, None, None)
        product.is_active = False
        link = db.query(DropshipProductLink).filter(DropshipProductLink.product_id == product.id, DropshipProductLink.is_primary == True).first()  # noqa: E712
        if link and link.supplier_sku:
            ship = await intake._cj_us_shipping(token, link.supplier_sku)
            if ship is not None:
                product.shipping_cost = ship
        return product

    product = asyncio.run(run())
    db.commit()
    return product


def _import_aliexpress_for_shop(db: Session, shop, item: CoachItem) -> Product:
    from app.api.v1.endpoints import admin as A

    conn = db.query(DropshipConnection).filter(
        DropshipConnection.shop_id.is_(None), DropshipConnection.supplier_type == "aliexpress", DropshipConnection.is_active == True).first()  # noqa: E712
    if not conn:
        raise RuntimeError("AliExpress product lookup is not available right now.")
    token = asyncio.run(A._aliexpress_ensure_token(conn, db))
    product = A._aliexpress_import_one(db, shop, token, item.source_url, None, None, active=False)
    db.commit()
    return product


# Replaceable in tests.
IMPORTERS: Dict[str, Callable[[Session, object, CoachItem], Product]] = {"cj": _import_cj_for_shop, "aliexpress": _import_aliexpress_for_shop}


def add_link(db: Session, shop, user_id: int, text: str) -> dict:
    """Import one pasted link as a hidden draft in this shop. Returns {"item", "existing"}."""
    parsed = [p for p in intake.parse_links(text)]
    good = [p for p in parsed if p.kind in ("cj", "aliexpress")]
    if not parsed:
        raise CoachError("Paste a product link first.", "no_link")
    if len(good) > 1:
        raise CoachError("Paste one product link at a time.", "many_links")
    if not good:
        raise CoachError(parsed[0].reason or "That link can't be imported.", "bad_link")
    p = good[0]

    old = (db.query(CoachItem).filter(CoachItem.shop_id == shop.id, CoachItem.supplier_type == p.kind, CoachItem.supplier_ref == p.ref,
                                      CoachItem.status != "discarded").first())
    if old and not _needs_retry(old):
        return {"item": old, "existing": True}

    if old:                                        # a failed (or abandoned) import: try again on the same row
        item = old
        item.status, item.error, item.source_url = "importing", None, p.url
    else:
        item = CoachItem(shop_id=shop.id, user_id=user_id, source_url=p.url, supplier_type=p.kind, supplier_ref=p.ref, status="importing")
        db.add(item)
    db.commit()
    db.refresh(item)
    try:
        product = IMPORTERS[p.kind](db, shop, item)
        item.product_id, item.original_name, item.status = product.id, product.name[:255], "imported"
    except Exception as e:  # noqa: BLE001 - shown to the seller, in words
        db.rollback()
        item = db.query(CoachItem).get(item.id)
        item.status, item.error = "failed", _friendly(e)
        logger.warning(f"[coach] import failed shop={shop.id} {p.kind}:{p.ref}: {type(e).__name__}")
    db.commit()
    db.refresh(item)
    return {"item": item, "existing": False}


STUCK_AFTER = timedelta(minutes=10)


def _needs_retry(it: CoachItem) -> bool:
    if it.status == "failed" or (it.status in ("imported", "checked", "launched") and not it.product_id):
        return True
    if it.status == "importing" and it.created_at:
        made = it.created_at if it.created_at.tzinfo else it.created_at.replace(tzinfo=timezone.utc)
        return datetime.now(timezone.utc) - made > STUCK_AFTER
    return False


def _friendly(e: Exception) -> str:
    d = intake._detail_of(e)
    low = d.lower()
    if "not connected" in low or "not available right now" in low:
        return "We could not read that supplier page right now. Try again in a little while."
    return d[:300] or "We could not import that product."


# ── Checking a price ─────────────────────────────────────────────────────────

def _latest_result(db: Session, product_id: int) -> Optional[ProductIntelResult]:
    return (db.query(ProductIntelResult).filter(ProductIntelResult.product_id == product_id, ProductIntelResult.market == "US")
            .order_by(ProductIntelResult.id.desc()).first())


def run_check(db: Session, shop, item: CoachItem, user_id: int, plan: Optional[str], target_margin_pct: float = 30.0) -> dict:
    product = db.query(Product).filter(Product.id == item.product_id, Product.shop_id == shop.id).first() if item.product_id else None
    if not product:
        raise CoachError("That product is no longer in your store.", "no_product", 404)
    if not 5 <= target_margin_pct <= 90:
        raise CoachError("Pick a target margin between 5% and 90%.", "bad_margin", 422)

    row = _latest_result(db, product.id)
    fresh = engine._fresh_snapshot(db, product.id, "US", False)
    # A cached result where nobody answered (a source was down or not set up) is worth
    # nothing to the seller: look again instead of serving it for a day.
    fresh_and_useful = bool(fresh and any(s.get("status") == "ok" for s in (fresh.snapshot or {}).get("sources", [])))
    u = usage(db, shop.id, plan)
    if not fresh_and_useful and u["remaining"] <= 0:
        raise CoachError(f"You have used all {u['limit']} price checks for this month on your {plan.title()} plan. "
                         f"They reset on {u['resets_on']}. You can still re-check anything you already checked in the last 24 hours.",
                         "limit_reached", 403)
    try:
        out = engine.analyze(db, product, market="US", target_margin_pct=target_margin_pct, use_paid=False,
                             force=not fresh_and_useful, user_id=user_id, use_trends=True)
    except ValueError as e:
        raise CoachError(str(e), "cannot_check", 422)

    answered = any(s.get("status") == "ok" for s in out["snapshot"].get("sources", []))
    if not out["cached"] and answered:
        record_event(db, CHECK_EVENT, user_id=user_id, shop_id=shop.id, entity_type="coach_item", entity_id=item.id,
                     payload={"product_id": product.id, "verdict": out["evaluation"]["verdict"]})
    ev = out["evaluation"]
    item.status = "launched" if item.status == "launched" else "checked"
    item.verdict, item.confidence = ev["verdict"], ev["confidence"]
    item.margin_pct = (ev.get("economics") or {}).get("contribution_margin_pct")
    item.competitor_count = ev.get("competitor_count")
    item.checked_at = datetime.now(timezone.utc)
    db.commit()
    return {"charged": (not out["cached"]) and answered}


# ── Launching a draft ────────────────────────────────────────────────────────

_TAGS = re.compile(r"<[^>]+>")


def _plain(text: Optional[str], limit: int = 1500) -> str:
    return re.sub(r"\s+", " ", _TAGS.sub(" ", text or "")).strip()[:limit]


def write_listing(product: Product, snapshot: dict) -> Optional[dict]:
    """Claude's draft of the listing, or None when AI is off or answers badly. Only
    facts that came from the supplier page may appear in it."""
    fp = (snapshot or {}).get("fingerprint") or {}
    attrs = ", ".join(f"{k}: {v}" for k, v in (fp.get("attributes") or {}).items() if k and v)[:500]
    prompt = f"""You write product listings for an online store. Write a clear, honest listing from ONLY the facts below.

Supplier title: {product.name}
What the product is: {fp.get('product_type') or 'not stated'}
Known attributes: {attrs or 'none'}
Supplier description: {_plain(product.description) or 'none'}

Rules:
- Use only facts given above. Never invent materials, sizes, capacities, certifications, warranty, battery life, or health claims.
- Do not mention the supplier, AliExpress, CJ, dropshipping or shipping times.
- Title: at most 80 characters, plain and specific, no ALL CAPS, no emoji, no brand names of other companies.
- Description: 110 to 200 words, short paragraphs, benefits first, natural wording, no bullet symbols.
- keywords: 5 search phrases a shopper would type.

Reply with JSON only:
{{"title": "...", "description": "...", "keywords": ["...", "..."]}}"""
    data = ai.ask_json(prompt, max_tokens=900, purpose="listing")
    if not isinstance(data, dict):
        return None
    title, desc, kws = data.get("title"), data.get("description"), data.get("keywords")
    if not isinstance(title, str) or not title.strip() or not isinstance(desc, str) or len(desc.strip()) < 40:
        return None
    kws = [k.strip()[:60] for k in kws if isinstance(k, str) and k.strip()][:5] if isinstance(kws, list) else []
    return {"title": title.strip()[:120], "description": desc.strip(), "keywords": kws}


def launch(db: Session, shop, item: CoachItem, user_id: int, price: Optional[float] = None) -> dict:
    product = db.query(Product).filter(Product.id == item.product_id, Product.shop_id == shop.id).first() if item.product_id else None
    if not product:
        raise CoachError("That product is no longer in your store.", "no_product", 404)
    row = _latest_result(db, product.id)
    if not row:
        raise CoachError("Check the price first, then launch.", "not_checked", 409)

    ev, snap = row.evaluation or {}, row.snapshot or {}
    rng = ev.get("price_range") or {}
    if price is None:
        price = rng.get("low") or ev.get("basis_price") or (float(product.price) if product.price else None)
    if price is None or not (0.5 <= float(price) <= 100000):
        raise CoachError("Enter a selling price between 0.50 and 100,000.", "bad_price", 422)
    price = round(float(price), 2)
    floor = rng.get("floor")

    listing = write_listing(product, snap)
    if listing:
        from app.api.v1.endpoints.admin import _truncate_description
        from app.api.v1.endpoints.product_fields import _description_word_limit
        product.name = listing["title"]
        product.description = _truncate_description(listing["description"], _description_word_limit(shop.id, db)) or listing["description"]
        product.seo_keywords = listing["keywords"] or None
    product.price = price
    product.is_active = False                       # a draft: the seller reviews and publishes it
    item.status, item.launched_price, item.launched_at = "launched", price, datetime.now(timezone.utc)
    db.commit()
    record_event(db, "coach_launch", user_id=user_id, shop_id=shop.id, entity_type="product", entity_id=product.id,
                 payload={"price": price, "ai_written": bool(listing)})
    connected = bool(db.query(DropshipConnection).filter(DropshipConnection.shop_id == shop.id, DropshipConnection.supplier_type == item.supplier_type,
                                                         DropshipConnection.is_active == True).first())  # noqa: E712
    return {"product_id": product.id, "price": price, "ai_written": bool(listing), "below_target": bool(floor and price < float(floor)),
            "supplier_connected": connected}


# ── Removing a draft ─────────────────────────────────────────────────────────

def discard(db: Session, shop, item: CoachItem) -> None:
    """Drop an un-launched draft and its hidden product. A launched item only leaves the
    list (the seller has edited that product, so it stays in their catalogue)."""
    if item.status != "launched" and item.product_id:
        product = db.query(Product).filter(Product.id == item.product_id, Product.shop_id == shop.id, Product.is_active == False).first()  # noqa: E712
        if product:
            try:
                from app.models.product_fields import ProductImage
                from app.models.product_variant import ProductVariant
                db.query(DropshipProductLink).filter(DropshipProductLink.product_id == product.id).delete()
                db.query(ProductImage).filter(ProductImage.product_id == product.id).delete()
                db.query(ProductVariant).filter(ProductVariant.product_id == product.id).delete()
                db.query(ProductIntelResult).filter(ProductIntelResult.product_id == product.id).delete()
                db.flush()
                db.delete(product)
                item.product_id = None
            except Exception as e:  # noqa: BLE001 - never lose the seller's list over a cleanup problem
                logger.warning(f"[coach] draft cleanup failed: {type(e).__name__}")
                db.rollback()
                item = db.query(CoachItem).get(item.id)
    item.status = "discarded"
    db.commit()
