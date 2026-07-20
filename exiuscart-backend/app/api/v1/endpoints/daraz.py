"""
Daraz Open Platform — OAuth2 connect flow.

Unlike TheDersi (a static per-seller API key), Daraz uses OAuth2: ExiusCart
registers ONE app on open.daraz.com and gets a single App Key/Secret for the
whole platform. Each seller then authorizes that app against their own,
already-existing Daraz seller account — they never see or enter the App
Key/Secret themselves.

Flow:
  1. Seller clicks "Connect Daraz" → GET /shops/{shop_id}/channels/daraz/authorize
     → we create a pending ChannelConnection with a CSRF `state` token and
       return Daraz's authorize URL.
  2. Browser redirects to Daraz → seller logs into THEIR Daraz seller account
     → approves access.
  3. Daraz redirects back to GET /channels/daraz/callback?code=...&state=...
     → we validate state, then exchange the code for a real access_token via
       /auth/token/create (see _exchange_code_for_token and _daraz_signed_request).

Every Daraz Open Platform API call — including the token exchange itself —
must be signed: sort all params alphabetically, concatenate as
"key1value1key2value2...", prepend the API path, HMAC-SHA256 with the App
Secret, uppercase-hex the digest. This is implemented once in
_daraz_signed_request and reused for every future Daraz API call (orders,
products, etc.), not just auth.
"""
import os
import time
import hmac
import hashlib
import secrets
import logging
from datetime import datetime, timezone, timedelta
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.shop import Shop
from app.models.channel import ChannelConnection
from app.models.subscription import Subscription
from app.api.v1.endpoints.channels import _shop_or_404, EXIUSCART_BASE

logger = logging.getLogger(__name__)

router = APIRouter()

DARAZ_APP_KEY = os.getenv("DARAZ_APP_KEY", "")
DARAZ_APP_SECRET = os.getenv("DARAZ_APP_SECRET", "")

STOREFRONT_BASE = "https://store.exiuscart.com"

# Daraz has no shared domain for login OR the REST API — each market has its
# own (confirmed live: api.daraz.com resolves to nothing; api.daraz.lk works).
# Only these 5 countries actually have a Daraz marketplace; sellers elsewhere
# (e.g. UAE) genuinely can't connect Daraz at all, not a bug.
DARAZ_COUNTRY_AUTHORIZE_URLS = {
    "PK": "https://api.daraz.pk/oauth/authorize",
    "BD": "https://api.daraz.com.bd/oauth/authorize",
    "LK": "https://api.daraz.lk/oauth/authorize",
    "NP": "https://api.daraz.com.np/oauth/authorize",
    "MM": "https://api.shop.com.mm/oauth/authorize",
}
DARAZ_COUNTRY_API_BASE_URLS = {
    "PK": "https://api.daraz.pk/rest",
    "BD": "https://api.daraz.com.bd/rest",
    "LK": "https://api.daraz.lk/rest",
    "NP": "https://api.daraz.com.np/rest",
    "MM": "https://api.shop.com.mm/rest",
}


def _daraz_api_base(country_code: str) -> str:
    return DARAZ_COUNTRY_API_BASE_URLS.get((country_code or "").strip().upper(), "")


def _daraz_signed_request(api_path: str, business_params: dict, country_code: str, access_token: str | None = None) -> dict | None:
    """Calls any Daraz Open Platform API with correct HMAC-SHA256 signing.
    api_path is e.g. "/auth/token/create" or "/category/tree/get". country_code
    picks the right per-market domain (api.daraz.lk etc — there is no shared
    api.daraz.com). Returns the parsed JSON response, or None on failure."""
    base = _daraz_api_base(country_code)
    if not base:
        logger.error(f"[DARAZ API] no API base URL for country={country_code!r}")
        return None

    params = {
        "app_key": DARAZ_APP_KEY,
        "sign_method": "sha256",
        "timestamp": str(int(time.time() * 1000)),
        **business_params,
    }
    if access_token:
        params["access_token"] = access_token

    sorted_keys = sorted(params.keys())
    concatenated = api_path + "".join(f"{k}{params[k]}" for k in sorted_keys)
    sign = hmac.new(
        DARAZ_APP_SECRET.encode("utf-8"), concatenated.encode("utf-8"), hashlib.sha256
    ).hexdigest().upper()
    params["sign"] = sign

    url = f"{base}{api_path}"
    try:
        resp = httpx.get(url, params=params, timeout=15)
        return resp.json()
    except Exception as e:
        logger.error(f"[DARAZ API] request to {api_path} failed: {e}")
        return None


def _daraz_callback_url() -> str:
    return f"{EXIUSCART_BASE.rstrip('/')}/channels/daraz/callback"


@router.get("/shops/{shop_id}/channels/daraz/authorize")
def daraz_authorize(
    shop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Start the Daraz OAuth flow — returns the URL to redirect the seller's
    browser to. The seller must already have their own Daraz seller account;
    this only authorizes ExiusCart's app to access it."""
    shop = _shop_or_404(shop_id, current_user, db)

    if not DARAZ_APP_KEY:
        raise HTTPException(
            status_code=503,
            detail="Daraz integration isn't configured yet — ExiusCart's app registration with Daraz is still pending.",
        )

    country_code = (shop.country or "").strip().upper()
    daraz_authorize_url = DARAZ_COUNTRY_AUTHORIZE_URLS.get(country_code)
    if not daraz_authorize_url:
        raise HTTPException(
            status_code=400,
            detail=f"Daraz isn't available in your shop's country ({shop.country or 'not set'}). "
                   f"Daraz only operates in Pakistan, Bangladesh, Sri Lanka, Nepal, and Myanmar.",
        )

    existing = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.channel_type == "daraz",
        ChannelConnection.is_active == True,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already connected to Daraz")

    sub = db.query(Subscription).filter(Subscription.shop_id == shop_id).order_by(Subscription.id.desc()).first()
    plan_type = sub.plan_type if sub else "free_trial"
    if plan_type not in ("thedersi_pro", "premium"):
        raise HTTPException(
            status_code=403,
            detail={
                "error": "daraz_requires_pro",
                "plan": plan_type,
                "message": (
                    "Daraz sync is available on TheDersi Pro. Upgrade your TheDersi plan to connect Daraz."
                    if plan_type.startswith("thedersi")
                    else "Daraz sync is available on Premium. Upgrade to connect your Daraz seller account."
                ),
            },
        )

    state = secrets.token_urlsafe(32)

    pending = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.channel_type == "daraz",
        ChannelConnection.is_active == False,
    ).first()
    if pending:
        pending.oauth_state = state
    else:
        pending = ChannelConnection(
            shop_id=shop_id,
            channel_type="daraz",
            is_active=False,
            oauth_state=state,
            webhook_secret=secrets.token_urlsafe(32),
        )
        db.add(pending)
    db.commit()

    params = {
        "response_type": "code",
        "force_auth": "true",
        "redirect_uri": _daraz_callback_url(),
        "client_id": DARAZ_APP_KEY,
        "state": state,
    }
    authorize_url = f"{daraz_authorize_url}?{urlencode(params)}"
    return {"authorize_url": authorize_url}


@router.get("/channels/daraz/callback")
def daraz_callback(
    code: str = None,
    state: str = None,
    error: str = None,
    db: Session = Depends(get_db),
):
    """Daraz redirects the seller's browser here after they approve (or deny)
    access. Public endpoint — verified via the CSRF `state` token, not auth."""
    if error or not code or not state:
        logger.warning(f"[DARAZ OAUTH] callback failed — error={error} code_present={bool(code)} state_present={bool(state)}")
        return RedirectResponse(f"{STOREFRONT_BASE}/dashboard/channels?daraz=denied")

    conn = db.query(ChannelConnection).filter(
        ChannelConnection.channel_type == "daraz",
        ChannelConnection.oauth_state == state,
        ChannelConnection.is_active == False,
    ).first()
    if not conn:
        logger.error(f"[DARAZ OAUTH] callback with unknown/expired state={state[:8]}...")
        return RedirectResponse(f"{STOREFRONT_BASE}/dashboard/channels?daraz=invalid_state")

    shop = db.query(Shop).filter(Shop.id == conn.shop_id).first()
    country_code = (shop.country if shop else "") or ""
    token_result = _exchange_code_for_token(code, country_code)
    if token_result is None:
        # Real Daraz API call failed (bad/expired code, network issue, etc.) —
        # leave the connection pending rather than silently dropping the
        # seller's authorization. Safe to retry since the code is still on
        # this ChannelConnection row.
        conn.seller_status = "pending_token_exchange"
        db.commit()
        logger.warning(f"[DARAZ OAUTH] shop={conn.shop_id} token exchange failed — connection left pending, see error above")
        return RedirectResponse(f"{STOREFRONT_BASE}/dashboard/channels?daraz=pending")

    conn.access_token = token_result["access_token"]
    conn.refresh_token = token_result.get("refresh_token")
    conn.token_expires_at = token_result.get("expires_at")
    conn.is_active = True
    conn.oauth_state = None
    conn.seller_status = "approved"
    db.commit()
    return RedirectResponse(f"{STOREFRONT_BASE}/dashboard/channels?daraz=connected")


def _exchange_code_for_token(code: str, country_code: str):
    """Exchanges an OAuth authorization code for a real access_token via
    POST /auth/token/create, per open.daraz.com's Quick Start Guide →
    Seller authorization introduction. Returns None on failure so the
    caller can leave the connection "pending" instead of guessing."""
    data = _daraz_signed_request("/auth/token/create", {"code": code}, country_code)
    if not data or "access_token" not in data:
        logger.error(f"[DARAZ OAUTH] token exchange failed — response: {data}")
        return None

    expires_at = datetime.now(timezone.utc) + timedelta(seconds=data.get("expires_in", 0))
    return {
        "access_token": data["access_token"],
        "refresh_token": data.get("refresh_token"),
        "expires_at": expires_at,
    }


def _flatten_daraz_categories(nodes: list, breadcrumb: str = "") -> list:
    """Daraz's category tree is arbitrarily deep (unlike TheDersi's flat
    2-level list) and only leaf nodes can actually be used to list a
    product. Walks the tree and returns only leaves, each carrying a
    breadcrumb name like "Bags and Travel > Kids Bags > Backpacks" so the
    dropdown stays understandable without showing the whole tree."""
    leaves = []
    for node in nodes or []:
        name = node.get("name", "")
        path = f"{breadcrumb} > {name}" if breadcrumb else name
        children = node.get("children") or []
        if node.get("leaf") and not children:
            leaves.append({
                "category_id": node.get("category_id"),
                "name": path,
            })
        else:
            leaves.extend(_flatten_daraz_categories(children, path))
    return leaves


def fetch_daraz_categories(access_token: str, country_code: str) -> list | None:
    """Fetches Daraz's full category tree via /category/tree/get and flattens
    it to leaf-only categories with breadcrumb names. Returns None on a
    hard API failure (caller should surface "couldn't load categories"),
    or a (possibly empty) list on success."""
    data = _daraz_signed_request("/category/tree/get", {}, country_code, access_token=access_token)
    if not data or "data" not in data:
        logger.error(f"[DARAZ CATEGORIES] fetch failed — response: {data}")
        return None
    return _flatten_daraz_categories(data["data"])


# ── Product creation — category attributes + brands are simple read calls,
# same proven shape as /category/tree/get (flat GET params, JSON response),
# so built with the same confidence. CreateProduct itself is NOT built yet —
# see the note further down; it needs a live test before shipping.

def fetch_daraz_category_attributes(access_token: str, country_code: str, category_id: str) -> list | None:
    """GetCategoryAttributes — which fields a specific leaf category requires
    to create a product (name, isMandatory, inputType, options for
    select-type fields, etc.) — different per category."""
    data = _daraz_signed_request(
        "/category/attributes/get", {"primary_category_id": category_id}, country_code, access_token=access_token,
    )
    if not data or "data" not in data:
        logger.error(f"[DARAZ ATTRIBUTES] fetch failed for category={category_id} — response: {data}")
        return None
    return data["data"]


def fetch_daraz_brands(access_token: str, country_code: str, name_search: str = "") -> list | None:
    """GetBrands — Daraz's real brand list, so a seller picks a valid brand
    ID instead of typing free text Daraz would reject."""
    params = {"name": name_search} if name_search else {}
    data = _daraz_signed_request("/brands/get", params, country_code, access_token=access_token)
    if not data or "data" not in data:
        logger.error(f"[DARAZ BRANDS] fetch failed — response: {data}")
        return None
    return data["data"]


# ── Earnings — Daraz's own Finance APIs, real endpoint paths confirmed from
# Daraz's docs (unlike the product-creation ones below, these were given as
# literal REST paths, not just action names) ────────────────────────────────

def fetch_daraz_payout_statements(access_token: str, country_code: str, created_after: str) -> list | None:
    """GetPayoutStatus — periodic settlement statements (opening/closing
    balance, fees, revenue, what's already been paid) created after the
    given date (YYYY-MM-DD)."""
    data = _daraz_signed_request(
        "/finance/payout/status/get", {"created_after": created_after}, country_code, access_token=access_token,
    )
    if not data or "data" not in data:
        logger.error(f"[DARAZ EARNINGS] payout status fetch failed — response: {data}")
        return None
    return data["data"]


def fetch_daraz_transactions(access_token: str, country_code: str, start_time: str, end_time: str, offset: int = 0, limit: int = 500) -> list | None:
    """QueryTransactionDetails — the line-by-line transaction ledger (per
    order, fees, tax, payment amounts) behind a statement. Daraz caps the
    start_time/end_time span at under 180 days per call."""
    data = _daraz_signed_request(
        "/finance/transaction/details/get",
        {"start_time": start_time, "end_time": end_time, "offset": str(offset), "limit": str(limit)},
        country_code, access_token=access_token,
    )
    if not data or "data" not in data:
        logger.error(f"[DARAZ EARNINGS] transaction details fetch failed — response: {data}")
        return None
    return data["data"]


@router.get("/shops/{shop_id}/channels/daraz/earnings")
def get_daraz_earnings(
    shop_id: int,
    days: int = 90,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Daraz earnings — real payout statements from the seller's connected
    Daraz account, going back `days` days (Daraz caps a single query under
    180 days, so this is clamped to stay under that)."""
    shop = _shop_or_404(shop_id, current_user, db)
    conn = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.channel_type == "daraz",
        ChannelConnection.is_active == True,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Daraz not connected")

    days = min(max(days, 1), 179)
    since = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")

    statements = fetch_daraz_payout_statements(conn.access_token, shop.country, since)
    if statements is None:
        raise HTTPException(status_code=502, detail="Could not reach Daraz — try again shortly")
    return {"statements": statements}


def fetch_daraz_order(access_token: str, country_code: str, order_id: str) -> dict | None:
    """GetOrder — full details for one order (buyer, address, payment
    method, status) given its Daraz order_id."""
    data = _daraz_signed_request("/order/get", {"order_id": order_id}, country_code, access_token=access_token)
    if not data or "data" not in data:
        logger.error(f"[DARAZ ORDERS] GetOrder failed for order_id={order_id} — response: {data}")
        return None
    return data["data"]


def fetch_daraz_order_items(access_token: str, country_code: str, order_id: str) -> list | None:
    """GetOrderItems — the products inside one order (SellerSku, quantity,
    price) given its Daraz order_id."""
    data = _daraz_signed_request("/order/items/get", {"order_id": order_id}, country_code, access_token=access_token)
    if not data or "data" not in data:
        logger.error(f"[DARAZ ORDERS] GetOrderItems failed for order_id={order_id} — response: {data}")
        return None
    return data["data"]


def discover_daraz_order_ids(access_token: str, country_code: str, start_time: str, end_time: str) -> set:
    """No direct 'list new orders' endpoint is wired up yet (Daraz's docs
    call it GetOrders, plural — not yet confirmed). Until then, this uses
    QueryTransactionDetails (which IS fully confirmed) as a proxy: every
    order with financial activity in the window shows up with its
    order_no, which doubles as the Daraz order_id GetOrder/GetOrderItems
    need. Orders with zero transactions in the window (e.g. still
    "pending", never paid) won't be caught by this — a real GetOrders
    integration would be more complete."""
    transactions = fetch_daraz_transactions(access_token, country_code, start_time, end_time)
    if not transactions:
        return set()
    order_ids = set()
    for t in transactions:
        order_no = t.get("order_no")
        if order_no:
            order_ids.add(str(order_no))
    return order_ids


def sync_daraz_orders(conn, shop, db: Session, start_time: str, end_time: str) -> int:
    """Pull in any Daraz orders discovered in the given window that
    ExiusCart doesn't already have, matching line items to real products
    by SKU. Returns how many new orders were created."""
    from app.models.channel_order_meta import ChannelOrderMeta
    from app.models.order import Order, OrderItem
    from app.models.product import Product
    import uuid as _uuid

    order_ids = discover_daraz_order_ids(conn.access_token, shop.country, start_time, end_time)
    if not order_ids:
        return 0

    already_known = {
        m.channel_order_id for m in db.query(ChannelOrderMeta).filter(
            ChannelOrderMeta.channel_type == "daraz",
            ChannelOrderMeta.channel_order_id.in_(order_ids),
        ).all()
    }
    new_ids = order_ids - already_known
    created = 0

    for daraz_order_id in new_ids:
        order_data = fetch_daraz_order(conn.access_token, shop.country, daraz_order_id)
        items_data = fetch_daraz_order_items(conn.access_token, shop.country, daraz_order_id)
        if not order_data or not items_data:
            logger.warning(f"[DARAZ ORDERS] shop={shop.id} order_id={daraz_order_id} — could not fetch full details, skipping")
            continue

        subtotal = 0.0
        order_items_to_add = []
        for item in items_data:
            seller_sku = item.get("sku") or item.get("SellerSku")
            product = db.query(Product).filter(
                Product.shop_id == shop.id, Product.sku == seller_sku,
            ).first() if seller_sku else None
            if not product:
                logger.warning(f"[DARAZ ORDERS] shop={shop.id} order_id={daraz_order_id} — no product matches SKU {seller_sku!r}, skipping item")
                continue
            item_price = float(item.get("item_price") or item.get("paid_price") or 0)
            subtotal += item_price
            order_items_to_add.append(OrderItem(
                product_id=product.id,
                product_name=product.name,
                quantity=1,  # Daraz returns one line per unit, not a quantity field
                unit_price=item_price,
                total_price=item_price,
            ))

        if not order_items_to_add:
            logger.warning(f"[DARAZ ORDERS] shop={shop.id} order_id={daraz_order_id} — no items matched any product, order not created")
            continue

        order = Order(
            order_number=f"DRZ-{daraz_order_id}-{str(_uuid.uuid4())[:4].upper()}",
            source="channel",
            subtotal=subtotal,
            total=subtotal,
            shop_id=shop.id,
            notes=f"Daraz Order #{daraz_order_id}",
        )
        db.add(order)
        db.flush()
        for oi in order_items_to_add:
            oi.order_id = order.id
            db.add(oi)
        db.add(ChannelOrderMeta(
            order_id=order.id,
            channel_type="daraz",
            channel_order_id=daraz_order_id,
        ))
        created += 1

    if created:
        db.commit()
    return created


@router.get("/shops/{shop_id}/channels/daraz/category-attributes")
def get_daraz_category_attributes(
    shop_id: int,
    category_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shop = _shop_or_404(shop_id, current_user, db)
    conn = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.channel_type == "daraz",
        ChannelConnection.is_active == True,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Daraz not connected")
    attributes = fetch_daraz_category_attributes(conn.access_token, shop.country, category_id)
    if attributes is None:
        raise HTTPException(status_code=502, detail="Could not reach Daraz — try again shortly")
    return {"attributes": attributes}


@router.get("/shops/{shop_id}/channels/daraz/brands")
def get_daraz_brands(
    shop_id: int,
    search: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shop = _shop_or_404(shop_id, current_user, db)
    conn = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.channel_type == "daraz",
        ChannelConnection.is_active == True,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Daraz not connected")
    brands = fetch_daraz_brands(conn.access_token, shop.country, search)
    if brands is None:
        raise HTTPException(status_code=502, detail="Could not reach Daraz — try again shortly")
    return {"brands": brands}


@router.post("/shops/{shop_id}/channels/daraz/sync-orders")
def sync_daraz_orders_now(
    shop_id: int,
    days: int = 7,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manually pull in any Daraz orders from the last `days` days that
    ExiusCart doesn't already have. See sync_daraz_orders — until a
    confirmed GetOrders endpoint is wired up, this discovers orders via
    QueryTransactionDetails instead, so an order with zero payment
    activity in the window won't show up yet."""
    shop = _shop_or_404(shop_id, current_user, db)
    conn = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.channel_type == "daraz",
        ChannelConnection.is_active == True,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Daraz not connected")

    days = min(max(days, 1), 179)
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days)
    created = sync_daraz_orders(conn, shop, db, start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d"))
    return {"orders_created": created}


@router.get("/shops/{shop_id}/channels/daraz/transactions")
def get_daraz_transactions(
    shop_id: int,
    start_time: str,
    end_time: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Line-item transaction detail behind a Daraz earnings statement —
    start_time/end_time as YYYY-MM-DD, span under 180 days."""
    shop = _shop_or_404(shop_id, current_user, db)
    conn = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.channel_type == "daraz",
        ChannelConnection.is_active == True,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Daraz not connected")

    transactions = fetch_daraz_transactions(conn.access_token, shop.country, start_time, end_time)
    if transactions is None:
        raise HTTPException(status_code=502, detail="Could not reach Daraz — try again shortly")
    return {"transactions": transactions}
