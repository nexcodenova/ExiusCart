"""
Channel Integrations — connect ExiusCart shops to external sales platforms.

Flow:
  ExiusCart → pushes products TO channels   (TheDersi, Shopify, etc.)
  Channels  → push orders BACK to ExiusCart (via webhook URL)

Supported channels:
  thedersi   — Sri Lankan fashion marketplace
  shopify    — Shopify store
  woocommerce — WooCommerce site
  custom     — any custom website using our storefront API
  daraz      — Daraz.lk marketplace (paid plans only); credentials stored as app_key|app_secret in channel_api_key
"""
import os
import secrets
import uuid
import logging
import httpx
from slugify import slugify
from datetime import datetime, timezone
from typing import Dict, List, Optional, Union

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Header, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db, SessionLocal
from app.core.thedersi import MONTHLY_ORDER_LIMITS, notify_thedersi, verify_thedersi_signature, is_thedersi_shop
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.shop import Shop
from app.models.channel import ChannelConnection
from app.models.product import Product
from app.models.order import Order, OrderItem
from app.models.customer import Customer
from app.models.channel_order_meta import ChannelOrderMeta
from app.models.channel_product_status import ChannelProductStatus
from app.models.channel_category import ChannelCategory, ProductChannelCategory, ProductStorefrontCategory
from app.models.product_variant import ProductVariant
from app.models.bundle_component import BundleComponent
from app.models.subscription import Subscription
from app.models.thedersi_seller import TheDersiSeller

router = APIRouter()

EXIUSCART_BASE = os.getenv("EXIUSCART_API_BASE", "https://api.exiuscart.com/api/v1")

DEFAULT_CHANNEL_URLS = {
    "thedersi": os.getenv("THEDERSI_API_URL", "https://thedersi.lk/api/v1"),
}

# Marketplace channels require admin approval before products go live.
# Own-store channels (Shopify, WooCommerce) publish instantly — seller is their own admin.
MARKETPLACE_CHANNELS = {"thedersi"}

# How long a cached product-fields spec (TheDersi's /exiuscart/product-fields)
# is trusted before we refetch — the seller re-opening the product form
# repeatedly shouldn't hammer the channel's API for a list that rarely changes.
PRODUCT_FIELDS_CACHE_TTL_SECONDS = 60 * 60


# ── Schemas ───────────────────────────────────────────────────────────────────

class ChannelConnectIn(BaseModel):
    channel_type: str                        # "thedersi" | "shopify" | "woocommerce" | "custom"
    channel_api_key: str                     # API key TheDersi gave to this seller
    channel_api_url: Optional[str] = None   # optional override
    channel_seller_id: Optional[str] = None


class BundleSelectionIn(BaseModel):
    component_product_id: int
    variant_id: int


class OrderItemIn(BaseModel):
    exiuscart_product_id: Optional[Union[int, str]] = None  # TheDersi sends int, future may send str
    product_name: Optional[str] = None
    quantity: int
    unit_price: float
    item_total: Optional[float] = None
    size: Optional[str] = None
    color: Optional[str] = None
    is_gift: bool = False  # TheDersi checkout free-gift item — always $0, seller still packs & ships it
    # Which specific variant the buyer picked per bundle component — one
    # entry per component that had options to choose from. Empty/absent for
    # non-bundle items, or if every component was fixed with no choice.
    bundle_selections: List[BundleSelectionIn] = []

    def parsed_product_id(self) -> Optional[int]:
        """Return integer product id, stripping any non-numeric prefix like 'prod_'."""
        if self.exiuscart_product_id is None:
            return None
        try:
            return int(self.exiuscart_product_id)
        except (ValueError, TypeError):
            stripped = ''.join(filter(str.isdigit, str(self.exiuscart_product_id)))
            return int(stripped) if stripped else None


class ChannelOrderWebhook(BaseModel):
    channel_order_id: str
    buyer_name: Optional[str] = None
    buyer_email: Optional[str] = None
    buyer_phone: Optional[str] = None
    shipping_address: Optional[str] = None
    items: List[OrderItemIn]
    subtotal: float
    total: float
    currency: str = "LKR"
    payment_status: Optional[str] = None        # "paid" | "pending" — TheDersi sends "paid"
    payment_method: Optional[str] = None        # "cod" | "bank_transfer" | "payhere" | "koko" | "mintpay"
    # Delivery info (TheDersi specific)
    delivery_fee: Optional[float] = None
    delivery_paid_by: Optional[str] = None      # "customer" (prepaid at checkout) | "seller" (free-delivery order)
    delivery_note: Optional[str] = None
    delivery_fee_share: Optional[float] = None  # this seller's cut, already included in seller_net_earnings
    # Commission info (TheDersi specific)
    seller_plan: Optional[str] = None
    commission_rate: Optional[float] = None
    commission_amount: Optional[float] = None
    seller_net_earnings: Optional[float] = None
    # Gift wrap (TheDersi specific)
    gift_wrap: Optional[bool] = False
    gift_wrap_fee: Optional[float] = 0
    gift_message: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _shop_or_404(shop_id: int, user: User, db: Session) -> Shop:
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


def _channel_url(conn: ChannelConnection) -> str:
    return (conn.channel_api_url or DEFAULT_CHANNEL_URLS.get(conn.channel_type, "")).rstrip("/")


def _webhook_url(conn: ChannelConnection) -> str:
    return f"{EXIUSCART_BASE.rstrip('/')}/channels/webhook/{conn.webhook_secret}"


def _bundle_components_payload(product: Product, db: Session) -> list:
    """Full breakdown of a bundle's components for channels that can show a
    real picker (e.g. TheDersi) — each component lists the specific
    size/color options a buyer may choose between, not just a bundle
    yes/no flag. Empty "options" means that component has no size/color
    choice at all — it's just added as-is."""
    parts = db.query(BundleComponent).filter(BundleComponent.bundle_product_id == product.id).all()
    result = []
    for part in parts:
        comp = db.query(Product).filter(Product.id == part.component_product_id).first()
        if not comp:
            continue
        allowed_ids = part.allowed_variant_ids or []
        options = []
        if allowed_ids:
            variants = db.query(ProductVariant).filter(ProductVariant.id.in_(allowed_ids)).all()
            options = [
                {"variant_id": v.id, "size": v.size, "color": v.color, "color_hex": v.color_hex, "sku": v.sku, "quantity": v.quantity}
                for v in variants
            ]
        result.append({
            "component_product_id": comp.id,
            "component_product_name": comp.name,
            "quantity": part.quantity,
            "options": options,
        })
    return result


# thedersi — Sri Lankan marketplace, its own fixed local currency, not
# something a seller configures (matches THEDERSI_STAFF_DOMAIN accounts
# defaulting to LKR elsewhere). eBay/Shopify/WooCommerce don't have a
# fixed currency — each seller's own store on that channel uses whatever
# currency THEY set up there, which ExiusCart can only know if the seller
# states it (see ChannelConnection.channel_currency, set at connect time,
# same "has to be real, not assumed" reasoning as seller_country on that
# same model). This map is only the channels with a currency that's
# always true regardless of the seller — a fallback of last resort, not
# the primary source.
CHANNEL_CURRENCY = {"thedersi": "LKR"}


def _product_payload(
    product: Product,
    currency: str,
    channel_type: str,
    channel_category_id: str = None,
    channel_sub_category_id: str = None,
    is_gift: bool = False,
    db: Session = None,
    field_values: Optional[dict] = None,
    channel_currency: Optional[str] = None,
) -> dict:
    status = "pending_review" if channel_type in MARKETPLACE_CHANNELS else "active"
    category = channel_category_id or None
    sub_category = channel_sub_category_id or None

    # `currency` in is the shop's base_currency — what product.price is
    # actually stored in (see Shop.currency's own comment). Previously this
    # parameter was accepted and completely unused: every channel received
    # a bare number with zero currency context, so a EUR-priced shop's €80
    # item showed up as "80" on TheDersi and got rendered "Rs 80" — a real
    # ~24,000x pricing error, not just a cosmetic label issue.
    #
    # Target currency priority: the seller's own stated channel_currency
    # (most trustworthy — they know their own Shopify/eBay store's
    # currency) → the fixed CHANNEL_CURRENCY map (thedersi only) → no
    # conversion at all (source_currency itself), since guessing wrong is
    # worse than not converting.
    from app.core.currency import convert_amount_sync
    source_currency = currency or "USD"
    target_currency = channel_currency or CHANNEL_CURRENCY.get(channel_type, source_currency)

    def _conv(amount: float) -> float:
        return convert_amount_sync(amount, source_currency, target_currency)

    variants = [
        {
            "size": v.size,
            "color": v.color,
            "color_hex": v.color_hex,
            "sku": v.sku,
            "quantity": v.quantity,
            "price": _conv(float(v.price)) if v.price is not None else None,
            "image_url": v.image_url or None,
        }
        for v in (product.variants or [])
    ]
    total_stock = sum(v["quantity"] for v in variants) if variants else product.quantity

    compare_at_price = _conv(float(product.compare_at_price)) if product.compare_at_price else None
    selling_price = _conv(float(product.price))

    image_urls = [img.url for img in (product.images or []) if img.url]
    if not image_urls and product.image_url:
        image_urls = [product.image_url]
    # Include variant images in the gallery so TheDersi shows all product images
    for v in (product.variants or []):
        if v.image_url and v.image_url not in image_urls:
            image_urls.append(v.image_url)

    # Same multi-video list the Custom Website public API already sends
    # (see public.py's product payload) — falls back to the legacy single
    # video_url if the seller hasn't added any via the newer multi-video field.
    video_urls = [v.url for v in sorted(product.videos or [], key=lambda v: v.sort_order) if v.url]
    if not video_urls and product.video_url:
        video_urls = [product.video_url]

    payload = {
        "exiuscart_product_id": product.id,
        "name": product.name,
        "description": product.description or "",
        "currency": target_currency,
        "price": selling_price,
        "compare_at_price": compare_at_price,
        "quantity": total_stock,
        "image_urls": image_urls,
        "video_urls": video_urls,
        "category": category,
        "sub_category": sub_category,
        "variants": variants,
        "is_featured": False,
        "is_trending": False,
        "is_bundle": bool(product.is_bundle),
        "bundle_components": _bundle_components_payload(product, db) if (product.is_bundle and db is not None) else [],
        "is_gift": bool(is_gift),
    }

    # Dynamic per-channel product-fields spec (TheDersi's Material/Pattern/
    # Metal Type/etc, fetched live — see /product-fields below). Only the
    # fields the seller actually filled in go out, as extra top-level keys —
    # never overwrites a core key above even if a field key collided with one.
    if field_values:
        for key, value in field_values.items():
            if value and key not in payload:
                payload[key] = value

    return payload


def _parse_push_response(r: httpx.Response) -> dict:
    """Turn a channel's raw HTTP response into a clear ok/fail result — a non-2xx
    status is ALWAYS a failure, never silently reinterpreted as 'pending review'."""
    if 200 <= r.status_code < 300:
        try:
            return {"ok": True, "status": r.json().get("status"), "http_status": r.status_code, "error": None}
        except Exception as exc:
            logger.error(f"[CHANNEL PUSH] {r.status_code} but response body wasn't valid JSON: {exc} — body: {r.text[:500]}")
            return {"ok": False, "status": None, "http_status": r.status_code, "error": f"Unreadable success response: {r.text[:300]}"}
    body_snippet = r.text[:500]
    logger.error(f"[CHANNEL PUSH] FAILED — HTTP {r.status_code} — body: {body_snippet}")
    return {"ok": False, "status": None, "http_status": r.status_code, "error": body_snippet or f"HTTP {r.status_code}, no response body"}


def _push_one(payload: dict, conn: ChannelConnection) -> dict:
    """
    Push/update a product on the channel. Always returns:
      {"ok": bool, "status": str|None, "http_status": int|None, "error": str|None}
    "status" (e.g. 'pending_review'/'active') is only meaningful when ok=True.
    On failure, http_status + error carry the real diagnostic info — never
    silently defaulted to a fake success state.
    """
    api_url = _channel_url(conn)
    if not api_url:
        logger.warning(f"[CHANNEL PUSH] No API URL for channel {conn.channel_type} conn={conn.id}")
        return {"ok": False, "status": None, "http_status": None, "error": "No API URL configured for this channel connection"}
    headers = {"X-Api-Key": conn.channel_api_key, "Content-Type": "application/json"}
    pid = payload["exiuscart_product_id"]
    try:
        with httpx.Client(timeout=10) as client:
            r = client.put(f"{api_url}/exiuscart/products/{pid}", json=payload, headers=headers)
            logger.info(f"[CHANNEL PUSH] PUT {api_url}/exiuscart/products/{pid} → {r.status_code}")
            if r.status_code == 404:
                r2 = client.post(f"{api_url}/exiuscart/products", json=payload, headers=headers)
                logger.info(f"[CHANNEL PUSH] POST {api_url}/exiuscart/products → {r2.status_code}")
                return _parse_push_response(r2)
            return _parse_push_response(r)
    except Exception as exc:
        logger.error(f"[CHANNEL PUSH] {api_url} product={pid} error: {exc}")
        return {"ok": False, "status": None, "http_status": None, "error": str(exc)}


def _delete_one(product_id: int, conn: ChannelConnection):
    api_url = _channel_url(conn)
    if not api_url:
        logger.warning(f"[CHANNEL DELETE] No API URL for channel {conn.channel_type} conn={conn.id}")
        return
    headers = {"X-Api-Key": conn.channel_api_key}
    url = f"{api_url}/exiuscart/products/{product_id}"
    try:
        with httpx.Client(timeout=10) as client:
            r = client.delete(url, headers=headers)
            logger.info(f"[CHANNEL DELETE] DELETE {url} → {r.status_code}")
    except Exception as exc:
        logger.error(f"[CHANNEL DELETE] {url} error: {exc}")


# ── Background tasks (use fresh DB session) ───────────────────────────────────

def _bg_full_sync(shop_id: int, conn_id: int):
    """Re-push every product already listed on this connection (is_listed=True).
    Connecting a channel does NOT auto-list every product anymore — a seller
    opts each product in per channel, so a brand-new connection has nothing
    to sync yet. This mainly matters for the manual 'sync now' action, to
    re-push already-listed products in case of drift."""
    db = SessionLocal()
    try:
        conn = db.query(ChannelConnection).filter(ChannelConnection.id == conn_id).first()
        shop = db.query(Shop).filter(Shop.id == shop_id).first()
        if not conn or not shop:
            return
        listings = db.query(ProductChannelCategory).filter(
            ProductChannelCategory.channel_connection_id == conn_id,
            ProductChannelCategory.is_listed == True,
        ).all()
        products_by_id = {
            p.id: p for p in db.query(Product).filter(
                Product.id.in_([l.product_id for l in listings]), Product.is_active == True
            ).all()
        } if listings else {}
        for listing in listings:
            p = products_by_id.get(listing.product_id)
            if not p:
                continue
            result = _push_one(
                _product_payload(
                    p, shop.base_currency or shop.currency, conn.channel_type,
                    listing.channel_category_id, listing.channel_sub_category_id,
                    is_gift=listing.is_gift, db=db,
                    field_values=listing.channel_field_values,
                    channel_currency=conn.channel_currency,
                ),
                conn,
            )
            if not result["ok"]:
                logger.error(f"[FULL SYNC] product={p.id} shop={shop_id} channel={conn.channel_type} FAILED: HTTP {result['http_status']} — {result['error']}")
        conn.last_synced_at = datetime.now(timezone.utc)
        db.commit()
    finally:
        db.close()


def _bg_push_product(product_id: int, shop_id: int):
    """Push one product to every channel it's actually listed on (is_listed=True
    on that product's ProductChannelCategory row) — not every active connection.
    A product with nothing toggled on anywhere simply pushes to nothing."""
    db = SessionLocal()
    try:
        product = db.query(Product).filter(Product.id == product_id).first()
        shop = db.query(Shop).filter(Shop.id == shop_id).first()
        if not product or not shop:
            logger.warning(f"[BG PUSH] product={product_id} shop={shop_id} not found — skipping")
            return

        listings = db.query(ProductChannelCategory).filter(
            ProductChannelCategory.product_id == product_id,
            ProductChannelCategory.is_listed == True,
        ).all()
        if not listings:
            logger.info(f"[BG PUSH] product={product_id} not listed on any channel — nothing to push")
            return

        connections = {
            c.id: c for c in db.query(ChannelConnection).filter(
                ChannelConnection.id.in_([l.channel_connection_id for l in listings]),
                ChannelConnection.is_active == True,
            ).all()
        }
        logger.info(f"[BG PUSH] product={product_id} shop={shop_id} → {len(connections)} listed connection(s)")
        for listing in listings:
            conn = connections.get(listing.channel_connection_id)
            if not conn:
                continue  # connection was deactivated since this listing was set
            push_result = _push_one(
                _product_payload(
                    product, shop.base_currency or shop.currency, conn.channel_type,
                    listing.channel_category_id, listing.channel_sub_category_id,
                    is_gift=listing.is_gift, db=db,
                    field_values=listing.channel_field_values,
                    channel_currency=conn.channel_currency,
                ),
                conn,
            )
            if conn.channel_type in MARKETPLACE_CHANNELS:
                existing = db.query(ChannelProductStatus).filter(
                    ChannelProductStatus.product_id == product_id,
                    ChannelProductStatus.channel_type == conn.channel_type,
                ).first()

                if push_result["ok"]:
                    # Use TheDersi's response status directly.
                    # "pending_review" = sensitive fields changed (name/desc/images) → needs admin review.
                    # "active" = non-sensitive update (price/stock/category) → goes live immediately.
                    new_status = push_result["status"] if push_result["status"] in ("pending_review", "active") else "pending_review"
                    new_rejection_reason = None
                else:
                    # Never mislabel a failed request as "pending review" — the seller
                    # needs to see this actually failed to reach TheDersi at all.
                    new_status = "sync_failed"
                    new_rejection_reason = f"HTTP {push_result['http_status'] or 'no response'}: {push_result['error'] or 'unknown error'}"[:500]
                    logger.error(f"[BG PUSH] product={product_id} channel={conn.channel_type} SYNC FAILED — {new_rejection_reason}")

                if existing:
                    existing.status = new_status
                    existing.rejection_reason = new_rejection_reason
                else:
                    db.add(ChannelProductStatus(
                        product_id=product_id,
                        shop_id=shop_id,
                        channel_type=conn.channel_type,
                        status=new_status,
                        rejection_reason=new_rejection_reason,
                    ))
        db.commit()
    except Exception as exc:
        logger.error(f"[BG PUSH] product={product_id} shop={shop_id} FAILED: {exc}")
    finally:
        db.close()


def _bg_delete_product_and_notify(product_id: int, shop_id: int, channel_connection_id: int = None):
    """Delete product from channel(s) — separate from DB delete so it survives
    process restarts. If channel_connection_id is given, only that one
    connection is notified (a seller un-toggled a single channel). Otherwise
    every active connection is notified (the product itself was deleted)."""
    db = SessionLocal()
    try:
        query = db.query(ChannelConnection).filter(
            ChannelConnection.shop_id == shop_id, ChannelConnection.is_active == True
        )
        if channel_connection_id is not None:
            query = query.filter(ChannelConnection.id == channel_connection_id)
        connections = query.all()
        logger.info(f"[BG DELETE] product={product_id} shop={shop_id} → {len(connections)} connection(s)")
        for conn in connections:
            _delete_one(product_id, conn)
    except Exception as exc:
        logger.error(f"[BG DELETE] product={product_id} shop={shop_id} FAILED: {exc}")
    finally:
        db.close()


# ── Public helpers (called from products.py) ──────────────────────────────────

def trigger_product_sync(product_id: int, shop_id: int, background_tasks: BackgroundTasks):
    background_tasks.add_task(_bg_push_product, product_id, shop_id)


def trigger_product_delete(product_id: int, shop_id: int, background_tasks: BackgroundTasks, channel_connection_id: int = None):
    background_tasks.add_task(_bg_delete_product_and_notify, product_id, shop_id, channel_connection_id)


def _bg_push_stock(product_id: int, shop_id: int):
    """
    Push updated stock levels to every marketplace channel this product is
    actually listed on (is_listed=True), after any inventory change (POS
    sale, manual adjustment, order fulfillment). Only marketplace channels
    (TheDersi) need this — own-store channels manage stock internally.
    """
    db = SessionLocal()
    try:
        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            return
        listed_conn_ids = [
            l.channel_connection_id for l in db.query(ProductChannelCategory).filter(
                ProductChannelCategory.product_id == product_id,
                ProductChannelCategory.is_listed == True,
            ).all()
        ]
        if not listed_conn_ids:
            return
        connections = db.query(ChannelConnection).filter(
            ChannelConnection.id.in_(listed_conn_ids),
            ChannelConnection.shop_id == shop_id,
            ChannelConnection.is_active == True,
            ChannelConnection.channel_type.in_(MARKETPLACE_CHANNELS),
        ).all()
        for conn in connections:
            api_url = _channel_url(conn)
            if not api_url:
                continue
            # Always use product.quantity as the authoritative total.
            # Variant quantities are not updated by POS/reservation deductions,
            # so using sum(variants) would send stale numbers.
            variants = db.query(ProductVariant).filter(ProductVariant.product_id == product_id).all()
            stock_payload = {"quantity": product.quantity or 0}
            if variants:
                stock_payload["variants"] = [
                    {"size": v.size, "color": v.color, "quantity": v.quantity}
                    for v in variants
                ]

            try:
                with httpx.Client(timeout=8) as client:
                    r = client.patch(
                        f"{api_url}/exiuscart/products/{product_id}/stock",
                        json=stock_payload,
                        headers={"X-Api-Key": conn.channel_api_key},
                    )
                msg = f"[STOCK SYNC] {conn.channel_type} product={product_id} qty={stock_payload['quantity']} → HTTP {r.status_code} {r.text[:120]}"
                print(msg, flush=True)
                logger.info(msg)
            except Exception as exc:
                err = f"[STOCK SYNC] {conn.channel_type} product={product_id} FAILED: {exc}"
                print(err, flush=True)
                logger.error(err)
    finally:
        db.close()


def trigger_stock_sync(product_id: int, shop_id: int, background_tasks: BackgroundTasks):
    background_tasks.add_task(_bg_push_stock, product_id, shop_id)


# ── Channel management endpoints ──────────────────────────────────────────────

@router.post("/shops/{shop_id}/channels", status_code=201)
def connect_channel(
    shop_id: int,
    data: ChannelConnectIn,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Connect a shop to an external channel.
    On connect, all existing active products are immediately synced to the channel.
    Returns a webhook_url — give this to the channel developer so they can send orders back.
    """
    _shop_or_404(shop_id, current_user, db)

    existing = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.channel_type == data.channel_type,
        ChannelConnection.is_active == True,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Already connected to {data.channel_type}")

    sub = db.query(Subscription).filter(Subscription.shop_id == shop_id).order_by(Subscription.id.desc()).first()
    plan_type = sub.plan_type if sub else "free_trial"

    # TheDersi users: only TheDersi channel + Daraz (Pro only). Detected via
    # an active TheDersi connection, not plan_type — TheDersi's Growth/
    # Premium tier maps to plan_type='starter', same as a direct customer.
    if is_thedersi_shop(shop_id, db):
        if data.channel_type not in ("thedersi", "daraz"):
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "channel_not_available",
                    "plan": plan_type,
                    "message": "Your plan is managed by TheDersi. Only TheDersi and Daraz channels are available on TheDersi plans.",
                },
            )
        if data.channel_type == "daraz" and plan_type != "thedersi_pro":
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "daraz_requires_pro",
                    "plan": plan_type,
                    "message": "Daraz sync is available on TheDersi Pro. Upgrade your TheDersi plan to connect Daraz.",
                },
            )

    # Free trial + Starter: max 1 active channel connection; Premium = unlimited
    if plan_type in ("free_trial", "starter"):
        active_count = db.query(ChannelConnection).filter(
            ChannelConnection.shop_id == shop_id,
            ChannelConnection.is_active == True,
        ).count()
        if active_count >= 1:
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "channel_limit_reached",
                    "limit": 1,
                    "plan": plan_type,
                    "message": "Your plan allows 1 channel connection. Upgrade to Premium (99 AED/mo) to connect all channels.",
                },
            )

    conn = ChannelConnection(
        shop_id=shop_id,
        channel_type=data.channel_type,
        channel_api_key=data.channel_api_key,
        channel_api_url=data.channel_api_url,
        channel_seller_id=data.channel_seller_id,
        webhook_secret=secrets.token_urlsafe(32),
    )
    db.add(conn)
    db.commit()
    db.refresh(conn)

    background_tasks.add_task(_bg_full_sync, shop_id, conn.id)

    return {
        "id": conn.id,
        "channel_type": conn.channel_type,
        "webhook_url": _webhook_url(conn),
        "message": f"Connected to {data.channel_type}. All products syncing in background.",
        "instruction": "Give webhook_url to the channel developer — they call it when a buyer places an order.",
    }


@router.get("/shops/{shop_id}/channels")
def list_channels(
    shop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    conns = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.is_active == True,
    ).all()
    return [
        {
            "id": c.id,
            "channel_type": c.channel_type,
            "channel_seller_id": c.channel_seller_id,
            "channel_api_url": c.channel_api_url,
            "channel_warehouse_code": c.channel_warehouse_code,
            "seller_country": c.seller_country,
            "channel_currency": c.channel_currency,
            "last_synced_at": c.last_synced_at,
            "webhook_url": _webhook_url(c),
            "seller_status": c.seller_status,
        }
        for c in conns
    ]


class ChannelCurrencyIn(BaseModel):
    channel_currency: Optional[str] = None


@router.put("/shops/{shop_id}/channels/{channel_id}/currency")
def set_channel_currency(
    shop_id: int,
    channel_id: int,
    data: ChannelCurrencyIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lets a seller state what currency THIS channel's own store actually
    uses (their Shopify/eBay store's own currency setting) — see
    ChannelConnection.channel_currency's own comment for why ExiusCart
    can't know this on its own. Null clears it back to "don't convert"."""
    _shop_or_404(shop_id, current_user, db)
    conn = db.query(ChannelConnection).filter(
        ChannelConnection.id == channel_id, ChannelConnection.shop_id == shop_id,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Channel connection not found")
    conn.channel_currency = (data.channel_currency or "").strip().upper() or None
    db.commit()
    return {"channel_currency": conn.channel_currency}


class ChannelSiteUrlIn(BaseModel):
    site_url: Optional[str] = None


@router.put("/shops/{shop_id}/channels/{channel_id}/site-url")
def set_channel_site_url(
    shop_id: int,
    channel_id: int,
    data: ChannelSiteUrlIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The public address of the seller's own storefront (Custom Website /
    WooCommerce / BigCommerce). Stored in channel_api_url — used for the
    'View site' link and to show the real site name instead of the internal
    shop slug. Normalized to include a scheme; null clears it."""
    _shop_or_404(shop_id, current_user, db)
    conn = db.query(ChannelConnection).filter(
        ChannelConnection.id == channel_id, ChannelConnection.shop_id == shop_id,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Channel connection not found")
    url = (data.site_url or "").strip()
    if url and not url.lower().startswith(("http://", "https://")):
        url = "https://" + url
    conn.channel_api_url = url.rstrip("/") or None
    db.commit()
    return {"channel_api_url": conn.channel_api_url}


@router.delete("/shops/{shop_id}/channels/{channel_id}", status_code=200)
def disconnect_channel(
    shop_id: int,
    channel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    conn = db.query(ChannelConnection).filter(
        ChannelConnection.id == channel_id,
        ChannelConnection.shop_id == shop_id,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Channel not found")
    conn.is_active = False
    db.commit()
    return {"message": f"Disconnected from {conn.channel_type}"}


@router.post("/shops/{shop_id}/channels/{channel_id}/sync")
def manual_sync(
    shop_id: int,
    channel_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Force re-sync all products to a connected channel."""
    _shop_or_404(shop_id, current_user, db)
    conn = db.query(ChannelConnection).filter(
        ChannelConnection.id == channel_id,
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.is_active == True,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Channel not found")
    background_tasks.add_task(_bg_full_sync, shop_id, conn.id)
    return {"message": "Full product sync started in background"}


# ── Webhook receiver — channels call this when orders are placed ──────────────

class CancelWebhook(BaseModel):
    channel_order_id: str
    status: str = "cancelled"
    payment_status: Optional[str] = None   # "refunded" or None
    reason: Optional[str] = None


@router.post("/channels/webhook/{webhook_secret}/cancel")
async def receive_cancel_webhook(
    webhook_secret: str,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Called by TheDersi when their admin cancels an order (customer request or dispute).
    1. Finds the ExiusCart order by channel_order_id.
    2. Sets order.status = 'cancelled', payment_status = 'refunded' (if applicable).
    3. Restores product stock for all items (only if order was previously paid).
    4. Pushes restored stock back to TheDersi so both sides stay in sync.
    TheDersi handles all customer and seller email notifications on their side.
    """
    body = await request.body()
    x_sig = request.headers.get("X-Signature", "")
    if not verify_thedersi_signature(body, x_sig):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        payload = CancelWebhook.model_validate_json(body)
    except Exception as exc:
        logger.error(f"[CANCEL-WEBHOOK] parse error: {exc} | body={body[:300]}")
        raise HTTPException(status_code=422, detail=f"Invalid payload: {exc}")

    conn = db.query(ChannelConnection).filter(
        ChannelConnection.webhook_secret == webhook_secret,
        ChannelConnection.is_active == True,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Invalid webhook URL")

    # Normalise channel_order_id (strip duplicate TD- prefix if present)
    chan_id = payload.channel_order_id
    while chan_id.startswith("TD-TD-"):
        chan_id = chan_id[3:]

    meta = db.query(ChannelOrderMeta).filter(
        ChannelOrderMeta.channel_type == conn.channel_type,
        ChannelOrderMeta.channel_order_id == chan_id,
    ).first()
    if not meta:
        logger.warning(f"[CANCEL-WEBHOOK] channel_order_id not found: {chan_id}")
        raise HTTPException(status_code=404, detail=f"Order not found: {chan_id}")

    order = db.query(Order).filter(Order.id == meta.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="ExiusCart order record missing")

    # Idempotent — already cancelled, nothing to do
    if order.status == "cancelled":
        return {
            "success": True,
            "message": "Order already cancelled",
            "order_number": order.order_number,
        }

    was_paid = (order.payment_status or "").lower() == "paid"

    # Restore stock only if order was paid (stock was previously deducted)
    restored: list[str] = []
    product_ids_to_push: list[int] = []
    if was_paid:
        for item in order.items:
            if item.product_id:
                prod = db.query(Product).filter(Product.id == item.product_id).first()
                if prod:
                    prod.quantity = (prod.quantity or 0) + item.quantity
                    restored.append(f"{prod.name} (+{item.quantity})")
                    product_ids_to_push.append(prod.id)

    # Update order
    order.status = "cancelled"
    if payload.payment_status:
        order.payment_status = payload.payment_status.lower()
    elif was_paid:
        order.payment_status = "refunded"

    db.commit()

    # Push restored stock back to TheDersi so their inventory stays in sync
    for pid in product_ids_to_push:
        background_tasks.add_task(_bg_push_stock, pid, conn.shop_id)

    logger.info(
        f"[CANCEL-WEBHOOK] {order.order_number} cancelled "
        f"(channel={chan_id}, reason={payload.reason}, stock_restored={restored})"
    )

    return {
        "success": True,
        "order_number": order.order_number,
        "status": "cancelled",
        "payment_status": order.payment_status,
        "stock_restored": restored,
    }


@router.post("/channels/webhook/{webhook_secret}")
async def receive_order_webhook(
    webhook_secret: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Called by TheDersi (or any channel) when a buyer places an order.
    The webhook_secret in the URL identifies which shop and authenticates the call.
    X-Signature (HMAC-SHA256) is verified if THEDERSI_HMAC_SECRET is configured.
    ExiusCart:
      1. Creates/finds the customer
      2. Creates the order
      3. Decreases inventory for each item
    """
    body = await request.body()
    x_sig = request.headers.get("X-Signature", "")
    if not verify_thedersi_signature(body, x_sig):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        payload = ChannelOrderWebhook.model_validate_json(body)
    except Exception as e:
        logger.error(f"[WEBHOOK] payload parse failed: {e} | body={body[:500]}")
        raise HTTPException(status_code=422, detail=f"Invalid webhook payload: {e}")

    conn = db.query(ChannelConnection).filter(
        ChannelConnection.webhook_secret == webhook_secret,
        ChannelConnection.is_active == True,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Invalid webhook URL")

    if conn.seller_status in ("suspended", "rejected"):
        raise HTTPException(
            status_code=403,
            detail={
                "error": "channel_suspended",
                "seller_status": conn.seller_status,
                "message": "This seller's TheDersi channel is suspended. No new orders are accepted.",
            },
        )

    # ── Idempotency: dedupe by channel_order_id ───────────────────────────────
    # TheDersi sends the same order twice: payment_status "pending" first, then
    # "paid" once confirmed. Both carry the same channel_order_id. On the second
    # (and any later) notification we update the existing order instead of
    # creating a duplicate and decrementing stock again.
    incoming_chan_id = payload.channel_order_id or ""
    while incoming_chan_id.startswith("TD-TD-"):
        incoming_chan_id = incoming_chan_id[3:]

    if incoming_chan_id:
        existing_meta = db.query(ChannelOrderMeta).filter(
            ChannelOrderMeta.channel_type == conn.channel_type,
            ChannelOrderMeta.channel_order_id == incoming_chan_id,
        ).first()
        if existing_meta:
            existing_order = db.query(Order).filter(Order.id == existing_meta.order_id).first()
            if existing_order:
                old_payment = (existing_order.payment_status or "").lower()
                new_payment = (payload.payment_status or existing_order.payment_status or "").lower()
                changed_pids: set = set()

                # Stock follows payment: decrement when entering "paid", restore when leaving it.
                if new_payment == "paid" and old_payment != "paid":
                    for it in existing_order.items:
                        prod = db.query(Product).filter(Product.id == it.product_id).first()
                        if prod:
                            prod.quantity = max(0, (prod.quantity or 0) - it.quantity)
                            prod.units_sold = (prod.units_sold or 0) + it.quantity
                            changed_pids.add(prod.id)
                            if prod.is_bundle:
                                from app.api.v1.endpoints.bundles import deduct_bundle_components
                                deduct_bundle_components(prod.id, it.quantity, db, bundle_selections=it.bundle_selections or [])
                elif old_payment == "paid" and new_payment != "paid":
                    for it in existing_order.items:
                        prod = db.query(Product).filter(Product.id == it.product_id).first()
                        if prod:
                            prod.quantity = (prod.quantity or 0) + it.quantity
                            prod.units_sold = max(0, (prod.units_sold or 0) - it.quantity)
                            changed_pids.add(prod.id)

                existing_order.payment_status = new_payment or existing_order.payment_status
                if payload.payment_method:
                    existing_meta.payment_method = payload.payment_method
                db.commit()

                for pid in changed_pids:
                    _bg_push_stock(pid, conn.shop_id)

                logger.info(
                    f"[WEBHOOK] dedupe: {existing_order.order_number} → "
                    f"payment {old_payment}→{new_payment}, stock_changed={list(changed_pids)} "
                    f"(channel_order_id={incoming_chan_id})"
                )
                return {
                    "success": True,
                    "exiuscart_order_id": existing_order.id,
                    "order_number": existing_order.order_number,
                    "updated": True,
                }

    # ── Monthly order limit check (all sources: POS + channel combined) ───────
    sub = db.query(Subscription).filter(Subscription.shop_id == conn.shop_id).first()
    plan_type = sub.plan_type if sub else None
    monthly_limit = MONTHLY_ORDER_LIMITS.get(plan_type)  # None = unlimited

    if monthly_limit is not None:
        # Count channel/online orders only — POS is excluded (unlimited)
        now = datetime.now(timezone.utc)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        orders_this_month = (
            db.query(Order)
            .filter(
                Order.shop_id == conn.shop_id,
                Order.created_at >= month_start,
                Order.source != "pos",
            )
            .count()
        )

        if orders_this_month >= monthly_limit:
            # Notify TheDersi so they can show an upgrade prompt to the seller
            thedersi_link = db.query(TheDersiSeller).filter(
                TheDersiSeller.shop_id == conn.shop_id
            ).first()
            if thedersi_link and conn.channel_type == "thedersi":
                notify_thedersi(
                    thedersi_link.thedersi_seller_id,
                    plan_type or "thedersi_basic",
                    event="order_limit_reached",
                )
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "order_limit_reached",
                    "limit": monthly_limit,
                    "used": orders_this_month,
                    "plan": plan_type,
                    "message": f"Monthly order limit of {monthly_limit} reached. Upgrade your plan to continue.",
                },
            )
    # ─────────────────────────────────────────────────────────────────────────

    # Get or create customer
    customer = None
    if payload.buyer_email:
        customer = db.query(Customer).filter(
            Customer.email == payload.buyer_email,
            Customer.shop_id == conn.shop_id,
        ).first()
    if not customer and payload.buyer_name:
        customer = Customer(
            shop_id=conn.shop_id,
            name=payload.buyer_name,
            email=payload.buyer_email,
            phone=payload.buyer_phone,
            address=payload.shipping_address,
            # This one handler receives orders from every marketplace channel
            # (TheDersi/Daraz/eBay/Noon), differentiated by conn.channel_type
            # — tagging the customer with it here covers all of them at once.
            source=conn.channel_type,
        )
        db.add(customer)
        db.flush()

    # Create order
    order_number = f"{conn.channel_type.upper()}-{uuid.uuid4().hex[:8].upper()}"
    # TheDersi has 3 payment methods (card/PayHere, bank transfer, COD) and
    # sends order-specific collection instructions in delivery_note on every
    # order — for COD that means "collect the full cash amount (product +
    # delivery) and deposit it", for card/bank-transfer it means nothing to
    # collect, already prepaid. These fallbacks only fire on the rare order
    # where delivery_note is missing — they must NOT assert a blanket "do not
    # collect" the way the old text did, since that's actively wrong for a
    # COD order.
    delivery_note = payload.delivery_note or ""
    if not delivery_note:
        if payload.delivery_paid_by == "customer":
            delivery_note = "TheDersi shows this order's delivery as prepaid by the customer — no delivery charge to collect. If this is a Cash on Delivery order, confirm the amount to collect in your TheDersi admin before shipping."
        elif payload.delivery_paid_by == "seller":
            delivery_note = "Free delivery — this order qualifies for free delivery, ship at no charge to the buyer."

    order = Order(
        shop_id=conn.shop_id,
        customer_id=customer.id if customer else None,
        order_number=order_number,
        status="confirmed",
        payment_status=payload.payment_status or "pending",
        source=conn.channel_type,
        subtotal=payload.subtotal,
        tax_amount=0,
        discount_amount=0,
        total=payload.total,
        notes=f"{conn.channel_type.title()} Order #{payload.channel_order_id} | {delivery_note}",
        shipping_address=payload.shipping_address,
        gift_wrap=payload.gift_wrap or False,
        gift_wrap_fee=payload.gift_wrap_fee or 0,
        gift_message=payload.gift_message or None,
    )
    db.add(order)
    db.flush()

    # Create order items. Stock is only decremented when the order is PAID
    # (ExiusCart = single source of truth; TheDersi no longer decrements). A
    # pending order reserves nothing — the decrement happens on the paid
    # follow-up notification handled in the dedupe path above.
    order_is_paid = (payload.payment_status or "").lower() == "paid"
    stock_changed_product_ids: set = set()
    for item in payload.items:
        pid = item.parsed_product_id()
        product = db.query(Product).filter(
            Product.id == pid,
            Product.shop_id == conn.shop_id,
        ).first() if pid else None

        if not product:
            logger.warning(f"[WEBHOOK] product id={pid} not found in shop {conn.shop_id}, skipping item")
            continue

        db.add(OrderItem(
            order_id=order.id,
            product_id=product.id,
            quantity=item.quantity,
            unit_price=item.unit_price,
            total_price=item.item_total if item.item_total is not None else (item.unit_price * item.quantity),
            is_gift=item.is_gift,
            bundle_selections=[s.model_dump() for s in item.bundle_selections] or None,
        ))

        if order_is_paid:
            # Reduce variant stock if size/color specified, otherwise product-level
            if item.size or item.color:
                variant = db.query(ProductVariant).filter(
                    ProductVariant.product_id == product.id,
                    ProductVariant.size == item.size,
                    ProductVariant.color == item.color,
                ).first()
                if variant:
                    variant.quantity = max(0, variant.quantity - item.quantity)
                else:
                    product.quantity = max(0, product.quantity - item.quantity)
            else:
                product.quantity = max(0, product.quantity - item.quantity)
            product.units_sold = (product.units_sold or 0) + item.quantity
            stock_changed_product_ids.add(product.id)
            if product.is_bundle:
                from app.api.v1.endpoints.bundles import deduct_bundle_components
                deduct_bundle_components(
                    product.id, item.quantity, db,
                    bundle_selections=[s.model_dump() for s in item.bundle_selections],
                )

    # Save channel-specific meta (commission, delivery, variants)
    # channel_order_id already normalized above (incoming_chan_id)
    db.add(ChannelOrderMeta(
        order_id=order.id,
        channel_type=conn.channel_type,
        channel_order_id=incoming_chan_id,
        payment_method=payload.payment_method,
        seller_plan=payload.seller_plan,
        commission_rate=payload.commission_rate,
        commission_amount=payload.commission_amount,
        seller_net_earnings=payload.seller_net_earnings,
        delivery_fee=payload.delivery_fee,
        delivery_paid_by=payload.delivery_paid_by,
        delivery_note=delivery_note,
        delivery_fee_share=payload.delivery_fee_share,
        items_detail=[item.model_dump() for item in payload.items],
    ))

    db.commit()

    # Push updated stock to TheDersi for all products whose stock changed
    for pid in stock_changed_product_ids:
        _bg_push_stock(pid, conn.shop_id)

    return {
        "success": True,
        "exiuscart_order_id": order.id,
        "order_number": order_number,
    }


# ── Channel categories ────────────────────────────────────────────────────────

@router.post("/shops/{shop_id}/channels/{channel_id}/sync-categories")
def sync_channel_categories(
    shop_id: int,
    channel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Fetch and cache the category list from a connected channel.
    Call this when seller first connects a channel, or to refresh categories.
    """
    shop = _shop_or_404(shop_id, current_user, db)
    conn = db.query(ChannelConnection).filter(
        ChannelConnection.id == channel_id,
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.is_active == True,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Channel not found")

    if conn.channel_type == "daraz":
        # Daraz is OAuth (access_token), not a static API key, and its
        # category tree comes from Daraz's own API — not TheDersi's
        # /exiuscart/categories contract — so it gets its own path.
        from app.api.v1.endpoints.daraz import fetch_daraz_categories

        categories = fetch_daraz_categories(conn.access_token, shop.country)
        if categories is None:
            cached = db.query(ChannelCategory).filter(
                ChannelCategory.channel_connection_id == channel_id
            ).all()
            return {"synced": 0, "cached": True, "categories": [c.name for c in cached]}

        db.query(ChannelCategory).filter(
            ChannelCategory.channel_connection_id == channel_id
        ).delete()
        for cat in categories:
            db.add(ChannelCategory(
                channel_connection_id=channel_id,
                channel_category_id=str(cat["category_id"]),
                name=cat["name"],
                parent_id=None,
            ))
        db.commit()
        return {"synced": len(categories), "categories": [c["name"] for c in categories]}

    if conn.channel_type == "ebay":
        # eBay is OAuth too, and its category tree comes from the Taxonomy
        # API, keyed by marketplace rather than by country domain like
        # Daraz — same "own path, own fetch function" shape either way.
        from app.api.v1.endpoints.ebay import fetch_ebay_categories, _ebay_marketplace_id

        marketplace_id = _ebay_marketplace_id(shop.country)
        categories = fetch_ebay_categories(marketplace_id, conn, db)
        if categories is None:
            cached = db.query(ChannelCategory).filter(
                ChannelCategory.channel_connection_id == channel_id
            ).all()
            return {"synced": 0, "cached": True, "categories": [c.name for c in cached]}

        db.query(ChannelCategory).filter(
            ChannelCategory.channel_connection_id == channel_id
        ).delete()
        for cat in categories:
            db.add(ChannelCategory(
                channel_connection_id=channel_id,
                channel_category_id=str(cat["category_id"]),
                name=cat["name"],
                parent_id=None,
            ))
        db.commit()
        return {"synced": len(categories), "categories": [c["name"] for c in categories]}

    api_url = _channel_url(conn)
    if not api_url:
        raise HTTPException(status_code=400, detail="No API URL configured for this channel")

    headers = {"X-Api-Key": conn.channel_api_key}
    try:
        with httpx.Client(timeout=10) as client:
            r = client.get(f"{api_url}/exiuscart/categories", headers=headers)
            r.raise_for_status()
            categories = r.json()
    except Exception as e:
        logger.warning(f"[SYNC CATEGORIES] Could not reach {api_url}: {e} — returning cached")
        cached = db.query(ChannelCategory).filter(
            ChannelCategory.channel_connection_id == channel_id
        ).all()
        return {"synced": 0, "cached": True, "categories": [c.name for c in cached]}

    # Clear old cached categories and re-save
    db.query(ChannelCategory).filter(
        ChannelCategory.channel_connection_id == channel_id
    ).delete()

    for cat in categories:
        db.add(ChannelCategory(
            channel_connection_id=channel_id,
            channel_category_id=str(cat.get("id") or cat.get("slug") or cat.get("name")),
            name=cat.get("name", ""),
            parent_id=str(cat.get("parent_id")) if cat.get("parent_id") else None,
        ))
    db.commit()

    return {"synced": len(categories), "categories": [c.get("name") for c in categories]}


@router.get("/shops/{shop_id}/channels/{channel_id}/categories")
def get_channel_categories(
    shop_id: int,
    channel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return cached TheDersi (or other channel) categories for use in product form dropdown."""
    _shop_or_404(shop_id, current_user, db)
    cats = db.query(ChannelCategory).filter(
        ChannelCategory.channel_connection_id == channel_id,
    ).all()
    return [{"id": c.channel_category_id, "name": c.name, "parent_id": c.parent_id} for c in cats]


@router.get("/shops/{shop_id}/channels/{channel_id}/product-fields")
def get_channel_product_fields(
    shop_id: int,
    channel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Dynamic per-channel product-fields spec — e.g. TheDersi's own
    GET /exiuscart/product-fields (Material, Metal Type, Gemstone, etc).
    We never hardcode this list: fetched live and cached on the connection
    for PRODUCT_FIELDS_CACHE_TTL_SECONDS, refetched once stale. A channel
    that doesn't expose this endpoint (or a transient failure) just serves
    whatever's cached — an empty list means "no extra fields for this
    channel", not an error, so the product form simply shows nothing extra.
    """
    shop = _shop_or_404(shop_id, current_user, db)
    conn = db.query(ChannelConnection).filter(
        ChannelConnection.id == channel_id,
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.is_active == True,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Channel not found")

    is_fresh = (
        conn.field_defs_cache is not None
        and conn.field_defs_synced_at is not None
        and (datetime.now(timezone.utc) - conn.field_defs_synced_at).total_seconds() < PRODUCT_FIELDS_CACHE_TTL_SECONDS
    )
    if is_fresh:
        return conn.field_defs_cache

    api_url = _channel_url(conn)
    if not api_url:
        return conn.field_defs_cache or []

    headers = {"X-Api-Key": conn.channel_api_key}
    try:
        with httpx.Client(timeout=10) as client:
            r = client.get(f"{api_url}/exiuscart/product-fields", headers=headers)
            r.raise_for_status()
            fields = r.json()
    except Exception as e:
        logger.warning(f"[PRODUCT FIELDS] Could not reach {api_url} for conn={channel_id}: {e} — serving cached")
        return conn.field_defs_cache or []

    conn.field_defs_cache = fields
    conn.field_defs_synced_at = datetime.now(timezone.utc)
    db.commit()
    return fields


@router.get("/shops/{shop_id}/channels/{channel_id}/thedersi-info")
def get_thedersi_seller_info(
    shop_id: int,
    channel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Proxy call to TheDersi GET /seller/info using the seller's stored API key.
    Returns earnings balance, plan, payout schedule, and next payout date.
    The API key is never exposed to the browser — all calls go server-to-server.
    """
    _shop_or_404(shop_id, current_user, db)
    conn = db.query(ChannelConnection).filter(
        ChannelConnection.id == channel_id,
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.is_active == True,
        ChannelConnection.channel_type == "thedersi",
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="TheDersi connection not found")

    api_url = _channel_url(conn)
    try:
        with httpx.Client(timeout=10) as client:
            r = client.get(
                f"{api_url}/seller/info",
                headers={"X-Api-Key": conn.channel_api_key},
            )
            r.raise_for_status()
            data = r.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail="TheDersi returned an error")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not reach TheDersi: {e}")

    # Keep schedule label static — all plans pay every Monday.
    # Let next_payout_date and payout_overdue come from TheDersi: they now calculate
    # the correct Monday cutoff per-order (7-day hold → next Monday on/after hold ends).
    # Only fall back to "next Monday" if TheDersi didn't return a date.
    from datetime import date as _date, timedelta as _td
    today = _date.today()
    days_to_monday = (7 - today.weekday()) % 7
    next_monday = today + _td(days=days_to_monday)
    data["payout_schedule"] = "Every Monday"
    if not data.get("next_payout_date"):
        data["next_payout_date"] = next_monday.isoformat()
    if "payout_overdue" not in data:
        data["payout_overdue"] = False
    data["payout_note"] = (
        "Each order has a 7-day hold from the order date. "
        "Once the hold ends, TheDersi pays your available balance automatically on the next Monday on or after that date — nothing to request."
    )
    data["auto_payout_enabled"] = conn.auto_payout_enabled
    return data


@router.get("/shops/{shop_id}/channels/{channel_id}/thedersi-payouts")
def get_thedersi_payouts(
    shop_id: int,
    channel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Proxy call to TheDersi GET /seller/payouts.
    Returns payout history for the seller. API key never exposed to browser.
    """
    _shop_or_404(shop_id, current_user, db)
    conn = db.query(ChannelConnection).filter(
        ChannelConnection.id == channel_id,
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.is_active == True,
        ChannelConnection.channel_type == "thedersi",
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="TheDersi connection not found")

    api_url = _channel_url(conn)
    try:
        with httpx.Client(timeout=10) as client:
            r = client.get(
                f"{api_url}/seller/payouts",
                headers={"X-Api-Key": conn.channel_api_key},
            )
            r.raise_for_status()
            return r.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail="TheDersi returned an error")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not reach TheDersi: {e}")


@router.get("/shops/{shop_id}/channels/{channel_id}/thedersi-delivery-costs")
def get_thedersi_delivery_costs(
    shop_id: int,
    channel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Recent TheDersi orders with what the customer paid for delivery vs
    what the seller reported as their own courier cost — our own data
    (not proxied from TheDersi), for the Payout page's per-order breakdown
    (2026-08-26 TheDersi payout-reimbursement spec)."""
    _shop_or_404(shop_id, current_user, db)
    conn = db.query(ChannelConnection).filter(
        ChannelConnection.id == channel_id,
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.channel_type == "thedersi",
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="TheDersi connection not found")

    rows = (
        db.query(Order, ChannelOrderMeta)
        .join(ChannelOrderMeta, ChannelOrderMeta.order_id == Order.id)
        .filter(Order.shop_id == shop_id, ChannelOrderMeta.channel_type == "thedersi")
        .order_by(Order.created_at.desc())
        .limit(20)
        .all()
    )
    return [
        {
            "order_number": order.order_number,
            "channel_order_id": meta.channel_order_id,
            "status": order.status,
            "customer_paid_delivery": float(meta.delivery_fee) if meta.delivery_fee is not None else None,
            "seller_delivery_cost": float(meta.seller_delivery_cost) if meta.seller_delivery_cost is not None else None,
            "created_at": order.created_at.isoformat() if order.created_at else None,
        }
        for order, meta in rows
    ]


class SetProductChannelCategory(BaseModel):
    channel_connection_id: int
    is_listed: bool = True
    is_gift: bool = False
    channel_category_id: Optional[str] = None
    channel_category_name: Optional[str] = None
    field_values: Optional[Dict[str, str]] = None
    # Custom Website only — a product can be filed under more than one
    # category there, unlike TheDersi/Daraz/eBay which are locked to exactly
    # one by their own platform. None = leave existing categories untouched
    # (so other channels' saves, which never send this, can't wipe it);
    # an empty list explicitly clears all categories.
    categories: Optional[List[Dict[str, str]]] = None


@router.put("/shops/{shop_id}/products/{product_id}/channel-category")
def set_product_channel_category(
    shop_id: int,
    product_id: int,
    data: SetProductChannelCategory,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Sets whether a product is listed on a specific channel connection, its
    gift flag on that channel, and (for channels that have one) its category.
    E.g. seller lists their Blue Saree on TheDersi under "Festival Wear".
    Pushes/removes the listing on just this one connection — other channels
    the product is listed on are untouched.
    """
    _shop_or_404(shop_id, current_user, db)

    conn = db.query(ChannelConnection).filter(
        ChannelConnection.id == data.channel_connection_id,
        ChannelConnection.shop_id == shop_id,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Channel connection not found for this shop")

    existing = db.query(ProductChannelCategory).filter(
        ProductChannelCategory.product_id == product_id,
        ProductChannelCategory.channel_connection_id == data.channel_connection_id,
    ).first()

    if existing:
        existing.is_listed = data.is_listed
        existing.is_gift = data.is_gift
        existing.channel_category_id = data.channel_category_id
        existing.channel_category_name = data.channel_category_name
        existing.channel_field_values = data.field_values
    else:
        db.add(ProductChannelCategory(
            product_id=product_id,
            channel_connection_id=data.channel_connection_id,
            is_listed=data.is_listed,
            is_gift=data.is_gift,
            channel_category_id=data.channel_category_id,
            channel_category_name=data.channel_category_name,
            channel_field_values=data.field_values,
        ))

    if data.categories is not None:
        db.query(ProductStorefrontCategory).filter(
            ProductStorefrontCategory.product_id == product_id,
            ProductStorefrontCategory.channel_connection_id == data.channel_connection_id,
        ).delete()
        for cat in data.categories:
            cat_id = cat.get("id")
            if not cat_id:
                continue
            db.add(ProductStorefrontCategory(
                product_id=product_id,
                channel_connection_id=data.channel_connection_id,
                category_id=cat_id,
                category_name=cat.get("name"),
            ))

    db.commit()

    if data.is_listed:
        trigger_product_sync(product_id, shop_id, background_tasks)
        return {"message": "Listed and synced to this channel"}
    else:
        trigger_product_delete(product_id, shop_id, background_tasks, channel_connection_id=data.channel_connection_id)
        return {"message": "Unlisted from this channel"}


# ── Product approval callback — TheDersi calls this when admin approves/rejects ─

class ProductStatusCallback(BaseModel):
    exiuscart_product_id: int
    status: str                          # "approved" | "rejected"
    channel: str = "thedersi"
    rejection_reason: Optional[str] = None
    seller_email: Optional[str] = None  # optional, not used for lookup


_THEDERSI_INBOUND_KEY = os.getenv("THEDERSI_INBOUND_KEY", "") or os.getenv("THEDERSI_PARTNER_KEY", "")


def _mask_key(k: str) -> str:
    if not k:
        return "<empty>"
    if len(k) <= 12:
        return f"<short len={len(k)}>"
    return f"{k[:6]}...{k[-4:]} (len={len(k)})"


def _require_partner_key(x_partner_key: str = Header(..., alias="X-Partner-Key")):
    if not _THEDERSI_INBOUND_KEY or x_partner_key != _THEDERSI_INBOUND_KEY:
        logger.warning(
            f"[PRODUCT-STATUS AUTH] 401 partner-key mismatch — "
            f"received={_mask_key(x_partner_key)} expected={_mask_key(_THEDERSI_INBOUND_KEY)}"
        )
        raise HTTPException(status_code=401, detail="Invalid partner key")


@router.patch("/channels/product-status", dependencies=[Depends(_require_partner_key)])
async def update_product_channel_status(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Called by TheDersi admin panel when a product is approved or rejected.
    Verified by both X-Partner-Key header and HMAC-SHA256 X-Signature.
    Updates the product's channel status in ExiusCart so the seller can see:
      🟡 Pending review on TheDersi
      ✅ Live on TheDersi
      ❌ Rejected on TheDersi
    """
    body = await request.body()
    x_sig = request.headers.get("X-Signature", "")
    if not verify_thedersi_signature(body, x_sig):
        logger.warning(f"[PRODUCT-STATUS AUTH] 401 signature mismatch — x_signature_present={bool(x_sig)}")
        raise HTTPException(status_code=401, detail="Invalid webhook signature")
    logger.info(f"[PRODUCT-STATUS] auth OK, body={body[:200]}")

    try:
        payload = ProductStatusCallback.model_validate_json(body)
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid payload")
    if payload.status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="status must be 'approved' or 'rejected'")

    record = db.query(ChannelProductStatus).filter(
        ChannelProductStatus.product_id == payload.exiuscart_product_id,
        ChannelProductStatus.channel_type == payload.channel,
    ).first()

    if not record:
        # First time approval callback — create record
        product = db.query(Product).filter(Product.id == payload.exiuscart_product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        record = ChannelProductStatus(
            product_id=payload.exiuscart_product_id,
            shop_id=product.shop_id,
            channel_type=payload.channel,
        )
        db.add(record)

    record.status = payload.status
    record.rejection_reason = payload.rejection_reason
    db.commit()

    from app.models.channel_sync_log import ChannelSyncLog
    db.add(ChannelSyncLog(
        shop_id=record.shop_id, product_id=payload.exiuscart_product_id, channel_type=payload.channel,
        action="listing_status", success=(payload.status == "approved"),
        error_message=(payload.rejection_reason or "")[:2000] or None,
    ))
    db.commit()

    return {
        "success": True,
        "product_id": payload.exiuscart_product_id,
        "channel": payload.channel,
        "status": payload.status,
    }


@router.get("/shops/{shop_id}/channels/stats")
def get_channel_stats(
    shop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Real per-channel product/order counts for the Sales Channels
    dashboard's stat cards — powers the redesigned connections page.
    Deliberately NOT including Shopify: it's tracked through a completely
    separate system (shopify_integration.py, no ChannelConnection row), so
    its own product/order counts belong to that page, not faked here as 0.

    products = how many of this shop's products have ever been pushed to
    that channel (a ChannelProductStatus row exists), regardless of
    approval outcome — matches every *_integration.py's own listing flow.
    orders = how many of this shop's orders came in through that channel
    (a ChannelOrderMeta row), the same real ledger tiktok.py/daraz.py/etc.
    already write to on every synced order."""
    from app.models.channel_product_status import ChannelProductStatus
    from app.models.channel_order_meta import ChannelOrderMeta
    from sqlalchemy import func as sql_func

    _shop_or_404(shop_id, current_user, db)

    connections = db.query(ChannelConnection).filter(ChannelConnection.shop_id == shop_id).all()

    product_counts = dict(
        db.query(ChannelProductStatus.channel_type, sql_func.count(ChannelProductStatus.id))
        .filter(ChannelProductStatus.shop_id == shop_id)
        .group_by(ChannelProductStatus.channel_type)
        .all()
    )
    order_counts = dict(
        db.query(ChannelOrderMeta.channel_type, sql_func.count(ChannelOrderMeta.id))
        .join(Order, ChannelOrderMeta.order_id == Order.id)
        .filter(Order.shop_id == shop_id)
        .group_by(ChannelOrderMeta.channel_type)
        .all()
    )

    channels = {}
    total_products, total_orders = 0, 0
    for conn in connections:
        products = product_counts.get(conn.channel_type, 0)
        orders = order_counts.get(conn.channel_type, 0)
        total_products += products
        total_orders += orders
        channels[conn.channel_type] = {
            "connected": True,
            "is_active": conn.is_active,
            "products_synced": products,
            "orders_synced": orders,
            "last_synced_at": conn.last_synced_at.isoformat() if conn.last_synced_at else None,
        }

    return {
        "summary": {
            "connected_channels": len(connections),
            "active_channels": sum(1 for c in connections if c.is_active),
            "products_synced": total_products,
            "orders_synced": total_orders,
        },
        "channels": channels,
    }


@router.get("/shops/{shop_id}/channel-statuses")
def get_all_channel_statuses(
    shop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns all channel product statuses for a shop in one call.
    Used by the product list to show 🟡/✅/❌ badges without N+1 requests.
    Returns: { product_id: { channel_type: {status, rejection_reason} } }
    """
    _shop_or_404(shop_id, current_user, db)
    rows = db.query(ChannelProductStatus).filter(
        ChannelProductStatus.shop_id == shop_id,
    ).all()
    result: dict = {}
    for r in rows:
        if r.product_id not in result:
            result[r.product_id] = {}
        result[r.product_id][r.channel_type] = {
            "status": r.status,
            "rejection_reason": r.rejection_reason,
        }
    return result


@router.get("/shops/{shop_id}/product-channel-categories")
def get_all_product_channel_categories(
    shop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns every channel's category assignment for a shop's products in one
    call. Returns: { product_id: { channel_connection_id: {channel_type,
    channel_category_id, channel_category_name} } }
    channel_type is included so callers can label each entry by its real
    channel instead of assuming — a product can have a different category
    on each connected channel (TheDersi, Daraz, eBay, ...).
    """
    _shop_or_404(shop_id, current_user, db)
    rows = (
        db.query(ProductChannelCategory, ChannelConnection.channel_type)
        .join(Product, Product.id == ProductChannelCategory.product_id)
        .join(ChannelConnection, ChannelConnection.id == ProductChannelCategory.channel_connection_id)
        .filter(Product.shop_id == shop_id)
        .all()
    )
    storefront_rows = (
        db.query(ProductStorefrontCategory)
        .join(Product, Product.id == ProductStorefrontCategory.product_id)
        .filter(Product.shop_id == shop_id)
        .all()
    )
    storefront_by_key: dict = {}
    for sc in storefront_rows:
        key = (sc.product_id, sc.channel_connection_id)
        storefront_by_key.setdefault(key, []).append({"id": sc.category_id, "name": sc.category_name})

    result: dict = {}
    for r, channel_type in rows:
        pid = str(r.product_id)
        if pid not in result:
            result[pid] = {}
        result[pid][r.channel_connection_id] = {
            "channel_type": channel_type,
            "is_listed": r.is_listed,
            "is_gift": r.is_gift,
            "channel_category_id": r.channel_category_id,
            "channel_category_name": r.channel_category_name,
            # Custom Website only — the full multi-category list; every
            # other channel's entry here is always an empty list, since only
            # Custom Website can have more than one category per product.
            "categories": storefront_by_key.get((r.product_id, r.channel_connection_id), []),
        }
    return result


@router.get("/shops/{shop_id}/products/{product_id}/channel-status")
def get_product_channel_status(
    shop_id: int,
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns the approval status of a product on each connected channel.
    Used by ExiusCart seller dashboard to show:
      🟡 Pending review on TheDersi
      ✅ Live on TheDersi
      ❌ Rejected on TheDersi (with reason)
    """
    _shop_or_404(shop_id, current_user, db)
    statuses = db.query(ChannelProductStatus).filter(
        ChannelProductStatus.product_id == product_id,
        ChannelProductStatus.shop_id == shop_id,
    ).all()

    return [
        {
            "channel": s.channel_type,
            "status": s.status,
            "rejection_reason": s.rejection_reason,
            "updated_at": s.updated_at,
            "label": {
                "pending_review": "🟡 Pending review",
                "approved": "✅ Live",
                "rejected": "❌ Rejected",
                "sync_failed": "⚠️ Failed to send to TheDersi",
            }.get(s.status, s.status),
        }
        for s in statuses
    ]


@router.get("/shops/{shop_id}/products/{product_id}/channel-category")
def get_product_channel_categories(
    shop_id: int,
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns which channel category the seller assigned to this product per connection."""
    _shop_or_404(shop_id, current_user, db)
    rows = db.query(ProductChannelCategory).filter(
        ProductChannelCategory.product_id == product_id,
    ).all()
    storefront_rows = db.query(ProductStorefrontCategory).filter(
        ProductStorefrontCategory.product_id == product_id,
    ).all()
    categories_by_conn: dict = {}
    for sc in storefront_rows:
        categories_by_conn.setdefault(sc.channel_connection_id, []).append({"id": sc.category_id, "name": sc.category_name})
    return [
        {
            "channel_connection_id": r.channel_connection_id,
            "is_listed": r.is_listed,
            "is_gift": r.is_gift,
            "channel_category_id": r.channel_category_id,
            "channel_category_name": r.channel_category_name,
            "channel_field_values": r.channel_field_values or {},
            # Custom Website only — see SetProductChannelCategory.categories.
            "categories": categories_by_conn.get(r.channel_connection_id, []),
        }
        for r in rows
    ]


@router.get("/shops/{shop_id}/channel-sync-logs")
def get_channel_sync_logs(
    shop_id: int,
    channel_type: Optional[str] = None,
    success: Optional[bool] = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """History of every channel sync attempt (listing creation, stock push,
    price update, etc.) — durable even after a transient UI error message
    disappears. Powers the Channel Listings dashboard. Channel-agnostic —
    any integration can write to ChannelSyncLog, not just Noon."""
    from app.models.channel_sync_log import ChannelSyncLog

    _shop_or_404(shop_id, current_user, db)
    query = db.query(ChannelSyncLog).filter(ChannelSyncLog.shop_id == shop_id)
    if channel_type:
        query = query.filter(ChannelSyncLog.channel_type == channel_type)
    if success is not None:
        query = query.filter(ChannelSyncLog.success == success)
    rows = query.order_by(ChannelSyncLog.created_at.desc()).limit(min(limit, 500)).all()

    product_ids = list({r.product_id for r in rows if r.product_id})
    products = {}
    if product_ids:
        products = {p.id: p.name for p in db.query(Product).filter(Product.id.in_(product_ids)).all()}

    return [
        {
            "id": r.id,
            "product_id": r.product_id,
            "product_name": products.get(r.product_id),
            "channel_type": r.channel_type,
            "action": r.action,
            "success": r.success,
            "external_id": r.external_id,
            "error_message": r.error_message,
            "created_at": r.created_at,
        }
        for r in rows
    ]


# ── Channel Listings dashboard — richer, filterable/paginated view ─────────
#
# Built alongside get_channel_sync_logs above rather than replacing it (that
# endpoint isn't used anywhere else, but changing its shape in place risked
# more than adding a new one). Powers the Channel Listings page's real
# stats/filters/pagination/detail-drawer — every field here traces to a
# real column on ChannelSyncLog/ChannelProductStatus/Product/DropshipProductLink,
# nothing fabricated. Two real gaps, disclosed rather than faked:
#   - No "duration" exists — ChannelSyncLog only records one completion
#     timestamp, not a start time, so there's nothing to compute a duration
#     from. Returned as null; the frontend shows "—".
#   - "Open listing" only has a real public URL for eBay/Etsy (stable,
#     well-known URL conventions) — every other channel's listing lives on
#     a seller-specific or non-guessable URL, so it's omitted rather than
#     invented for those.

# Known-stable, publicly documented listing URL conventions — NOT included
# for Daraz/Noon/TikTok/WooCommerce/BigCommerce/Custom/Whop/Gumroad since
# those need a seller-specific domain or a slug this table doesn't store.
_LISTING_URL_TEMPLATES: dict = {
    "ebay": "https://www.ebay.com/itm/{external_id}",
    "etsy": "https://www.etsy.com/listing/{external_id}",
}


def _product_image(product) -> Optional[str]:
    """The product's main image for the Channel Listings table. Many
    dropship-imported products have image_url empty and their real images
    only in the ProductImage relationship (ordered by sort_order, so [0] is
    the main one) — fall through to that instead of showing a blank box."""
    if not product:
        return None
    if product.image_url:
        return product.image_url
    for img in (product.images or []):
        if img.url:
            return img.url
    return None


def _listing_status(sync_success: bool, product_status: Optional[str]) -> str:
    """The 4-state status the dashboard shows, combining two real signals:
    did the API call itself succeed (ChannelSyncLog.success), and — if it
    did — what the channel's own review decided (ChannelProductStatus.status,
    written by eBay/TikTok/Daraz/etc's own create_listing handlers)."""
    if not sync_success:
        return "failed"
    if product_status == "pending_review":
        return "processing"
    if product_status == "rejected":
        return "warning"
    return "success"


@router.get("/shops/{shop_id}/channel-listings/stats")
def get_channel_listings_stats(
    shop_id: int,
    days: int = 7,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stat cards + success-rate bar + the "most failures are caused by"
    insight — all real, all from ChannelSyncLog, compared against the
    identical-length window immediately before it for the trend %."""
    from app.models.channel_sync_log import ChannelSyncLog
    from datetime import datetime, timezone, timedelta
    from sqlalchemy import func as sql_func

    _shop_or_404(shop_id, current_user, db)
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(days=days)
    prev_start = window_start - timedelta(days=days)

    def _counts(start, end):
        rows = db.query(ChannelSyncLog.success, sql_func.count(ChannelSyncLog.id)).filter(
            ChannelSyncLog.shop_id == shop_id,
            ChannelSyncLog.created_at >= start,
            ChannelSyncLog.created_at < end,
        ).group_by(ChannelSyncLog.success).all()
        succ = sum(c for ok, c in rows if ok)
        fail = sum(c for ok, c in rows if not ok)
        return succ, fail

    # Trend windows (last N days vs the N days before) — only used for the
    # small "+X%" indicator, not the headline number.
    win_succ, win_fail = _counts(window_start, now)
    prev_succ, prev_fail = _counts(prev_start, window_start)
    win_total, prev_total = win_succ + win_fail, prev_succ + prev_fail

    # Headline numbers are ALL-TIME so the stat cards match what the table
    # below actually lists (the table defaults to "all time"). A 7-day
    # window was silently hiding real older activity from the cards.
    all_rows = db.query(ChannelSyncLog.success, sql_func.count(ChannelSyncLog.id)).filter(
        ChannelSyncLog.shop_id == shop_id,
    ).group_by(ChannelSyncLog.success).all()
    succ = sum(c for ok, c in all_rows if ok)
    fail = sum(c for ok, c in all_rows if not ok)

    def _pct_change(now_val, prev_val):
        if prev_val == 0:
            return None
        return round(100 * (now_val - prev_val) / prev_val, 1)

    # "Needs attention" = failed syncs + products the channel itself rejected
    # (ChannelProductStatus.status == "rejected"), all-time to match above.
    from app.models.channel_product_status import ChannelProductStatus
    warning_count = db.query(sql_func.count(ChannelProductStatus.id)).filter(
        ChannelProductStatus.shop_id == shop_id,
        ChannelProductStatus.status == "rejected",
    ).scalar() or 0

    # Real "most common cause of failure" — grouped by action, not a parsed
    # guess at every channel's differently-worded error text.
    top_action_row = db.query(ChannelSyncLog.action, sql_func.count(ChannelSyncLog.id)).filter(
        ChannelSyncLog.shop_id == shop_id, ChannelSyncLog.success == False,
    ).group_by(ChannelSyncLog.action).order_by(sql_func.count(ChannelSyncLog.id).desc()).first()

    # Custom Website writes no ChannelSyncLog rows (no push step) — count its
    # active products as real "available" listings so the totals aren't
    # blind to that channel, exactly matching the synthetic rows the
    # listings feed shows for it.
    custom_available = 0
    custom_conn = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.channel_type == "custom",
        ChannelConnection.is_active == True,
    ).first()
    if custom_conn:
        custom_available = db.query(sql_func.count(Product.id)).filter(
            Product.shop_id == shop_id, Product.is_active == True,
        ).scalar() or 0

    total = succ + fail + custom_available
    successful = succ + custom_available

    return {
        "total_activity": total,
        "successful": successful,
        "failed": fail,
        "needs_attention": fail + warning_count,
        "success_rate": round(100 * successful / total, 1) if total else None,
        "trend": {
            "total_activity": _pct_change(win_total, prev_total),
            "successful": _pct_change(win_succ, prev_succ),
            "failed": _pct_change(win_fail, prev_fail),
        },
        "top_failing_action": top_action_row[0] if top_action_row else None,
        "top_failing_action_count": top_action_row[1] if top_action_row else 0,
    }


@router.get("/shops/{shop_id}/channel-listings")
def get_channel_listings(
    shop_id: int,
    search: Optional[str] = None,
    channel_types: Optional[str] = None,   # comma-separated
    statuses: Optional[str] = None,        # comma-separated: success,failed,warning,processing
    actions: Optional[str] = None,         # comma-separated: create_listing,update_stock,update_price,sync_order
    supplier_types: Optional[str] = None,  # comma-separated dropship supplier_type, real via DropshipProductLink
    date_from: Optional[str] = None,       # ISO date
    date_to: Optional[str] = None,
    only_needs_action: bool = False,
    show_retries: bool = True,
    page: int = 1,
    page_size: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The real, filterable/paginated feed behind the Channel Listings
    table. show_retries=False collapses to only the latest attempt per
    (product_id, channel_type, action) — the raw table is append-only so
    every retry already has its own row; this just chooses whether to show
    all of them or the current state only."""
    from app.models.channel_sync_log import ChannelSyncLog
    from app.models.channel_product_status import ChannelProductStatus
    from app.models.dropship import DropshipProductLink
    from datetime import datetime, timezone as _dt_timezone

    shop = _shop_or_404(shop_id, current_user, db)
    query = db.query(ChannelSyncLog).filter(ChannelSyncLog.shop_id == shop_id)

    if channel_types:
        query = query.filter(ChannelSyncLog.channel_type.in_(channel_types.split(",")))
    if actions:
        query = query.filter(ChannelSyncLog.action.in_(actions.split(",")))
    if date_from:
        query = query.filter(ChannelSyncLog.created_at >= datetime.fromisoformat(date_from))
    if date_to:
        query = query.filter(ChannelSyncLog.created_at <= datetime.fromisoformat(date_to))

    rows = query.order_by(ChannelSyncLog.created_at.desc()).limit(2000).all()

    if not show_retries:
        seen = set()
        deduped = []
        for r in rows:
            key = (r.product_id, r.channel_type, r.action)
            if key in seen:
                continue
            seen.add(key)
            deduped.append(r)
        rows = deduped

    # Attempt number — real count of how many times this exact
    # (product, channel, action) combo has been attempted, up to and
    # including this row (append-only table, so counting rows at-or-before
    # this one's timestamp is the real ordinal).
    attempt_counts: dict = {}
    for r in sorted(rows, key=lambda x: x.created_at):
        key = (r.product_id, r.channel_type, r.action)
        attempt_counts[key] = attempt_counts.get(key, 0) + 1
        r._attempt_number = attempt_counts[key]  # type: ignore[attr-defined]

    product_ids = list({r.product_id for r in rows if r.product_id})
    products = {}
    if product_ids:
        products = {p.id: p for p in db.query(Product).filter(Product.id.in_(product_ids)).all()}

    statuses_map: dict = {}
    if product_ids:
        for s in db.query(ChannelProductStatus).filter(
            ChannelProductStatus.shop_id == shop_id, ChannelProductStatus.product_id.in_(product_ids),
        ).all():
            statuses_map[(s.product_id, s.channel_type)] = s.status

    supplier_map: dict = {}
    if product_ids:
        for link in db.query(DropshipProductLink).filter(
            DropshipProductLink.shop_id == shop_id, DropshipProductLink.product_id.in_(product_ids), DropshipProductLink.is_primary == True,
        ).all():
            supplier_map[link.product_id] = link.supplier_type

    def _row_out(r):
        product = products.get(r.product_id)
        computed_status = _listing_status(r.success, statuses_map.get((r.product_id, r.channel_type)))
        url_template = _LISTING_URL_TEMPLATES.get(r.channel_type)
        listing_url = url_template.format(external_id=r.external_id) if (url_template and r.external_id) else None
        return {
            "id": r.id,
            "product_id": r.product_id,
            "product_name": product.name if product else None,
            "product_sku": product.sku if product else None,
            "product_image_url": _product_image(product),
            "channel_type": r.channel_type,
            "store_name": shop.name,
            "supplier_type": supplier_map.get(r.product_id),
            "action": r.action,
            "status": computed_status,
            "success": r.success,
            "external_id": r.external_id,
            "listing_url": listing_url,
            "error_message": r.error_message,
            "attempt_number": getattr(r, "_attempt_number", 1),
            "created_at": r.created_at,
            "synthetic": False,
        }

    out_rows = [_row_out(r) for r in rows]

    # ── Custom Website ────────────────────────────────────────────────────
    # There is no per-product "push" for Custom Website (the storefront
    # pulls products from the API live), so it writes no ChannelSyncLog
    # rows and would otherwise be invisible on this page. Surface every
    # active product as an honest "available via API" entry, clearly marked
    # synthetic (negative id, action "available", success) so it's never
    # mistaken for a real sync attempt. Skipped when the current filters
    # can't include a successful custom row anyway.
    want_custom = (not channel_types) or ("custom" in channel_types.split(","))
    filters_allow_success = not only_needs_action and not (statuses and "success" not in statuses.split(","))
    if want_custom and filters_allow_success:
        custom_conn = db.query(ChannelConnection).filter(
            ChannelConnection.shop_id == shop_id,
            ChannelConnection.channel_type == "custom",
            ChannelConnection.is_active == True,
        ).first()
        if custom_conn:
            df = datetime.fromisoformat(date_from) if date_from else None
            dt = datetime.fromisoformat(date_to) if date_to else None
            active_products = db.query(Product).filter(
                Product.shop_id == shop_id, Product.is_active == True,
            ).all()
            for p in active_products:
                ts = p.updated_at or p.created_at
                if df and ts and ts < df:
                    continue
                if dt and ts and ts > dt:
                    continue
                out_rows.append({
                    "id": -p.id,
                    "product_id": p.id,
                    "product_name": p.name,
                    "product_sku": p.sku,
                    "product_image_url": _product_image(p),
                    "channel_type": "custom",
                    "store_name": shop.name,
                    "supplier_type": supplier_map.get(p.id),
                    "action": "available",
                    "status": "success",
                    "success": True,
                    "external_id": None,
                    "listing_url": None,
                    "error_message": None,
                    "attempt_number": 1,
                    "created_at": ts,
                    "synthetic": True,
                })

    # Real rows arrived DB-sorted; synthetic rows were appended after, so
    # re-sort the combined list newest-first. Normalize to naive-UTC so a
    # mix of tz-aware and naive timestamps can't raise on comparison.
    def _ts_key(row):
        ts = row["created_at"]
        if ts is None:
            return datetime.min
        if ts.tzinfo is not None:
            return ts.astimezone(_dt_timezone.utc).replace(tzinfo=None)
        return ts
    out_rows.sort(key=_ts_key, reverse=True)

    if search:
        s = search.lower()
        out_rows = [r for r in out_rows if
                    (r["product_name"] and s in r["product_name"].lower()) or
                    (r["product_sku"] and s in r["product_sku"].lower()) or
                    (r["product_id"] and s == str(r["product_id"]))]

    if statuses:
        wanted = set(statuses.split(","))
        out_rows = [r for r in out_rows if r["status"] in wanted]

    if supplier_types:
        wanted_suppliers = set(supplier_types.split(","))
        out_rows = [r for r in out_rows if r["supplier_type"] in wanted_suppliers]

    if only_needs_action:
        out_rows = [r for r in out_rows if r["status"] in ("failed", "warning")]

    total = len(out_rows)
    start = (max(page, 1) - 1) * page_size
    page_rows = out_rows[start:start + page_size]

    return {"total": total, "page": page, "page_size": page_size, "rows": page_rows}


@router.get("/shops/{shop_id}/channel-listings/{log_id}")
def get_channel_listing_detail(
    shop_id: int,
    log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Full detail for the listing-details drawer — the same row plus its
    real attempt history (every ChannelSyncLog row for the same product +
    channel + action), used as the real "listing progress" timeline instead
    of a fabricated Queued/Processing generic animation."""
    from app.models.channel_sync_log import ChannelSyncLog
    from app.models.channel_product_status import ChannelProductStatus
    from app.models.dropship import DropshipProductLink

    shop = _shop_or_404(shop_id, current_user, db)

    # Synthetic Custom Website row (see get_channel_listings) — id is the
    # negative product id, there is no real ChannelSyncLog behind it.
    if log_id < 0:
        p = db.query(Product).filter(Product.id == -log_id, Product.shop_id == shop_id).first()
        if not p:
            raise HTTPException(status_code=404, detail="Listing activity not found")
        link = db.query(DropshipProductLink).filter(
            DropshipProductLink.shop_id == shop_id, DropshipProductLink.product_id == p.id,
            DropshipProductLink.is_primary == True,
        ).first()
        return {
            "id": log_id,
            "product_id": p.id,
            "product_name": p.name,
            "product_sku": p.sku,
            "product_image_url": _product_image(p),
            "channel_type": "custom",
            "store_name": shop.name,
            "supplier_type": link.supplier_type if link else None,
            "action": "available",
            "status": "success",
            "external_id": None,
            "listing_url": None,
            "error_message": None,
            "history": [],
            "synthetic": True,
        }

    log = db.query(ChannelSyncLog).filter(ChannelSyncLog.id == log_id, ChannelSyncLog.shop_id == shop_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Listing activity not found")

    product = db.query(Product).filter(Product.id == log.product_id).first() if log.product_id else None
    product_status = None
    if log.product_id:
        ps = db.query(ChannelProductStatus).filter(
            ChannelProductStatus.shop_id == shop_id, ChannelProductStatus.product_id == log.product_id,
            ChannelProductStatus.channel_type == log.channel_type,
        ).first()
        product_status = ps.status if ps else None

    supplier_type = None
    if log.product_id:
        link = db.query(DropshipProductLink).filter(
            DropshipProductLink.shop_id == shop_id, DropshipProductLink.product_id == log.product_id, DropshipProductLink.is_primary == True,
        ).first()
        supplier_type = link.supplier_type if link else None

    history = db.query(ChannelSyncLog).filter(
        ChannelSyncLog.shop_id == shop_id, ChannelSyncLog.product_id == log.product_id,
        ChannelSyncLog.channel_type == log.channel_type, ChannelSyncLog.action == log.action,
    ).order_by(ChannelSyncLog.created_at.asc()).all()

    url_template = _LISTING_URL_TEMPLATES.get(log.channel_type)
    listing_url = url_template.format(external_id=log.external_id) if (url_template and log.external_id) else None

    return {
        "id": log.id,
        "product_id": log.product_id,
        "product_name": product.name if product else None,
        "product_sku": product.sku if product else None,
        "product_image_url": _product_image(product),
        "channel_type": log.channel_type,
        "store_name": shop.name,
        "supplier_type": supplier_type,
        "action": log.action,
        "status": _listing_status(log.success, product_status),
        "external_id": log.external_id,
        "listing_url": listing_url,
        "error_message": log.error_message,
        "history": [
            {"success": h.success, "error_message": h.error_message, "created_at": h.created_at}
            for h in history
        ],
    }


# ── Storefront Categories — Shopify & Custom Website only ──────────────────
# TheDersi/Daraz/Noon/eBay already have their own category systems
# (ChannelCategory/ProductChannelCategory above). Shopify and Custom
# Website have no category concept at all today — this is a shop-managed,
# customer-facing category list for those two specifically, powering the
# public storefront category endpoint below.

from app.models.storefront_category import (
    StorefrontCategory, STOREFRONT_CATEGORY_CHANNELS, READ_ONLY_CATEGORY_CHANNELS,
)


class StorefrontCategoryIn(BaseModel):
    channel_type: str
    name: str
    icon_url: Optional[str] = None
    sort_order: int = 0
    parent_id: Optional[int] = None  # None = Main. Set = Sub (or Sub-sub if parent itself has a parent).
    is_published: bool = True
    visibility: str = "nav_and_grid"   # nav_and_grid | nav_only | hidden
    is_featured: bool = False
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None


class StorefrontCategoryBulkIn(BaseModel):
    channel_type: str
    names: List[str]
    parent_id: Optional[int] = None


def _check_storefront_channel(shop_id: int, channel_type: str, db: Session):
    if channel_type not in STOREFRONT_CATEGORY_CHANNELS:
        raise HTTPException(
            status_code=400,
            detail=f"Storefront categories are only available for: {', '.join(STOREFRONT_CATEGORY_CHANNELS)}.",
        )
    # Categories only mean anything once the channel is actually connected
    # — creating them for a channel with nothing to display them just
    # produces orphaned data the seller forgets about.
    conn = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.channel_type == channel_type,
        ChannelConnection.is_active == True,
    ).first()
    if not conn:
        raise HTTPException(status_code=400, detail={
            "error": "channel_not_connected",
            "message": f"Connect {channel_type.capitalize() if channel_type != 'custom' else 'Custom Website'} first, under Channels, before managing its categories.",
        })


def _cat_out(r: StorefrontCategory) -> dict:
    return {
        "id": r.id, "channel_type": r.channel_type, "name": r.name, "slug": r.slug,
        "icon_url": r.icon_url, "sort_order": r.sort_order, "parent_id": r.parent_id,
        "is_published": bool(r.is_published), "visibility": r.visibility or "nav_and_grid",
        "is_featured": bool(r.is_featured), "seo_title": r.seo_title, "seo_description": r.seo_description,
        "created_at": r.created_at, "updated_at": r.updated_at,
    }


@router.get("/shops/{shop_id}/storefront-categories")
def list_storefront_categories(
    shop_id: int,
    channel_type: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns a flat list (each row carries parent_id) — the dashboard and
    any storefront build the Main/Sub/Sub-sub tree from that client-side,
    same as how the existing product Category model is consumed."""
    _shop_or_404(shop_id, current_user, db)
    if channel_type not in STOREFRONT_CATEGORY_CHANNELS:
        raise HTTPException(status_code=400, detail=f"channel_type must be one of: {', '.join(STOREFRONT_CATEGORY_CHANNELS)}")
    rows = db.query(StorefrontCategory).filter(
        StorefrontCategory.shop_id == shop_id,
        StorefrontCategory.channel_type == channel_type,
    ).order_by(StorefrontCategory.sort_order).all()

    # Real per-category product count — a ROLLUP: this category plus every
    # descendant, counting each product once even if it's filed under both a
    # parent and a child. ProductStorefrontCategory.category_id is the
    # storefront category's own id stored as a string, scoped to this
    # channel's connection.
    from collections import defaultdict
    from app.models.channel_category import ProductStorefrontCategory
    counts: dict = {}
    conn = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.channel_type == channel_type,
        ChannelConnection.is_active == True,
    ).first()
    if conn and rows:
        direct: dict = defaultdict(set)
        for cid, pid in db.query(
            ProductStorefrontCategory.category_id, ProductStorefrontCategory.product_id,
        ).filter(ProductStorefrontCategory.channel_connection_id == conn.id).all():
            direct[str(cid)].add(pid)
        children: dict = defaultdict(list)
        for r in rows:
            children[r.parent_id].append(r.id)

        def _subtree(cid):
            s = set(direct.get(str(cid), ()))
            for ch in children.get(cid, ()):
                s |= _subtree(ch)
            return s

        counts = {r.id: len(_subtree(r.id)) for r in rows}

    return [{**_cat_out(r), "product_count": counts.get(r.id, 0)} for r in rows]


@router.get("/shops/{shop_id}/storefront-categories/icon-presign")
def presign_storefront_category_icon(
    shop_id: int,
    content_type: str = "image/jpeg",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Presigned upload for a category icon — a real image upload, not a
    pasted URL. One image per category: the category row has a single
    icon_url field, so uploading again just replaces it."""
    _shop_or_404(shop_id, current_user, db)
    from app.core.storage import generate_storefront_category_presigned_url
    ext = content_type.split("/")[-1].replace("jpeg", "jpg")
    return generate_storefront_category_presigned_url(shop_id, ext, content_type)


@router.post("/shops/{shop_id}/storefront-categories", status_code=201)
def create_storefront_category(
    shop_id: int,
    data: StorefrontCategoryIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    _check_storefront_channel(shop_id, data.channel_type, db)

    parent = None
    if data.parent_id is not None:
        parent = db.query(StorefrontCategory).filter(
            StorefrontCategory.id == data.parent_id,
            StorefrontCategory.shop_id == shop_id,
            StorefrontCategory.channel_type == data.channel_type,
        ).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent category not found")

    cat = StorefrontCategory(
        shop_id=shop_id,
        channel_type=data.channel_type,
        name=data.name,
        slug=f"{slugify(data.name)}-{uuid.uuid4().hex[:6]}",
        icon_url=data.icon_url,
        sort_order=data.sort_order,
        parent_id=data.parent_id,
        is_published=data.is_published,
        visibility=data.visibility if data.visibility in ("nav_and_grid", "nav_only", "hidden") else "nav_and_grid",
        is_featured=data.is_featured,
        seo_title=(data.seo_title or None),
        seo_description=(data.seo_description or None),
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return _cat_out(cat)


@router.put("/shops/{shop_id}/storefront-categories/{category_id}")
def update_storefront_category(
    shop_id: int,
    category_id: int,
    data: StorefrontCategoryIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    cat = db.query(StorefrontCategory).filter(
        StorefrontCategory.id == category_id, StorefrontCategory.shop_id == shop_id,
    ).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    if data.parent_id is not None:
        if data.parent_id == category_id:
            raise HTTPException(status_code=400, detail="A category can't be its own parent")
        parent = db.query(StorefrontCategory).filter(
            StorefrontCategory.id == data.parent_id,
            StorefrontCategory.shop_id == shop_id,
            StorefrontCategory.channel_type == cat.channel_type,
        ).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent category not found")

    cat.name = data.name
    cat.icon_url = data.icon_url
    cat.sort_order = data.sort_order
    cat.parent_id = data.parent_id
    cat.is_published = data.is_published
    if data.visibility in ("nav_and_grid", "nav_only", "hidden"):
        cat.visibility = data.visibility
    cat.is_featured = data.is_featured
    cat.seo_title = (data.seo_title or None)
    cat.seo_description = (data.seo_description or None)
    db.commit()
    return _cat_out(cat)


@router.delete("/shops/{shop_id}/storefront-categories/{category_id}", status_code=200)
def delete_storefront_category(
    shop_id: int,
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    cat = db.query(StorefrontCategory).filter(
        StorefrontCategory.id == category_id, StorefrontCategory.shop_id == shop_id,
    ).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    db.delete(cat)  # cascades to children — see model's cascade="all, delete-orphan"
    db.commit()
    return {"message": "Category deleted"}


@router.get("/shops/{shop_id}/storefront-categories/summary")
def storefront_categories_summary(
    shop_id: int,
    channel_type: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Real counts for the Storefront Categories stat cards — main vs sub
    categories, how many products are filed under at least one category,
    and how many active products have none yet."""
    _shop_or_404(shop_id, current_user, db)
    from sqlalchemy import func as sql_func
    from app.models.channel_category import ProductStorefrontCategory

    rows = db.query(StorefrontCategory.id, StorefrontCategory.parent_id).filter(
        StorefrontCategory.shop_id == shop_id,
        StorefrontCategory.channel_type == channel_type,
    ).all()
    main_count = sum(1 for _id, pid in rows if pid is None)
    sub_count = sum(1 for _id, pid in rows if pid is not None)

    products_categorized = 0
    products_uncategorized = 0
    conn = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.channel_type == channel_type,
        ChannelConnection.is_active == True,
    ).first()
    if conn:
        active_ids = {
            r[0] for r in db.query(Product.id).filter(
                Product.shop_id == shop_id, Product.is_active == True,
            ).all()
        }
        filed_ids = {
            r[0] for r in db.query(ProductStorefrontCategory.product_id).filter(
                ProductStorefrontCategory.channel_connection_id == conn.id,
            ).distinct().all()
        }
        products_categorized = len(active_ids & filed_ids)
        products_uncategorized = len(active_ids - filed_ids)

    return {
        "main_count": main_count,
        "sub_count": sub_count,
        "products_categorized": products_categorized,
        "products_uncategorized": products_uncategorized,
    }


@router.post("/shops/{shop_id}/storefront-categories/bulk", status_code=201)
def bulk_create_storefront_categories(
    shop_id: int,
    data: StorefrontCategoryBulkIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Quick import — one category name per line. Creates them at the given
    parent (or as Main categories), skipping blanks and names that already
    exist at that level. No CSV parsing, no external fetch — just names."""
    _shop_or_404(shop_id, current_user, db)
    _check_storefront_channel(shop_id, data.channel_type, db)

    if data.parent_id is not None:
        parent = db.query(StorefrontCategory).filter(
            StorefrontCategory.id == data.parent_id,
            StorefrontCategory.shop_id == shop_id,
            StorefrontCategory.channel_type == data.channel_type,
        ).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent category not found")

    existing = {
        c.name.strip().lower()
        for c in db.query(StorefrontCategory).filter(
            StorefrontCategory.shop_id == shop_id,
            StorefrontCategory.channel_type == data.channel_type,
            StorefrontCategory.parent_id == data.parent_id,
        ).all()
    }
    base_order = db.query(func.count(StorefrontCategory.id)).filter(
        StorefrontCategory.shop_id == shop_id,
        StorefrontCategory.channel_type == data.channel_type,
        StorefrontCategory.parent_id == data.parent_id,
    ).scalar() or 0

    created = []
    seen = set()
    for raw in data.names:
        name = (raw or "").strip()
        key = name.lower()
        if not name or key in existing or key in seen:
            continue
        seen.add(key)
        cat = StorefrontCategory(
            shop_id=shop_id, channel_type=data.channel_type, name=name,
            slug=f"{slugify(name)}-{uuid.uuid4().hex[:6]}",
            sort_order=base_order + len(created), parent_id=data.parent_id,
        )
        db.add(cat)
        created.append(cat)

    db.commit()
    for c in created:
        db.refresh(c)
    return {"created": [_cat_out(c) for c in created], "skipped": len(data.names) - len(created)}
