"""Bulk intake: paste supplier links, get reviewed products in the catalogue.

  parse_links()    turns pasted text into supplier products we can import (and
                   says plainly why the rest can't be)
  create_items()   puts them in the queue, skipping ones already known
  process_item()   imports one HIDDEN, fetches real shipping (CJ), runs the free
                   analysis, and leaves it ready for a person to review
  approve/reject   the human decision
  publish_due()    makes approved products visible, capped per day, best verdicts first
  tick()           what the background scheduler runs: retry stuck items, and
                   publish on schedule when auto-publish is on

Nothing here publishes anything a person has not approved, and nothing becomes
visible to sellers until publish_due() runs.
"""
import asyncio
import logging
import re
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Callable, Dict, Iterable, List, Optional
from urllib.parse import urlparse

from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.intel import record_event
from app.models.dropship import DropshipProductLink
from app.models.intake import IntakeItem, IntakeSettings
from app.models.product import Product

logger = logging.getLogger(__name__)

STUCK_AFTER = timedelta(minutes=10)
MAX_LINKS_PER_PASTE = 300
_GUID = re.compile(r"[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}")
_VERDICT_RANK = {"TEST": 0, "WATCH": 1, "AVOID": 3}

_pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix="intake")


# ── Reading pasted links ─────────────────────────────────────────────────────

@dataclass
class ParsedLink:
    raw: str
    kind: str                  # cj | aliexpress | unsupported | invalid
    ref: Optional[str] = None
    url: Optional[str] = None
    reason: Optional[str] = None


def _parse_one(raw: str) -> ParsedLink:
    token = raw.strip().strip("<>()[]\"'")
    if not token:
        return ParsedLink(raw, "invalid", reason="Empty line.")
    if not re.match(r"^https?://", token, re.I):
        if "." in token and " " not in token and "/" in token:
            token = "https://" + token                     # "aliexpress.com/item/123.html" pasted without https
        else:
            return ParsedLink(raw, "invalid", reason="That is not a product link.")
    host = (urlparse(token).hostname or "").lower()
    if "cjdropshipping." in host:
        m = _GUID.search(token)
        if not m:
            return ParsedLink(raw, "invalid", url=token, reason="Could not find the CJ product ID in that link. Open the product page and copy its address.")
        return ParsedLink(raw, "cj", ref=m.group(0), url=token)
    if "aliexpress." in host:
        from app.api.v1.endpoints.dropshipping import _parse_aliexpress_product_id
        pid = _parse_aliexpress_product_id(token)
        if not pid:
            return ParsedLink(raw, "invalid", url=token, reason="Could not find the AliExpress product ID. Paste the full product page address.")
        return ParsedLink(raw, "aliexpress", ref=str(pid), url=token)
    if "alibaba." in host or "1688." in host:
        return ParsedLink(raw, "unsupported", url=token, reason="Alibaba and 1688 links can be researched but not imported automatically yet.")
    return ParsedLink(raw, "unsupported", url=token, reason="Only AliExpress and CJ links can be imported automatically so far.")


_URL = re.compile(r"https?://[^\s,;<>\"']+", re.I)


def _tokens(text: str) -> List[str]:
    """One entry per link. A line with URLs in it yields those URLs (so several
    links on one line, or a link with a note beside it, both work); a line
    without one stays a single entry, so a sentence is ONE unreadable item and
    not one per word. Bare addresses ("aliexpress.com/item/...") work per line."""
    out: List[str] = []
    for line in re.split(r"[\r\n]+", text or ""):
        line = line.strip()
        if not line:
            continue
        urls = _URL.findall(line)
        if urls:
            out += urls
        else:
            out += [c.strip() for c in re.split(r"[,;]+", line) if c.strip()] if "://" not in line and " " not in line else [line]
    return out


def parse_links(text: str) -> List[ParsedLink]:
    tokens = _tokens(text)
    out: List[ParsedLink] = []
    seen = set()
    for t in tokens[:MAX_LINKS_PER_PASTE]:
        p = _parse_one(t)
        if p.kind in ("cj", "aliexpress"):
            key = (p.kind, p.ref)
            if key in seen:
                p = ParsedLink(t, "invalid", ref=p.ref, url=p.url, reason="Already in this paste.")
            seen.add(key)
        out.append(p)
    return out


# ── The queue ────────────────────────────────────────────────────────────────

def get_settings(db: Session) -> IntakeSettings:
    s = db.query(IntakeSettings).filter(IntakeSettings.id == 1).first()
    if not s:
        s = IntakeSettings(id=1)
        db.add(s)
        db.commit()
        db.refresh(s)
    return s


def _duplicate_of(db: Session, kind: str, ref: str) -> Optional[str]:
    link = db.query(DropshipProductLink).filter(
        DropshipProductLink.shop_id.is_(None), DropshipProductLink.supplier_type == kind, DropshipProductLink.supplier_product_id == ref).first()
    if link:
        p = db.query(Product).filter(Product.id == link.product_id).first()
        if p:
            return f"Already in the catalogue as {p.prodora_code or 'product #' + str(p.id)}."
    pending = db.query(IntakeItem).filter(
        IntakeItem.supplier_type == kind, IntakeItem.supplier_ref == ref, IntakeItem.status.notin_(("rejected", "failed"))).first()
    if pending:
        return "Already in the intake queue."
    return None


def create_items(db: Session, parsed: List[ParsedLink], user_id: Optional[int]) -> dict:
    """Queue every importable link. Returns per-link results and the new item ids."""
    batch = str(uuid.uuid4())
    results, ids = [], []
    for p in parsed:
        if p.kind not in ("cj", "aliexpress"):
            results.append({"link": p.url or p.raw, "status": "unsupported" if p.kind == "unsupported" else "invalid", "reason": p.reason})
            continue
        dup = _duplicate_of(db, p.kind, p.ref)
        if dup:
            results.append({"link": p.url, "status": "duplicate", "reason": dup})
            continue
        it = IntakeItem(batch_id=batch, source_url=p.url, supplier_type=p.kind, supplier_ref=p.ref, status="queued", added_by_user_id=user_id)
        db.add(it)
        db.flush()
        ids.append(it.id)
        results.append({"link": p.url, "status": "queued", "item_id": it.id, "supplier": p.kind})
    db.commit()
    return {"batch_id": batch, "results": results, "item_ids": ids,
            "counts": {k: sum(1 for r in results if r["status"] == k) for k in ("queued", "duplicate", "unsupported", "invalid")}}


def cj_links_from_pids(pids: Iterable[str]) -> List[ParsedLink]:
    return [ParsedLink(pid, "cj", ref=pid, url=f"https://cjdropshipping.com/product-detail.html?pid={pid}") for pid in pids if pid]


# ── Importing one item ───────────────────────────────────────────────────────

def _detail_of(e: Exception) -> str:
    d = getattr(e, "detail", None)
    return (d if isinstance(d, str) else str(e))[:500] or type(e).__name__


async def _cj_us_shipping(token: str, vid: str) -> Optional[float]:
    """Cheapest CJ shipping option from China to the US for one unit, or None."""
    import httpx
    from app.api.v1.endpoints.dropshipping import CJ_BASE
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(f"{CJ_BASE}/logistic/freightCalculate", headers={"CJ-Access-Token": token},
                                  json={"startCountryCode": "CN", "endCountryCode": "US", "products": [{"vid": vid, "quantity": 1}]})
        data = r.json()
        prices = [float(o.get("logisticPrice") or o.get("price") or 0) for o in (data.get("data") or []) if data.get("result")]
        prices = [p for p in prices if p >= 0]
        return min(prices) if prices else None
    except Exception as e:  # noqa: BLE001 - shipping is best effort; unknown is handled honestly downstream
        logger.warning(f"[intake] CJ shipping lookup failed: {type(e).__name__}")
        return None


def _import_cj(db: Session, item: IntakeItem) -> Product:
    from app.api.v1.endpoints import admin as A

    async def run() -> Product:
        conn = A._get_system_cj_connection(db, A._CATALOGUE)
        token = await A._cj_ensure_token(conn, db)
        product = await A._cj_import_one(db, A._CATALOGUE, token, item.supplier_ref, None, None)
        product.is_active = False
        link = db.query(DropshipProductLink).filter(DropshipProductLink.product_id == product.id, DropshipProductLink.is_primary == True).first()  # noqa: E712
        if link and link.supplier_sku:
            ship = await _cj_us_shipping(token, link.supplier_sku)
            if ship is not None:
                product.shipping_cost = ship
        return product

    product = asyncio.run(run())
    A._ensure_prodora_codes(db)
    db.commit()
    return product


def _import_aliexpress(db: Session, item: IntakeItem) -> Product:
    from app.api.v1.endpoints import admin as A
    from app.models.dropship import DropshipConnection

    conn = db.query(DropshipConnection).filter(
        DropshipConnection.shop_id.is_(None), DropshipConnection.supplier_type == "aliexpress", DropshipConnection.is_active == True).first()  # noqa: E712
    if not conn:
        raise RuntimeError("AliExpress is not connected. Connect it from Add Products first.")
    token = asyncio.run(A._aliexpress_ensure_token(conn, db))
    product = A._aliexpress_import_one(db, A._CATALOGUE, token, item.source_url, None, None, active=False)
    A._ensure_prodora_codes(db)
    db.commit()
    return product


# Replaceable in tests.
IMPORTERS: Dict[str, Callable[[Session, IntakeItem], Product]] = {"cj": _import_cj, "aliexpress": _import_aliexpress}


def _apply_verdict(item: IntakeItem, evaluation: dict) -> None:
    item.verdict = evaluation.get("verdict")
    item.confidence = evaluation.get("confidence")
    item.margin_pct = (evaluation.get("economics") or {}).get("margin_before_ads_pct")
    item.competitor_count = evaluation.get("competitor_count")


def sync_from_analysis(db: Session, product_id: int, evaluation: dict) -> None:
    """Keep the queue's copy of the verdict in step when someone re-runs an analysis."""
    for it in db.query(IntakeItem).filter(IntakeItem.product_id == product_id).all():
        _apply_verdict(it, evaluation)


def process_item(item_id: int) -> None:
    """Import one queued item, analyse it, leave it ready. Never raises."""
    db = SessionLocal()
    try:
        # Claim it atomically so two workers can never import the same item twice.
        claimed = db.query(IntakeItem).filter(IntakeItem.id == item_id, IntakeItem.status == "queued").update({"status": "importing"})
        db.commit()
        if not claimed:
            return
        item = db.query(IntakeItem).filter(IntakeItem.id == item_id).first()
        try:
            product = IMPORTERS[item.supplier_type](db, item)
        except Exception as e:  # noqa: BLE001
            db.rollback()
            item = db.query(IntakeItem).filter(IntakeItem.id == item_id).first()
            item.status, item.error = "failed", _detail_of(e)
            db.commit()
            return
        item = db.query(IntakeItem).filter(IntakeItem.id == item_id).first()
        item.product_id = product.id
        item.status = "analyzing"
        db.commit()
        if get_settings(db).auto_analyze:
            _analyze(db, item, product)
        item = db.query(IntakeItem).filter(IntakeItem.id == item_id).first()
        item.status = "ready"
        db.commit()
    except Exception as e:  # noqa: BLE001 - a worker must never die silently mid-batch
        logger.error(f"[intake] item {item_id} crashed: {type(e).__name__}: {e}")
        try:
            db.rollback()
            it = db.query(IntakeItem).filter(IntakeItem.id == item_id).first()
            if it and it.status in ("importing", "analyzing"):
                it.status, it.error = "failed", _detail_of(e)
                db.commit()
        except Exception:  # noqa: BLE001
            pass
    finally:
        db.close()


def _analyze(db: Session, item: IntakeItem, product: Product) -> None:
    """Free analysis only (eBay). Paid lookups are a person's decision, made on the
    shortlist. A failure here never blocks review: the item just has no verdict."""
    from app.intel import engine
    try:
        out = engine.analyze(db, product, market="US", target_margin_pct=30.0, use_paid=False, user_id=item.added_by_user_id)
        _apply_verdict(item, out["evaluation"])
        db.commit()
    except Exception as e:  # noqa: BLE001
        db.rollback()
        logger.warning(f"[intake] analysis skipped for item {item.id}: {_detail_of(e)}")
        item = db.query(IntakeItem).filter(IntakeItem.id == item.id).first()
        item.error = f"Not analysed: {_detail_of(e)}"[:500]
        db.commit()


def submit(ids: Iterable[int]) -> None:
    for i in ids:
        _pool.submit(process_item, i)


# ── The human decision ───────────────────────────────────────────────────────

class IntakeError(Exception):
    pass


def approve(db: Session, item: IntakeItem, user_id: int) -> None:
    if item.status != "ready":
        raise IntakeError("Only products that are ready for review can be approved.")
    now = datetime.now(timezone.utc)
    item.status, item.reviewed_by_user_id, item.reviewed_at, item.approved_at = "approved", user_id, now, now


def reject(db: Session, item: IntakeItem, user_id: int, reason: Optional[str]) -> None:
    if item.status in ("published",):
        raise IntakeError("A published product can't be rejected here. Edit or remove it from All Products.")
    if item.status in ("importing", "analyzing"):
        raise IntakeError("It is still being imported. Try again in a moment.")
    product = db.query(Product).filter(Product.id == item.product_id).first() if item.product_id else None
    if product and not product.is_active:
        # A rejected draft is removed so the catalogue does not fill with junk.
        db.query(DropshipProductLink).filter(DropshipProductLink.product_id == product.id).delete()
        db.delete(product)
    item.product_id = None
    item.status, item.reviewed_by_user_id, item.reviewed_at = "rejected", user_id, datetime.now(timezone.utc)
    item.reject_reason = (reason or "").strip()[:300] or None


def retry(db: Session, item: IntakeItem) -> None:
    if item.status != "failed":
        raise IntakeError("Only failed items can be retried.")
    item.status, item.error = "queued", None


# ── Publishing ───────────────────────────────────────────────────────────────

def published_today(db: Session, now: Optional[datetime] = None) -> int:
    now = now or datetime.now(timezone.utc)
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    return db.query(func.count(IntakeItem.id)).filter(IntakeItem.status == "published", IntakeItem.published_at >= start).scalar() or 0


def publish_due(db: Session, count: Optional[int] = None, now: Optional[datetime] = None, user_id: Optional[int] = None) -> List[int]:
    """Make approved products visible. `count=None` means "whatever is left of
    today's daily limit"; an explicit count is a manual publish. Best verdicts
    first (TEST, WATCH, unanalysed, AVOID), then oldest approval."""
    now = now or datetime.now(timezone.utc)
    s = get_settings(db)
    remaining = max(0, s.daily_publish_limit - published_today(db, now)) if count is None else max(0, min(count, 500))
    if remaining == 0:
        return []
    rank = case((IntakeItem.verdict == "TEST", 0), (IntakeItem.verdict == "WATCH", 1), (IntakeItem.verdict == "AVOID", 3), else_=2)
    items = (db.query(IntakeItem).filter(IntakeItem.status == "approved")
             .order_by(rank.asc(), IntakeItem.approved_at.asc(), IntakeItem.id.asc()).limit(remaining).all())
    done: List[int] = []
    for it in items:
        product = db.query(Product).filter(Product.id == it.product_id).first() if it.product_id else None
        if not product:
            it.status, it.error = "failed", "The product is gone, so it could not be published."
            continue
        product.is_active = True
        it.status, it.published_at = "published", now
        done.append(it.id)
    if done:
        from app.api.v1.endpoints import admin as A
        A._ensure_prodora_codes(db)
    db.commit()
    for i in done:
        it = db.query(IntakeItem).filter(IntakeItem.id == i).first()
        record_event(db, "prodora_product_published", user_id=user_id, entity_type="prodora_product", entity_id=it.product_id,
                     payload={"verdict": it.verdict, "manual": count is not None})
    return done


def tick(db: Session, now: Optional[datetime] = None) -> dict:
    """The scheduler's periodic job (every few minutes)."""
    now = now or datetime.now(timezone.utc)
    out = {"requeued": 0, "picked_up": 0, "published": 0}
    cutoff = now - STUCK_AFTER
    stuck = db.query(IntakeItem).filter(IntakeItem.status.in_(("importing", "analyzing")), IntakeItem.updated_at < cutoff).all()
    for it in stuck:                       # a restart or crash mid-import: try again
        it.status = "queued"
        out["requeued"] += 1
    db.commit()
    queued = [i for (i,) in db.query(IntakeItem.id).filter(IntakeItem.status == "queued").limit(200).all()]
    out["picked_up"] = len(queued)
    submit(queued)
    s = get_settings(db)
    if s.auto_publish_enabled and now.hour >= s.publish_hour_utc:
        out["published"] = len(publish_due(db, now=now))
    return out
