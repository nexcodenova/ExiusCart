"""
Shared pieces every marketplace/store order sync (Shopify, WooCommerce, eBay,
Etsy, TikTok Shop, Daraz, BigCommerce) needs so its orders can be
auto-fulfilled the same way an ExiusCart checkout order is:

  - match_sku: the seller's OWN product (and the exact variant) for a line
    item's SKU. Scoped to the shop — a variant SKU lookup without the shop
    filter could pick up another seller's product.
  - address_json: the destination as the JSON fields cj_fulfil.parse_shipping
    reads (free text can't be shipped safely, so each sync maps its API's
    own address fields here).
  - queue_auto_fulfill: hands paid orders to dropshipping._bg_try_auto_fulfill
    from any context (request handler, background task, scheduler thread).
"""
import asyncio
import json
import logging
import threading
from datetime import datetime, timedelta, timezone
from typing import Iterable, Optional, Tuple

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# An auto-fulfil switch turned on before auto_fulfill_enabled_at existed has
# no recorded time; only orders this recent are sent for those, so a first
# sync over the last 7 days can't re-send orders already handled by hand.
UNKNOWN_ENABLE_WINDOW = timedelta(hours=48)


def match_sku(db: Session, shop_id: int, sku: Optional[str]):
    """(product, variant) of this shop for a SKU; variant is None when the SKU
    is the product's own. (None, None) when nothing of this shop matches."""
    from app.models.product import Product
    from app.models.product_variant import ProductVariant
    if not sku:
        return None, None
    product = db.query(Product).filter(Product.shop_id == shop_id, Product.sku == sku).first()
    if product:
        return product, None
    row = (
        db.query(ProductVariant, Product)
        .join(Product, Product.id == ProductVariant.product_id)
        .filter(Product.shop_id == shop_id, ProductVariant.sku == sku)
        .first()
    )
    return (row[1], row[0]) if row else (None, None)


def address_json(name=None, address1=None, address2=None, city=None, province=None,
                 zip=None, country_code=None, country=None, phone=None, email=None) -> Optional[str]:
    fields = {
        "name": name, "address1": address1, "address2": address2, "city": city, "province": province,
        "zip": zip, "country_code": country_code, "country": country, "phone": phone, "email": email,
    }
    clean = {k: str(v).strip() for k, v in fields.items() if v not in (None, "") and str(v).strip()}
    return json.dumps(clean) if clean else None


def join_name(first, last) -> str:
    return " ".join(p for p in (first, last) if p).strip()


def _as_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def should_auto_fulfill(db: Session, shop_id: int, placed_at: Optional[datetime]) -> bool:
    """True when this shop has auto-fulfil on AND the order was placed after it
    was switched on. Orders from before that were the seller's to handle."""
    from app.models.dropship import DropshipConnection
    conns = db.query(DropshipConnection).filter(
        DropshipConnection.shop_id == shop_id,
        DropshipConnection.is_active == True,
        DropshipConnection.auto_fulfill_enabled == True,
    ).all()
    if not conns:
        return False
    placed = _as_utc(placed_at) or datetime.now(timezone.utc)
    enabled_times = [_as_utc(c.auto_fulfill_enabled_at) for c in conns if c.auto_fulfill_enabled_at]
    if enabled_times:
        return placed >= min(enabled_times)
    return placed >= datetime.now(timezone.utc) - UNKNOWN_ENABLE_WINDOW


def queue_auto_fulfill(shop_id: int, order_ids: Iterable[int]) -> None:
    """Runs the auto-fulfil step for each order on its own thread and event
    loop, so a plain (sync) order sync can call it right after committing.
    The step opens its own DB session and never raises."""
    ids = [i for i in order_ids if i]
    if not ids:
        return

    def _run():
        from app.api.v1.endpoints.dropshipping import _bg_try_auto_fulfill
        for oid in ids:
            try:
                asyncio.run(_bg_try_auto_fulfill(shop_id, oid))
            except Exception as e:  # never let one order stop the rest
                logger.error(f"[AUTO-FULFILL] shop={shop_id} order={oid} queue run failed: {e}")

    threading.Thread(target=_run, name=f"auto-fulfil-{shop_id}", daemon=True).start()


def take_paid_stock(db: Session, order_id: int) -> None:
    """Stock follows payment (the same rule as checkout and the channel webhook):
    a channel order takes its units off when it is paid, so cancelling it later
    can put them back without inventing stock."""
    from app.models.order import OrderItem
    from app.models.product import Product
    from app.models.product_variant import ProductVariant
    for item in db.query(OrderItem).filter(OrderItem.order_id == order_id).all():
        if not item.product_id:
            continue
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if product:
            product.quantity = max(0, (product.quantity or 0) - item.quantity)
            product.units_sold = (product.units_sold or 0) + item.quantity
        if item.variant_id:
            variant = db.query(ProductVariant).filter(ProductVariant.id == item.variant_id).first()
            if variant:
                variant.quantity = max(0, (variant.quantity or 0) - item.quantity)


def parse_time(value) -> Optional[datetime]:
    """A channel's order time as aware UTC: epoch seconds or an ISO/RFC string."""
    if value in (None, ""):
        return None
    try:
        if isinstance(value, (int, float)) or (isinstance(value, str) and value.isdigit()):
            return datetime.fromtimestamp(int(value), tz=timezone.utc)
        s = str(value).strip()
        try:
            return _as_utc(datetime.fromisoformat(s.replace("Z", "+00:00")))
        except ValueError:
            from email.utils import parsedate_to_datetime
            return _as_utc(parsedate_to_datetime(s))
    except Exception:
        return None
