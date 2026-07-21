"""
Noon marketplace integration (UAE/KSA/GCC).

Unlike Daraz/TheDersi, this is a single ExiusCart-wide service account (JWT
service-account login), not per-seller OAuth — Noon's "integrator" partner
program (one app, many sellers connect via OAuth) has no self-serve signup,
so for now ExiusCart authenticates once under its own Noon partner project
(PRJ574411) rather than each seller connecting their own account.

Auth flow (confirmed working via live testing, 2026-07-21):
  1. Sign a short-lived JWT: {"sub": NOON_KEY_ID, "jti": <uuid>, "iat", "exp"},
     header {"kid": NOON_KEY_ID}, algorithm RS256, signed with NOON_PRIVATE_KEY.
  2. POST it to /identity/public/v1/api/login as {"token": <jwt>,
     "default_project_code": NOON_PROJECT_CODE}.
  3. Noon responds 200 with an empty body and sets session cookies
     (_npsid, _nprtnetid) — NOT a bearer token. Subsequent calls reuse those
     cookies, not an Authorization header.

Confirmed working via live testing against the real account (2026-07-21):
login, categories/list, categories/attributes/list, content/product/upsert,
xborder-pricing/product/upsert. NOT yet confirmed: stock/stock-update (taken
from a docs screenshot only, never called live — marked UNVERIFIED below),
pricing, offer/publish (making a listing actually purchasable), orders,
earnings/payouts (no dedicated API found in Noon's service list at all so far).
"""
import time
import uuid
import logging
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException
from jose import jwt
from pydantic import BaseModel

from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

NOON_API_BASE = "https://noon-api-gateway.noon.partners"

# Cached authenticated session — the login cookie is long-lived (Max-Age
# 2592000s / 30 days) so we reuse one httpx.Client instead of logging in on
# every request; refreshed proactively well before any real expiry.
_session: Optional[httpx.Client] = None
_session_created_at: float = 0
_SESSION_MAX_AGE_SECONDS = 60 * 50


def _build_login_jwt() -> str:
    now = int(time.time())
    claims = {"sub": settings.NOON_KEY_ID, "jti": str(uuid.uuid4()), "iat": now, "exp": now + 300}
    private_key = settings.NOON_PRIVATE_KEY.replace("\\n", "\n")
    return jwt.encode(claims, private_key, algorithm="RS256", headers={"kid": settings.NOON_KEY_ID})


def _login() -> httpx.Client:
    client = httpx.Client(base_url=NOON_API_BASE, timeout=20)
    token = _build_login_jwt()
    resp = client.post("/identity/public/v1/api/login", json={
        "token": token,
        "default_project_code": settings.NOON_PROJECT_CODE,
    })
    if resp.status_code != 200:
        client.close()
        raise HTTPException(status_code=502, detail=f"Noon login failed: {resp.status_code} {resp.text[:300]}")
    return client


def _noon_session() -> httpx.Client:
    """Returns a live authenticated session, logging in fresh if there's
    none cached yet or the cached one is old enough to risk expiry."""
    global _session, _session_created_at
    if _session is not None and (time.time() - _session_created_at) < _SESSION_MAX_AGE_SECONDS:
        return _session
    if _session is not None:
        _session.close()
    _session = _login()
    _session_created_at = time.time()
    return _session


def _noon_request(method: str, path: str, **kwargs) -> httpx.Response:
    """Authenticated request against Noon's API gateway. Retries once with a
    fresh login if the session was rejected (expired early, revoked, etc.)."""
    session = _noon_session()
    resp = session.request(method, path, **kwargs)
    if resp.status_code in (401, 403):
        global _session
        if _session is not None:
            _session.close()
        _session = None
        session = _noon_session()
        resp = session.request(method, path, **kwargs)
    return resp


@router.get("/noon/connection-status")
def get_noon_connection_status():
    """Confirms ExiusCart's Noon service-account login still works. Internal/
    debug endpoint — not per-shop, since this is one shared platform account."""
    if not settings.NOON_KEY_ID or not settings.NOON_PRIVATE_KEY:
        raise HTTPException(status_code=503, detail="Noon credentials not configured on this server")
    try:
        resp = _noon_request("GET", "/identity/public/v1/api/whoami")
    except HTTPException:
        raise
    return {
        "login_ok": True,
        "whoami_status": resp.status_code,
        "whoami_body": resp.text[:500],
    }


# ── Categories & attributes (confirmed working, 2026-07-21) ────────────────

@router.get("/noon/categories")
def get_noon_categories():
    """All Noon category codes (e.g. 'apparel-blazers_suits-blazer')."""
    resp = _noon_request("POST", "/content/v1/categories/list", json={})
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Noon categories/list failed: {resp.status_code} {resp.text[:300]}")
    return resp.json()


@router.get("/noon/categories/{category_code}/attributes")
def get_noon_category_attributes(category_code: str):
    """Attribute schema (product_title, long_description, feature_bullet,
    etc.) required/allowed for a given Noon category — same role as Daraz's
    category-attributes endpoint, drives the seller-facing listing form."""
    resp = _noon_request("POST", "/content/v1/categories/attributes/list", json={"category_code": category_code})
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Noon category attributes failed: {resp.status_code} {resp.text[:300]}")
    return resp.json()


# ── Product creation (confirmed working, 2026-07-21) ────────────────────────
#
# Noon splits a "product" into 3 independent calls, unlike Daraz's single
# CreateProduct:
#   1. content/v1/product/upsert       — title/description/images/attributes
#   2. xborder-pricing/v1/product/upsert — dimensions/weight/HS code (shipping)
#   3. stock/v1/stock-update           — warehouse stock levels
# Pricing itself (a 4th, separate "Pricing" service) and "Offer" (making the
# listing actually live/purchasable) are NOT yet confirmed — still pending.

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


@router.post("/noon/products/create")
def create_noon_product(data: NoonCreateProductIn):
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
    resp = _noon_request("POST", "/content/v1/product/upsert", json=payload)
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


@router.post("/noon/products/shipping-meta")
def upsert_noon_shipping_meta(items: list[NoonShippingMetaIn]):
    """Cross-border shipping/customs metadata (dimensions, weight, HS code) —
    separate call from the actual product content, required for Noon's
    cross-border fulfillment to work."""
    payload = {"items": [i.model_dump(exclude_none=True) for i in items]}
    resp = _noon_request("POST", "/xborder-pricing/v1/product/upsert", json=payload)
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Noon shipping-meta upsert failed: {resp.status_code} {resp.text[:500]}")
    return resp.json()


class NoonStockItemIn(BaseModel):
    warehouse_code: str
    partner_sku: str
    qty: int
    processing_time: Optional[str] = None


@router.post("/noon/stock/update")
def update_noon_stock(items: list[NoonStockItemIn]):
    """UNVERIFIED — path and field names taken from a docs screenshot
    (Stock > UpdateStock), not yet tested live like the endpoints above."""
    payload = {"items": [i.model_dump(exclude_none=True) for i in items]}
    resp = _noon_request("POST", "/stock/v1/stock-update", json=payload)
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Noon stock update failed: {resp.status_code} {resp.text[:500]}")
    return resp.json()
