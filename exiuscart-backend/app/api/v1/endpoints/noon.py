"""
Noon marketplace integration (UAE/KSA/GCC).

Per-seller credentials, same shape as Daraz/TheDersi — each shop connects
its OWN Noon service account (not one shared ExiusCart-wide account). Noon
has no self-serve "integrator" partner program (unlike Daraz's Open
Platform), so there's no automatic OAuth click-to-connect available yet;
until that partnership is approved, a seller connects by generating their
own service-account key on Noon's own Partners dashboard and pasting it in
here — same UX as TheDersi's channel_api_key, just with more fields.

Credentials are stored as a JSON blob in ChannelConnection.channel_api_key
(widened to TEXT — the RSA private key alone is ~1750 chars):
  {"key_id": "...", "private_key": "...", "channel_identifier": "...", "project_code": "..."}
channel_warehouse_code holds the seller's own chosen warehouse — their own
licensed space, or Noon's own consolidation center for sellers without a
local trade license. Never assumed/hardcoded; fetched from their account.

Auth flow (confirmed working via live testing, 2026-07-21):
  1. Sign a short-lived JWT: {"sub": key_id, "jti": <uuid>, "iat", "exp"},
     header {"kid": key_id}, algorithm RS256, signed with private_key.
  2. POST it to /identity/public/v1/api/login as {"token": <jwt>,
     "default_project_code": project_code}.
  3. Noon responds 200 with an empty body and sets session cookies
     (_npsid, _nprtnetid) — NOT a bearer token. Subsequent calls reuse those
     cookies, not an Authorization header.

Confirmed working via live testing against a real account (2026-07-21):
login, categories/list, categories/attributes/list, content/product/upsert,
xborder-pricing/product/upsert, warehouse-platform/warehouses/list,
impex export/category/list (earnings live here — noon_financeweb_
transactionviewreportonitemlevel — as an async export, not a direct query).

NOT yet confirmed: stock/stock-update and fbpi/fbpi-orders/list are built
from docs/JS-bundle discovery but both require a real warehouse_code to
actually call, which no test account has had yet — marked UNVERIFIED below
until exercised against a shop with a real warehouse on file.
"""
import time
import uuid
import json
import logging
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from jose import jwt
from pydantic import BaseModel

from app.core.database import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.channel import ChannelConnection
from app.api.v1.endpoints.channels import _shop_or_404

logger = logging.getLogger(__name__)
router = APIRouter()

NOON_API_BASE = "https://noon-api-gateway.noon.partners"

# Cached authenticated session PER SHOP — the login cookie is long-lived
# (Max-Age 2592000s / 30 days) so we reuse one httpx.Client per shop instead
# of logging in on every request; refreshed proactively well before expiry.
_sessions: dict[int, httpx.Client] = {}
_session_created_at: dict[int, float] = {}
_SESSION_MAX_AGE_SECONDS = 60 * 50


def _get_noon_connection(shop_id: int, db: Session) -> ChannelConnection:
    conn = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.channel_type == "noon",
        ChannelConnection.is_active == True,
    ).first()
    if not conn or not conn.channel_api_key:
        raise HTTPException(status_code=404, detail="Noon is not connected for this shop yet")
    return conn


def _get_noon_creds(conn: ChannelConnection) -> dict:
    try:
        return json.loads(conn.channel_api_key)
    except (TypeError, ValueError):
        raise HTTPException(status_code=500, detail="Stored Noon credentials are corrupted — reconnect Noon for this shop")


def _build_login_jwt(creds: dict) -> str:
    now = int(time.time())
    claims = {"sub": creds["key_id"], "jti": str(uuid.uuid4()), "iat": now, "exp": now + 300}
    private_key = creds["private_key"].replace("\\n", "\n")
    return jwt.encode(claims, private_key, algorithm="RS256", headers={"kid": creds["key_id"]})


def _login(creds: dict) -> httpx.Client:
    client = httpx.Client(base_url=NOON_API_BASE, timeout=20)
    token = _build_login_jwt(creds)
    resp = client.post("/identity/public/v1/api/login", json={
        "token": token,
        "default_project_code": creds["project_code"],
    })
    if resp.status_code != 200:
        client.close()
        raise HTTPException(status_code=502, detail=f"Noon login failed: {resp.status_code} {resp.text[:300]}")
    return client


def _noon_session(shop_id: int, creds: dict) -> httpx.Client:
    """Returns a live authenticated session for this shop, logging in fresh
    if there's none cached yet or the cached one is old enough to risk expiry."""
    existing = _sessions.get(shop_id)
    created_at = _session_created_at.get(shop_id, 0)
    if existing is not None and (time.time() - created_at) < _SESSION_MAX_AGE_SECONDS:
        return existing
    if existing is not None:
        existing.close()
    client = _login(creds)
    _sessions[shop_id] = client
    _session_created_at[shop_id] = time.time()
    return client


def _noon_request(shop_id: int, creds: dict, method: str, path: str, **kwargs) -> httpx.Response:
    """Authenticated request against Noon's API gateway for a specific shop.
    Retries once with a fresh login if the session was rejected."""
    session = _noon_session(shop_id, creds)
    resp = session.request(method, path, **kwargs)
    if resp.status_code in (401, 403):
        session.close()
        _sessions.pop(shop_id, None)
        session = _noon_session(shop_id, creds)
        resp = session.request(method, path, **kwargs)
    return resp


def _noon_request_for_shop(shop_id: int, db: Session, method: str, path: str, **kwargs) -> httpx.Response:
    conn = _get_noon_connection(shop_id, db)
    creds = _get_noon_creds(conn)
    return _noon_request(shop_id, creds, method, path, **kwargs)


# ── Connect / disconnect ────────────────────────────────────────────────────

class NoonConnectIn(BaseModel):
    key_id: str
    private_key: str
    channel_identifier: str
    project_code: str


@router.post("/shops/{shop_id}/channels/noon/connect")
def connect_noon(
    shop_id: int,
    data: NoonConnectIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Saves the seller's own Noon service-account credentials and verifies
    them with a real login before saving, so a typo doesn't get stored as if
    it worked."""
    _shop_or_404(shop_id, current_user, db)

    creds = data.model_dump()
    try:
        client = _login(creds)
        client.close()
    except HTTPException:
        raise

    conn = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.channel_type == "noon",
    ).first()
    if not conn:
        import secrets
        conn = ChannelConnection(
            shop_id=shop_id,
            channel_type="noon",
            webhook_secret=secrets.token_urlsafe(24),
        )
        db.add(conn)
    conn.channel_api_key = json.dumps(creds)
    conn.channel_seller_id = data.channel_identifier
    conn.is_active = True
    db.commit()

    _sessions.pop(shop_id, None)  # drop any stale cached session for this shop

    return {"connected": True}


@router.delete("/shops/{shop_id}/channels/noon/disconnect")
def disconnect_noon(
    shop_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _shop_or_404(shop_id, current_user, db)
    conn = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.channel_type == "noon",
    ).first()
    if conn:
        conn.is_active = False
        db.commit()
    _sessions.pop(shop_id, None)
    return {"disconnected": True}


# ── Warehouse selection ──────────────────────────────────────────────────────

@router.get("/shops/{shop_id}/channels/noon/warehouses")
def list_noon_warehouses(
    shop_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Warehouses already set up on the SELLER's own Noon account — their own
    licensed space, or Noon's own consolidation center. Never assumed."""
    _shop_or_404(shop_id, current_user, db)
    resp = _noon_request_for_shop(shop_id, db, "POST", "/warehouse-platform/v1/warehouses/list", json={})
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Noon warehouses/list failed: {resp.status_code} {resp.text[:300]}")
    return resp.json()


class NoonSetWarehouseIn(BaseModel):
    warehouse_code: str


@router.post("/shops/{shop_id}/channels/noon/warehouse")
def set_noon_warehouse(
    shop_id: int,
    data: NoonSetWarehouseIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _shop_or_404(shop_id, current_user, db)
    conn = _get_noon_connection(shop_id, db)
    conn.channel_warehouse_code = data.warehouse_code
    db.commit()
    return {"warehouse_code": data.warehouse_code}


# ── Categories & attributes ──────────────────────────────────────────────────

@router.get("/shops/{shop_id}/channels/noon/categories")
def get_noon_categories(
    shop_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """All Noon category codes (e.g. 'apparel-blazers_suits-blazer')."""
    _shop_or_404(shop_id, current_user, db)
    resp = _noon_request_for_shop(shop_id, db, "POST", "/content/v1/categories/list", json={})
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Noon categories/list failed: {resp.status_code} {resp.text[:300]}")
    return resp.json()


@router.get("/shops/{shop_id}/channels/noon/categories/{category_code}/attributes")
def get_noon_category_attributes(
    shop_id: int,
    category_code: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Attribute schema (product_title, long_description, feature_bullet,
    etc.) required/allowed for a given Noon category — drives the
    seller-facing listing form, same role as Daraz's category-attributes."""
    _shop_or_404(shop_id, current_user, db)
    resp = _noon_request_for_shop(shop_id, db, "POST", "/content/v1/categories/attributes/list", json={"category_code": category_code})
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Noon category attributes failed: {resp.status_code} {resp.text[:300]}")
    return resp.json()


# ── Product creation ─────────────────────────────────────────────────────────
#
# Noon splits a "product" into up to 3 independent calls, unlike Daraz's
# single CreateProduct:
#   1. content/v1/product/upsert         — title/description/images/attributes
#   2. xborder-pricing/v1/product/upsert — dimensions/weight/HS code (shipping)
#   3. stock/v1/stock-update             — warehouse stock levels (needs
#      channel_warehouse_code to be set first)
# Pricing (a separate "Pricing" service) and "Offer" (making a listing
# actually live/purchasable) are NOT yet confirmed — still pending.

class NoonSkuIn(BaseModel):
    partner_sku: str
    size: Optional[str] = None


class NoonImageIn(BaseModel):
    url: str
    sort: int = 1


class NoonAttributeValueIn(BaseModel):
    value: str
    language: Optional[str] = None  # LANGUAGE_UNSPECIFIED | LANGUAGE_EN | LANGUAGE_AR
    sort: Optional[int] = None


class NoonCreateProductIn(BaseModel):
    skus: list[NoonSkuIn]
    brand: str
    category_code: str
    images: list[NoonImageIn]
    attributes: dict[str, list[NoonAttributeValueIn]]  # attribute_code -> values


@router.post("/shops/{shop_id}/channels/noon/products/create")
def create_noon_product(
    shop_id: int,
    data: NoonCreateProductIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _shop_or_404(shop_id, current_user, db)
    payload = {
        "skus": [s.model_dump(exclude_none=True) for s in data.skus],
        "brand": data.brand,
        "category": data.category_code,
        "images": [i.model_dump() for i in data.images],
        "attributes": {
            attr_code: {"values": [v.model_dump(exclude_none=True) for v in values]}
            for attr_code, values in data.attributes.items()
        },
    }
    resp = _noon_request_for_shop(shop_id, db, "POST", "/content/v1/product/upsert", json=payload)
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Noon product upsert failed: {resp.status_code} {resp.text[:500]}")
    return resp.json()


class NoonDimensionsIn(BaseModel):
    length: float
    width: float
    height: float


class NoonShippingMetaIn(BaseModel):
    partner_sku: str
    dimensions_cm: Optional[NoonDimensionsIn] = None
    actual_weight_kg: Optional[float] = None
    hs_code: Optional[str] = None


@router.post("/shops/{shop_id}/channels/noon/products/shipping-meta")
def upsert_noon_shipping_meta(
    shop_id: int,
    items: list[NoonShippingMetaIn],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cross-border shipping/customs metadata (dimensions, weight, HS code) —
    separate call from the actual product content, required for Noon's
    cross-border fulfillment to work."""
    _shop_or_404(shop_id, current_user, db)
    payload = {"items": [i.model_dump(exclude_none=True) for i in items]}
    resp = _noon_request_for_shop(shop_id, db, "POST", "/xborder-pricing/v1/product/upsert", json=payload)
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Noon shipping-meta upsert failed: {resp.status_code} {resp.text[:500]}")
    return resp.json()


# ── Stock (UNVERIFIED — needs a real warehouse_code to actually exercise) ───

@router.post("/shops/{shop_id}/channels/noon/stock/update")
def update_noon_stock(
    shop_id: int,
    items: list[dict],  # [{"partner_sku": str, "qty": int, "processing_time": str}]
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """UNVERIFIED past the field-name/path confirmation — never called with a
    real warehouse_code yet. Uses this shop's own saved channel_warehouse_code."""
    _shop_or_404(shop_id, current_user, db)
    conn = _get_noon_connection(shop_id, db)
    if not conn.channel_warehouse_code:
        raise HTTPException(status_code=400, detail="No warehouse selected for this shop's Noon connection yet")
    payload = {"items": [{**item, "warehouse_code": conn.channel_warehouse_code} for item in items]}
    resp = _noon_request_for_shop(shop_id, db, "POST", "/stock/v1/stock-update", json=payload)
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Noon stock update failed: {resp.status_code} {resp.text[:500]}")
    return resp.json()
