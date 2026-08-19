"""
Dropshipping integration — CJ Dropshipping, Zendrop, HyperSKU, Wiio.

Plan limits:
  starter    → CJ only (1 supplier)
  premium    → all suppliers
  free_trial → no dropshipping
  thedersi_* → no dropshipping (fulfilled by TheDersi)
"""

import logging
import re
import httpx
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.thedersi import is_thedersi_shop
from app.core.encryption import encrypt, decrypt
from app.models.user import User
from app.models.order import Order
from app.models.subscription import Subscription
from app.models.dropship import DropshipConnection, DropshipProductLink, DropshipOrder
from app.api.v1.deps import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

# ── Supplier signup links (affiliate — update these when you have the links) ──
SUPPLIER_SIGNUP_LINKS = {
    "cj":         "https://www.cjdropshipping.com/register.html?token=bce7840c-d60b-46e7-b39c-872e1572796c",  # CJ affiliate — 2% of referred sellers' CJ revenue for 1yr
    "zendrop":    "https://app.zendrop.com/signup",                 # replace with affiliate link
    "hypersku":   "https://www.hypersku.com/register",              # replace with affiliate link
    "wiio":       "https://wiio.com/register",                      # replace with affiliate link
    # Real order-placement API exists (AliExpress Open Platform's
    # AE-Dropshipper category: createOrder/shippingInfo/productDetails),
    # but it's gated behind an app application + audit — ExiusCart hasn't
    # been approved yet, so this is scaffolding: the connection is stored
    # the same way as the other API-key suppliers, but nothing actually
    # calls AliExpress until real App Key/Secret + OAuth are wired in.
    "aliexpress": "https://developers.aliexpress.com/",
    # ── Print-on-Demand — design once, provider prints + ships automatically.
    # Same scaffolding-first treatment as AliExpress above: the connection is
    # stored the same way as the other API-key suppliers, but no design-upload/
    # mockup/order-submission flow is wired in yet. Each of these has a real,
    # documented API (catalog + async mockup generation + order placement)
    # to build against once this becomes the active piece of work.
    "printful":   "https://www.printful.com/dashboard/register",   # replace with affiliate link
    "printify":   "https://printify.com/app/register",             # replace with affiliate link
    "gelato":     "https://www.gelato.com/sign-up",                # replace with affiliate link
}

CJ_BASE = "https://developers.cjdropshipping.com/api2.0/v1"
PRINTFUL_BASE = "https://api.printful.com"

# Dropship suppliers forward an order to be picked, packed and shipped from
# their own stock. POD (print-on-demand) suppliers instead print a design
# onto a blank product per order — no inventory to forward, a design/mockup
# step instead. Kept as a separate set purely so the UI can group them under
# their own "Print-on-Demand" section instead of listing all eight the same way.
POD_SUPPLIERS = {"printful", "printify", "gelato"}

PLAN_ALLOWED_SUPPLIERS = {
    "premium":       {"cj", "zendrop", "hypersku", "wiio", "aliexpress", "printful", "printify", "gelato"},
    "starter":       {"cj"},
    "free_trial":    set(),
    "thedersi_basic":  set(),
    "thedersi_growth": set(),
    "thedersi_pro":    set(),
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_plan(shop_id: int, db: Session) -> str:
    sub = db.query(Subscription).filter(Subscription.shop_id == shop_id).order_by(Subscription.id.desc()).first()
    return sub.plan_type if sub else "free_trial"


def _check_supplier_allowed(plan: str, supplier_type: str, shop_id: int, db: Session):
    # Checked via an active TheDersi connection, not plan_type — TheDersi's
    # Growth/Premium tier maps to plan_type='starter', which PLAN_ALLOWED_
    # SUPPLIERS would otherwise let through to CJ (starter customers' own
    # CJ access), even though TheDersi sellers' fulfilment is always
    # TheDersi's, never a dropship supplier.
    if is_thedersi_shop(shop_id, db):
        raise HTTPException(status_code=403, detail={
            "error": "not_available",
            "message": "Dropshipping suppliers are not available on TheDersi plans. Your fulfilment is managed by TheDersi.",
        })
    allowed = PLAN_ALLOWED_SUPPLIERS.get(plan, set())
    if supplier_type not in allowed:
        if plan in ("free_trial",):
            raise HTTPException(status_code=403, detail={
                "error": "plan_required",
                "message": "Dropshipping is available on Starter (CJ only) and Premium plans. Upgrade to get started.",
            })
        if supplier_type != "cj" and plan == "starter":
            raise HTTPException(status_code=403, detail={
                "error": "upgrade_required",
                "supplier": supplier_type,
                "message": f"{supplier_type.title()} is available on Premium plans. CJ Dropshipping is included in your Starter plan.",
                "signup_url": SUPPLIER_SIGNUP_LINKS.get(supplier_type, ""),
            })
        raise HTTPException(status_code=403, detail={"error": "not_allowed", "message": "Supplier not available on your plan."})


def _shop_or_404(shop_id: int, user: User, db: Session):
    from app.models.shop import Shop
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


def _parse_cj_price(raw) -> float:
    """CJ returns prices as plain numbers for single-variant products but as a
    range string for multi-variant ones — take the low end. Different endpoints
    format the range differently ('0.57 -- 1.14' on /product/list vs
    '1.55-3.35' on /product/myProduct/query), so pull the leading number
    out with a regex instead of splitting on one specific separator."""
    if raw is None or raw == "":
        return 0.0
    if isinstance(raw, (int, float)):
        return float(raw)
    match = re.match(r"[\d.]+", str(raw).strip())
    if not match:
        return 0.0
    try:
        return float(match.group())
    except ValueError:
        return 0.0


async def _rehost_printful_image(client: httpx.AsyncClient, url: str, shop_id: int, product_id: int) -> str:
    """Printful's mockup preview URLs are temporary (Printful expires/removes
    them within days) — storing them directly would leave product images
    quietly breaking a few days after every import. Downloads and re-uploads
    to ExiusCart's own R2 storage so the URL is permanent. Falls back to the
    original Printful URL if the download/upload fails for any reason —
    a slower-to-expire image beats a failed import."""
    from app.core.storage import upload_image
    try:
        resp = await client.get(url, timeout=20)
        resp.raise_for_status()
        ext = (url.rsplit(".", 1)[-1].split("?")[0] or "png")[:4]
        if ext not in ("png", "jpg", "jpeg", "webp", "gif"):
            ext = "png"
        content_type = resp.headers.get("content-type", "image/png").split(";")[0]
        return upload_image(resp.content, shop_id, product_id, ext, content_type)
    except Exception as exc:
        logger.warning(f"[Printful Import] Failed to re-host image {url}: {exc} — keeping original (temporary) URL")
        return url


def _sanitize_supplier_html(html: str) -> str:
    """Supplier descriptions (CJ, and any future import source) routinely embed
    their product photos as inline base64 <img> data URIs rather than linking
    real image files — one real CJ import left a shop with a 7MB description
    (a single embedded photo) that then got served on every product-list API
    call, on every storefront and every channel that product was pushed to.
    Strips all <img> tags — the frontend's rich-text editor already does the
    same for pasted HTML (see sanitizePastedHtml in rich-text-editor.tsx) but
    that only covers seller-typed content, not data written directly by an
    import endpoint like this one."""
    if not html:
        return html
    return re.sub(r"<img\b[^>]*>", "", html, flags=re.IGNORECASE)


# ── CJ token management ───────────────────────────────────────────────────────

async def _cj_get_token(api_key: str) -> dict:
    """
    CJ's email+password login mode is being phased out — confirmed live via
    their own API error: 'Email or password is wrong... We recommend
    switching to the apiKey mode.' Per their docs (developers.cjdropshipping.com
    /en/api/api2/api/auth.html), apiKey mode needs only the key, generated by
    the seller at cjdropshipping.com/my.html#/authorize/API (Add API →
    type "API Key"), not their account password.
    """
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(f"{CJ_BASE}/authentication/getAccessToken", json={
            "apiKey": api_key,
        })
    data = r.json()
    if not data.get("result"):
        # Log CJ's actual response — the frontend only ever sees a generic
        # message, so this is the only way to see the real rejection reason.
        logger.error(f"[CJ Auth] login failed — status={r.status_code} response={data}")
        raise HTTPException(status_code=400, detail={
            "error": "cj_auth_failed",
            "message": "Could not connect to CJ Dropshipping. Check your API key.",
        })
    return data["data"]  # { accessToken, accessTokenExpiryDate, refreshToken, refreshTokenExpiryDate, openId, createDate }


async def _cj_ensure_token(conn: DropshipConnection, db: Session) -> str:
    """Return a valid CJ access token, refreshing if needed."""
    now = datetime.now(timezone.utc)
    if conn.access_token and conn.token_expires_at and conn.token_expires_at > now:
        return conn.access_token

    # Re-auth using the stored API key
    if not conn.api_key:
        raise HTTPException(status_code=400, detail={
            "error": "cj_reconnect_required",
            "message": "CJ session expired. Please reconnect your CJ account.",
        })
    api_key = decrypt(conn.api_key)
    token_data = await _cj_get_token(api_key)
    conn.access_token = token_data["accessToken"]
    conn.token_expires_at = datetime.fromisoformat(token_data["accessTokenExpiryDate"].replace("Z", "+00:00"))
    db.commit()
    return conn.access_token


# ── Schemas ───────────────────────────────────────────────────────────────────

class CJConnectIn(BaseModel):
    api_key: str

class CJImportIn(BaseModel):
    cj_pid: str
    selling_price: Optional[float] = None   # seller sets markup; defaults to 2× cost

class APIKeyConnectIn(BaseModel):
    supplier_type: str   # zendrop / hypersku / wiio / aliexpress
    api_key: str

class ProductLinkIn(BaseModel):
    supplier_type: str
    supplier_product_url: Optional[str] = None
    supplier_product_id: Optional[str] = None
    supplier_sku: Optional[str] = None
    cost_price: Optional[float] = None
    shipping_estimate_days: Optional[int] = None
    warehouse: Optional[str] = None
    is_primary: bool = True

class FulfillOrderIn(BaseModel):
    supplier_type: str = "cj"

class AutoFulfillToggleIn(BaseModel):
    enabled: bool


# ── Endpoints: CJ product browse & import ────────────────────────────────────

async def _get_cj_conn_or_400(shop_id: int, db: Session) -> DropshipConnection:
    conn = db.query(DropshipConnection).filter(
        DropshipConnection.shop_id == shop_id,
        DropshipConnection.supplier_type == "cj",
        DropshipConnection.is_active == True,
    ).first()
    if not conn:
        raise HTTPException(status_code=400, detail={
            "error": "cj_not_connected",
            "message": "Connect CJ Dropshipping first in the Dropshipping section.",
        })
    return conn


@router.get("/shops/{shop_id}/dropship/cj/search")
async def cj_search_products(
    shop_id: int,
    q: str = "",
    page: int = 1,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    plan = _get_plan(shop_id, db)
    if is_thedersi_shop(shop_id, db) or plan == "free_trial":
        raise HTTPException(status_code=403, detail="CJ product browse is not available on your plan.")

    conn = await _get_cj_conn_or_400(shop_id, db)
    token = await _cj_ensure_token(conn, db)

    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(f"{CJ_BASE}/product/list", params={
            "productNameEn": q,
            "pageNum": page,
            "pageSize": 20,
        }, headers={"CJ-Access-Token": token})

    data = r.json()
    if not data.get("result"):
        raise HTTPException(status_code=502, detail=f"CJ API error: {data.get('message', 'Unknown error')}")

    cj_list = data.get("data", {}).get("list") or []
    products = [
        {
            "pid": p.get("pid") or p.get("productId", ""),
            "name": p.get("productNameEn") or p.get("productName", ""),
            "image": p.get("productImage") or p.get("productImageUrl", ""),
            "cost_price": _parse_cj_price(p.get("sellPrice") or p.get("minSellPrice")),
            "category": p.get("categoryName", ""),
        }
        for p in cj_list
    ]
    return {"products": products, "total": data.get("data", {}).get("total", 0), "page": page}


@router.get("/shops/{shop_id}/dropship/cj/my-products")
async def cj_my_products(
    shop_id: int,
    page: int = 1,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The seller's own curated shortlist from CJ's site (Product Sourcing →
    My Product) — already vetted by them, so no search-relevance issues."""
    _shop_or_404(shop_id, current_user, db)
    plan = _get_plan(shop_id, db)
    if is_thedersi_shop(shop_id, db) or plan == "free_trial":
        raise HTTPException(status_code=403, detail="CJ product browse is not available on your plan.")

    conn = await _get_cj_conn_or_400(shop_id, db)
    token = await _cj_ensure_token(conn, db)

    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(f"{CJ_BASE}/product/myProduct/query", params={
            "pageNum": page,
            "pageSize": 20,
        }, headers={"CJ-Access-Token": token})

    data = r.json()
    if not data.get("result"):
        raise HTTPException(status_code=502, detail=f"CJ API error: {data.get('message', 'Unknown error')}")

    d = data.get("data") or {}
    cj_list = d.get("content") or d.get("list") or []
    products = [
        {
            "pid": p.get("productId") or p.get("pid", ""),
            "name": p.get("nameEn") or p.get("productNameEn") or p.get("productName", ""),
            "image": p.get("bigImage") or p.get("productImage", ""),
            "cost_price": _parse_cj_price(p.get("sellPrice")),
            "category": p.get("categoryName", ""),
        }
        for p in cj_list
    ]
    total = d.get("totalRecords") or d.get("total") or 0
    return {"products": products, "total": total, "page": page}


@router.get("/shops/{shop_id}/dropship/cj/product/{cj_pid}")
async def cj_get_product_detail(
    shop_id: int,
    cj_pid: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    plan = _get_plan(shop_id, db)
    if is_thedersi_shop(shop_id, db) or plan == "free_trial":
        raise HTTPException(status_code=403, detail="Not available on your plan.")

    conn = await _get_cj_conn_or_400(shop_id, db)
    token = await _cj_ensure_token(conn, db)

    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(f"{CJ_BASE}/product/query", params={"pid": cj_pid}, headers={"CJ-Access-Token": token})

    data = r.json()
    if not data.get("result"):
        raise HTTPException(status_code=502, detail=f"CJ API error: {data.get('message', 'Unknown error')}")

    p = data.get("data", {})
    images = []
    for img in (p.get("productImageSet") or p.get("imageSet") or []):
        url = img if isinstance(img, str) else (img.get("imageUrl") or img.get("url") or "")
        if url:
            images.append(url)
    if not images and p.get("productImage"):
        images.append(p["productImage"])

    return {
        "product": {
            "pid": cj_pid,
            "name": p.get("productNameEn") or p.get("productName", ""),
            "description": p.get("description") or "",
            "images": images[:10],
            "cost_price": _parse_cj_price(p.get("sellPrice") or p.get("suggestSellPrice")),
            "category": p.get("categoryName", ""),
            "sku": p.get("productSku") or "",
            "variants": p.get("variants") or [],
        }
    }


@router.get("/shops/{shop_id}/dropship/cj/shipping-estimate")
async def cj_shipping_estimate(
    shop_id: int,
    product_id: int,
    country_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Estimate CJ shipping cost for a product to a destination country, before
    committing to fulfil an order, using CJ's freight-calculate endpoint.

    UNVERIFIED — built from CJ's publicly documented API shape
    (developers.cjdropshipping.com), not live-tested against a real CJ
    account (no test credentials available in this session, unlike Noon
    earlier). Confirm this actually returns sensible numbers with a real
    connected CJ account before relying on it.
    """
    _shop_or_404(shop_id, current_user, db)
    conn = await _get_cj_conn_or_400(shop_id, db)
    token = await _cj_ensure_token(conn, db)

    link = db.query(DropshipProductLink).filter(
        DropshipProductLink.product_id == product_id,
        DropshipProductLink.supplier_type == "cj",
    ).first()
    if not link or not link.supplier_sku:
        raise HTTPException(status_code=400, detail="This product has no CJ supplier link.")

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(f"{CJ_BASE}/logistic/freightCalculate", json={
                "startCountryCode": "CN",
                "endCountryCode": country_code.upper(),
                "products": [{"vid": link.supplier_sku, "quantity": 1}],
            }, headers={"CJ-Access-Token": token})
        data = r.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"CJ API error: {str(e)}")

    if not data.get("result"):
        raise HTTPException(status_code=502, detail=data.get("message", "CJ could not calculate shipping for this destination."))

    options = []
    for opt in (data.get("data") or []):
        options.append({
            "logistic_name": opt.get("logisticName") or opt.get("logisticAging") or opt.get("name") or "Standard Shipping",
            "price": float(opt.get("logisticPrice") or opt.get("price") or 0),
            "days": opt.get("logisticAging") or opt.get("aging") or None,
        })

    return {"options": options, "product_cost": float(link.cost_price or 0)}


@router.post("/shops/{shop_id}/dropship/cj/import")
async def cj_import_product(
    shop_id: int,
    body: CJImportIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.product import Product
    from app.models.product_fields import ProductImage
    from app.api.v1.endpoints.products import generate_slug, PLAN_PRODUCT_LIMITS

    shop = _shop_or_404(shop_id, current_user, db)
    plan = _get_plan(shop_id, db)
    if is_thedersi_shop(shop_id, db) or plan == "free_trial":
        raise HTTPException(status_code=403, detail="Product import is not available on your plan.")

    # Check product limit
    limit = PLAN_PRODUCT_LIMITS.get(plan, 25)
    if limit != -1:
        count = db.query(Product).filter(Product.shop_id == shop_id).count()
        if count >= limit:
            raise HTTPException(status_code=403, detail=f"Product limit reached ({limit} on your plan). Upgrade to add more.")

    conn = await _get_cj_conn_or_400(shop_id, db)
    token = await _cj_ensure_token(conn, db)

    # Fetch full product detail from CJ
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(f"{CJ_BASE}/product/query", params={"pid": body.cj_pid}, headers={"CJ-Access-Token": token})

    cj = r.json()
    if not cj.get("result"):
        raise HTTPException(status_code=502, detail="Failed to fetch product from CJ. Please try again.")

    p = cj.get("data", {})
    name = (p.get("productNameEn") or p.get("productName") or "CJ Product").strip()

    # CJ Order API needs the specific variant's vid to place an order — without it,
    # fulfillment fails later with "no supplier link" even though the product imported
    # fine. Use the first variant as the default (this import flow creates one
    # ExiusCart product per CJ product, not one per variant).
    variants = p.get("variants") or []
    primary_variant = variants[0] if variants else {}
    variant_vid = primary_variant.get("vid")

    cost = _parse_cj_price(p.get("sellPrice") or p.get("suggestSellPrice") or primary_variant.get("variantSellPrice"))
    # CJ always quotes in USD — cost_price below intentionally stays in USD
    # (it's a supplier-cost reference, not something a buyer sees), but the
    # customer-facing price is implicitly in the shop's base_currency, so
    # the default 2x markup needs converting or a EUR/LKR/etc shop ends up
    # with a raw USD number stored as if it were their own currency.
    if body.selling_price:
        price = body.selling_price
    else:
        from app.core.currency import convert_amount
        target_currency = shop.base_currency or shop.currency or "USD"
        price = round(await convert_amount(cost * 2, "USD", target_currency), 2)

    # Create product
    product = Product(
        shop_id=shop_id,
        name=name,
        description=_sanitize_supplier_html(p.get("description")) or name,
        price=price,
        cost_price=cost,
        sku=p.get("productSku") or body.cj_pid[:50],
        quantity=0,
        low_stock_threshold=5,
        slug=generate_slug(name),
    )
    db.add(product)
    db.flush()  # get product.id without committing

    # Add images
    images = []
    for img in (p.get("productImageSet") or p.get("imageSet") or []):
        url = img if isinstance(img, str) else (img.get("imageUrl") or img.get("url") or "")
        if url:
            images.append(url)
    if not images and p.get("productImage"):
        images.append(p["productImage"])
    for i, url in enumerate(images[:10]):
        db.add(ProductImage(product_id=product.id, url=url, sort_order=i, is_primary=(i == 0)))

    # Save CJ supplier link
    db.add(DropshipProductLink(
        shop_id=shop_id,
        product_id=product.id,
        supplier_type="cj",
        supplier_product_id=body.cj_pid,
        supplier_sku=variant_vid,
        supplier_product_name=name,
        cost_price=cost,
        is_primary=True,
    ))

    if not variant_vid:
        logger.warning(f"[CJ Import] shop={shop_id} product={product.id} cj_pid={body.cj_pid} — no variants returned, order fulfillment will fail until a supplier SKU is set manually.")

    db.commit()
    db.refresh(product)
    logger.info(f"[CJ Import] shop={shop_id} imported product={product.id} cj_pid={body.cj_pid}")
    return {"product_id": product.id, "name": product.name, "price": product.price, "cost_price": cost}


# ── Endpoints: Printful catalog (print-on-demand blanks, not existing stock) ──
# First real piece of the Printful integration — proves a connected token can
# actually talk to Printful. Design upload / mockup generation / order
# placement are separate, larger pieces built after this is confirmed working.

async def _get_printful_conn_or_400(shop_id: int, db: Session) -> DropshipConnection:
    conn = db.query(DropshipConnection).filter(
        DropshipConnection.shop_id == shop_id,
        DropshipConnection.supplier_type == "printful",
        DropshipConnection.is_active == True,
    ).first()
    if not conn:
        raise HTTPException(status_code=400, detail={
            "error": "printful_not_connected",
            "message": "Connect Printful first in the Suppliers section.",
        })
    return conn


@router.get("/shops/{shop_id}/dropship/printful/catalog")
async def printful_catalog(
    shop_id: int,
    category_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Printful's Catalog API — the blank products (hoodie styles, sizes,
    colors) available to print on, not anything already in the seller's own
    store. category_id filters to one category (e.g. hoodies) once the
    seller has picked one from /categories.
    """
    _shop_or_404(shop_id, current_user, db)
    plan = _get_plan(shop_id, db)
    if is_thedersi_shop(shop_id, db) or plan == "free_trial":
        raise HTTPException(status_code=403, detail="Print-on-demand catalog browse is not available on your plan.")

    conn = await _get_printful_conn_or_400(shop_id, db)
    api_key = decrypt(conn.api_key)

    params = {"category_id": category_id} if category_id else {}
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(f"{PRINTFUL_BASE}/products", params=params,
                              headers={"Authorization": f"Bearer {api_key}"})

    if r.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Printful API error: {r.status_code} {r.text[:300]}")

    items = r.json().get("result") or []
    return {
        "products": [
            {
                "printful_id": p.get("id"),
                "name": p.get("title"),
                "brand": p.get("brand"),
                "model": p.get("model"),
                "image": p.get("image"),
                "variant_count": p.get("variant_count"),
            }
            for p in items
        ],
    }


@router.get("/shops/{shop_id}/dropship/printful/product/{printful_id}")
async def printful_product_detail(
    shop_id: int,
    printful_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Real variants (size/color/price) for one Printful catalog product —
    what the seller picks from before a design gets placed on it."""
    _shop_or_404(shop_id, current_user, db)
    conn = await _get_printful_conn_or_400(shop_id, db)
    api_key = decrypt(conn.api_key)

    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(f"{PRINTFUL_BASE}/products/{printful_id}",
                              headers={"Authorization": f"Bearer {api_key}"})

    if r.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Printful API error: {r.status_code} {r.text[:300]}")

    data = r.json().get("result") or {}
    product = data.get("product") or {}
    variants = data.get("variants") or []
    return {
        "printful_id": product.get("id"),
        "name": product.get("title"),
        "image": product.get("image"),
        "variants": [
            {
                "variant_id": v.get("id"),
                "size": v.get("size"),
                "color": v.get("color"),
                "color_code": v.get("color_code"),
                "price": v.get("price"),
                "image": v.get("image"),
            }
            for v in variants
        ],
    }


def _printful_headers(conn: DropshipConnection) -> dict:
    """Account-scoped tokens (the "Account (all stores)" option — see
    connect_printful) need X-PF-Store-Id on every store-context call or
    Printful 400s with "requires store_id". Single-store tokens don't need
    it and ignore it if sent, so it's always safe to include when we have it.
    conn.access_token holds the resolved store_id, set at connect time."""
    headers = {"Authorization": f"Bearer {decrypt(conn.api_key)}"}
    if conn.access_token:
        headers["X-PF-Store-Id"] = conn.access_token
    return headers


class PrintfulImportIn(BaseModel):
    sync_product_id: int
    selling_price: Optional[float] = None


@router.get("/shops/{shop_id}/dropship/printful/my-products")
async def printful_my_products(
    shop_id: int,
    page: int = 1,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The seller's own synced products from Printful's Design Lab (blanks
    they've already designed + mocked up over there) — this is what gets
    imported into ExiusCart, not the raw catalog (that's /printful/catalog
    above, blanks with nothing designed on them yet)."""
    _shop_or_404(shop_id, current_user, db)
    plan = _get_plan(shop_id, db)
    if is_thedersi_shop(shop_id, db) or plan == "free_trial":
        raise HTTPException(status_code=403, detail="Print-on-demand product browse is not available on your plan.")

    conn = await _get_printful_conn_or_400(shop_id, db)
    limit = 20
    offset = (max(page, 1) - 1) * limit

    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(f"{PRINTFUL_BASE}/store/products",
                              params={"offset": offset, "limit": limit},
                              headers=_printful_headers(conn))
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Printful API error: {r.status_code} {r.text[:300]}")

    body = r.json()
    items = body.get("result") or []
    paging = body.get("paging") or {}
    return {
        "products": [
            {
                "sync_product_id": p.get("id"),
                "name": p.get("name"),
                "image": p.get("thumbnail_url") or p.get("thumbnail"),
                "variant_count": p.get("variants"),
            }
            for p in items
        ],
        "total": paging.get("total", len(items)),
        "page": page,
    }


@router.post("/shops/{shop_id}/dropship/printful/import")
async def printful_import(
    shop_id: int,
    body: PrintfulImportIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Pulls one already-designed Printful sync product into ExiusCart as a
    real, sellable Product — variants, mockup images, price. Mirrors
    import_cj_product below in shape (same response fields), but the
    supplier SKU stored on DropshipProductLink is a Printful sync_variant_id
    (needed by /orders at fulfillment time), not a CJ vid.

    UNVERIFIED against a live Printful account with real synced products —
    built from Printful's documented /store/products/{id} response shape
    (sync_product + sync_variants), same caveat as CJ's shipping-estimate
    endpoint elsewhere in this file. Confirm the variant name parsing below
    actually splits "Color / Size" the way a real synced product names it,
    and adjust if Printful's real format differs.
    """
    from app.models.product import Product
    from app.models.product_fields import ProductImage
    from app.models.product_variant import ProductVariant
    from app.api.v1.endpoints.products import generate_slug, PLAN_PRODUCT_LIMITS

    shop = _shop_or_404(shop_id, current_user, db)
    plan = _get_plan(shop_id, db)
    if is_thedersi_shop(shop_id, db) or plan == "free_trial":
        raise HTTPException(status_code=403, detail="Product import is not available on your plan.")

    limit = PLAN_PRODUCT_LIMITS.get(plan, 25)
    if limit != -1:
        count = db.query(Product).filter(Product.shop_id == shop_id).count()
        if count >= limit:
            raise HTTPException(status_code=403, detail=f"Product limit reached ({limit} on your plan). Upgrade to add more.")

    conn = await _get_printful_conn_or_400(shop_id, db)

    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(f"{PRINTFUL_BASE}/store/products/{body.sync_product_id}",
                              headers=_printful_headers(conn))
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Printful API error: {r.status_code} {r.text[:300]}")

    data = r.json().get("result") or {}
    sync_product = data.get("sync_product") or {}
    sync_variants = data.get("sync_variants") or []
    if not sync_variants:
        raise HTTPException(status_code=400, detail="This Printful product has no variants to import.")

    name = (sync_product.get("name") or "Printful Product").strip()

    # Printful's retail_price is in whatever currency that sync variant is
    # set up with (Printful defaults new stores to USD unless configured
    # otherwise) — ExiusCart's Product.price is implicitly in the shop's
    # base_currency (see Shop.currency's own comment). Without converting,
    # a $80 Printful price was landing as a raw "80" under a EUR shop —
    # not €80-worth, literally the number 80 relabeled, a real pricing bug.
    # A seller-typed selling_price is exempt — that's already being entered
    # directly in the shop's own currency, nothing to convert.
    from app.core.currency import convert_amount
    target_currency = shop.base_currency or shop.currency or "USD"

    primary = sync_variants[0]
    if body.selling_price:
        price = body.selling_price
    else:
        pf_currency = primary.get("currency") or "USD"
        raw_price = float(primary.get("retail_price") or 0)
        price = await convert_amount(raw_price, pf_currency, target_currency) if raw_price else None
    if not price:
        raise HTTPException(status_code=400, detail="Couldn't determine a price — set one manually.")

    product = Product(
        shop_id=shop_id,
        name=name,
        description=name,
        price=price,
        cost_price=None,  # Printful's cost isn't exposed on this endpoint — seller sets margin manually
        sku=f"PF-{body.sync_product_id}",
        # Print-on-demand — nothing to hold in stock, Printful prints per
        # order, so this is never "out of stock" the way a real-inventory
        # product would be.
        quantity=999999,
        low_stock_threshold=0,
        slug=generate_slug(name),
    )
    db.add(product)
    db.flush()

    # Images — sync_product's own thumbnail first, then each variant's
    # mockup preview file (the "preview" file type is the rendered mockup;
    # "default" is the raw print file, not something a buyer should see).
    seen_urls = set()
    images = []
    if sync_product.get("thumbnail_url"):
        images.append(sync_product["thumbnail_url"])
        seen_urls.add(sync_product["thumbnail_url"])
    for v in sync_variants:
        for f in (v.get("files") or []):
            url = f.get("preview_url") or (f.get("url") if f.get("type") == "preview" else None)
            if url and url not in seen_urls:
                images.append(url)
                seen_urls.add(url)
    async with httpx.AsyncClient() as rehost_client:
        rehosted = {
            url: await _rehost_printful_image(rehost_client, url, shop_id, product.id)
            for url in images[:10]
        }
        for i, url in enumerate(images[:10]):
            db.add(ProductImage(product_id=product.id, url=rehosted[url], sort_order=i, is_primary=(i == 0)))

        # Variants — Printful names a sync variant like "Product Name - Black / M"
        # (color / size after the last " - "); best-effort split so the storefront
        # shows real size/color pickers instead of one flat SKU. Falls back to
        # putting the whole variant name in `size` if the format doesn't match.
        for v in sync_variants:
            vname = (v.get("name") or "").split(" - ")[-1]
            color, _, size = vname.partition(" / ")
            if not size:
                color, size = None, (vname or None)
            variant_image = next((f.get("preview_url") for f in (v.get("files") or []) if f.get("preview_url")), None)
            if variant_image:
                variant_image = rehosted.get(variant_image) or await _rehost_printful_image(rehost_client, variant_image, shop_id, product.id)
            # Same currency conversion as the primary price above — only
            # meaningfully different from the main product price when a
            # variant is genuinely priced differently on Printful (e.g. a
            # larger size costing more), but every variant still needs its
            # raw Printful-currency number converted regardless.
            variant_price = None
            if v.get("retail_price"):
                variant_price = await convert_amount(float(v["retail_price"]), v.get("currency") or "USD", target_currency)
            db.add(ProductVariant(
                product_id=product.id,
                size=(size or None),
                color=(color or None),
                sku=str(v.get("id")),
                quantity=999999,
                price=variant_price,
                image_url=variant_image,
            ))

    db.add(DropshipProductLink(
        shop_id=shop_id,
        product_id=product.id,
        supplier_type="printful",
        supplier_product_id=str(body.sync_product_id),
        supplier_sku=str(primary.get("id")),  # primary sync_variant_id — see fulfill_order's printful branch
        supplier_product_name=name,
        is_primary=True,
    ))

    db.commit()
    db.refresh(product)
    logger.info(f"[Printful Import] shop={shop_id} imported product={product.id} sync_product_id={body.sync_product_id} variants={len(sync_variants)}")
    return {"product_id": product.id, "name": product.name, "price": float(product.price)}


# ── Endpoints: Supplier connections ──────────────────────────────────────────

@router.get("/shops/{shop_id}/dropship/connections")
def list_connections(
    shop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    plan = _get_plan(shop_id, db)
    conns = db.query(DropshipConnection).filter(
        DropshipConnection.shop_id == shop_id,
        DropshipConnection.is_active == True,
    ).all()
    connected = {c.supplier_type for c in conns}
    suppliers = [
        {
            "supplier_type": "cj",
            "name": "CJ Dropshipping",
            "description": "Free to use — pay per order only. No monthly fee.",
            "signup_url": SUPPLIER_SIGNUP_LINKS["cj"],
            "plan_required": "starter",
            "connected": "cj" in connected,
            "auto_fulfill_enabled": next((c.auto_fulfill_enabled for c in conns if c.supplier_type == "cj"), False),
            "locked": "cj" not in PLAN_ALLOWED_SUPPLIERS.get(plan, set()),
            "category": "dropship",
        },
        {
            "supplier_type": "zendrop",
            "name": "Zendrop",
            "description": "Requires your own Zendrop account ($49–79/mo paid to Zendrop).",
            "signup_url": SUPPLIER_SIGNUP_LINKS["zendrop"],
            "plan_required": "premium",
            "connected": "zendrop" in connected,
            "auto_fulfill_enabled": next((c.auto_fulfill_enabled for c in conns if c.supplier_type == "zendrop"), False),
            "locked": "zendrop" not in PLAN_ALLOWED_SUPPLIERS.get(plan, set()),
            "category": "dropship",
        },
        {
            "supplier_type": "hypersku",
            "name": "HyperSKU",
            "description": "Free to use — pay per order. Strong in Asia-Pacific & UAE.",
            "signup_url": SUPPLIER_SIGNUP_LINKS["hypersku"],
            "plan_required": "premium",
            "connected": "hypersku" in connected,
            "auto_fulfill_enabled": next((c.auto_fulfill_enabled for c in conns if c.supplier_type == "hypersku"), False),
            "locked": "hypersku" not in PLAN_ALLOWED_SUPPLIERS.get(plan, set()),
            "category": "dropship",
        },
        {
            "supplier_type": "wiio",
            "name": "Wiio",
            "description": "Pay per order. Strong quality control and private label options.",
            "signup_url": SUPPLIER_SIGNUP_LINKS["wiio"],
            "plan_required": "premium",
            "connected": "wiio" in connected,
            "auto_fulfill_enabled": next((c.auto_fulfill_enabled for c in conns if c.supplier_type == "wiio"), False),
            "locked": "wiio" not in PLAN_ALLOWED_SUPPLIERS.get(plan, set()),
            "category": "dropship",
        },
        {
            "supplier_type": "aliexpress",
            "name": "AliExpress",
            "description": "The world's largest supplier catalog. Order placement is pending ExiusCart's AliExpress API approval — connect now, ordering activates once that's live.",
            "signup_url": SUPPLIER_SIGNUP_LINKS["aliexpress"],
            "plan_required": "premium",
            "connected": "aliexpress" in connected,
            "auto_fulfill_enabled": next((c.auto_fulfill_enabled for c in conns if c.supplier_type == "aliexpress"), False),
            "locked": "aliexpress" not in PLAN_ALLOWED_SUPPLIERS.get(plan, set()),
            "category": "dropship",
        },
        {
            "supplier_type": "printful",
            "name": "Printful",
            "description": "Custom hoodies, tees & more — design once, Printful prints and ships automatically. Design/mockup workflow activates soon.",
            "signup_url": SUPPLIER_SIGNUP_LINKS["printful"],
            "plan_required": "premium",
            "connected": "printful" in connected,
            "auto_fulfill_enabled": next((c.auto_fulfill_enabled for c in conns if c.supplier_type == "printful"), False),
            "locked": "printful" not in PLAN_ALLOWED_SUPPLIERS.get(plan, set()),
            "category": "pod",
        },
        {
            "supplier_type": "printify",
            "name": "Printify",
            "description": "Large print-provider network with competitive per-unit pricing. Design/mockup workflow activates soon.",
            "signup_url": SUPPLIER_SIGNUP_LINKS["printify"],
            "plan_required": "premium",
            "connected": "printify" in connected,
            "auto_fulfill_enabled": next((c.auto_fulfill_enabled for c in conns if c.supplier_type == "printify"), False),
            "locked": "printify" not in PLAN_ALLOWED_SUPPLIERS.get(plan, set()),
            "category": "pod",
        },
        {
            "supplier_type": "gelato",
            "name": "Gelato",
            "description": "Local printing in 30+ countries — faster delivery, lower shipping cost. Design/mockup workflow activates soon.",
            "signup_url": SUPPLIER_SIGNUP_LINKS["gelato"],
            "plan_required": "premium",
            "connected": "gelato" in connected,
            "auto_fulfill_enabled": next((c.auto_fulfill_enabled for c in conns if c.supplier_type == "gelato"), False),
            "locked": "gelato" not in PLAN_ALLOWED_SUPPLIERS.get(plan, set()),
            "category": "pod",
        },
    ]
    return {"plan": plan, "suppliers": suppliers}


@router.post("/shops/{shop_id}/dropship/connect/cj")
async def connect_cj(
    shop_id: int,
    data: CJConnectIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    plan = _get_plan(shop_id, db)
    _check_supplier_allowed(plan, "cj", shop_id, db)

    # Get CJ token to verify the API key
    token_data = await _cj_get_token(data.api_key)

    existing = db.query(DropshipConnection).filter(
        DropshipConnection.shop_id == shop_id,
        DropshipConnection.supplier_type == "cj",
    ).first()

    enc_key = encrypt(data.api_key)
    expires = datetime.fromisoformat(token_data["accessTokenExpiryDate"].replace("Z", "+00:00"))

    if existing:
        existing.api_key = enc_key
        existing.access_token = token_data["accessToken"]
        existing.token_expires_at = expires
        existing.is_active = True
    else:
        conn = DropshipConnection(
            shop_id=shop_id,
            supplier_type="cj",
            api_key=enc_key,
            access_token=token_data["accessToken"],
            token_expires_at=expires,
        )
        db.add(conn)
    db.commit()
    return {"connected": True, "supplier_type": "cj", "message": "CJ Dropshipping connected successfully."}


@router.post("/shops/{shop_id}/dropship/connect/printful")
async def connect_printful(
    shop_id: int,
    data: CJConnectIn,  # reuses the same {api_key: str} shape as CJ's connect
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Printful's Private Token is a static Bearer token — no exchange, no
    expiry, unlike CJ's apiKey-for-session-token flow. The one thing worth
    doing on connect is a real validation call so a bad/expired token is
    caught immediately instead of silently saved and failing later.

    Per Printful's official API spec, GET /stores (list) is the only store
    endpoint that exists — it adapts its response automatically based on
    the token's access level (single-store or account-wide), so a single
    call covers both token types without needing a /store (singular)
    fallback. It requires the `stores_list` scope ("View store
    information") on the token — a token created without that scope will
    fail here with a 401/403, and the seller needs to regenerate it with
    that box checked.

    The resolved store id is stored in access_token (reusing the column
    CJ uses for its session token — same slot, different meaning per
    supplier) since every subsequent Printful call for an account-scoped
    token needs to pass it via the X-PF-Store-Id header.
    """
    _shop_or_404(shop_id, current_user, db)
    plan = _get_plan(shop_id, db)
    _check_supplier_allowed(plan, "printful", shop_id, db)

    headers = {"Authorization": f"Bearer {data.api_key}"}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"{PRINTFUL_BASE}/stores", headers=headers)
            stores = r.json().get("result") if r.status_code == 200 else None
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not reach Printful: {exc}")

    if not stores:
        logger.error(f"[PRINTFUL Auth] validation failed — status={r.status_code} response={r.text[:300]}")
        raise HTTPException(status_code=400, detail={
            "error": "printful_auth_failed",
            "message": "Could not connect to Printful. Check your API token has the \"View store information\" (stores_list) scope, and that a store exists on the account.",
        })
    store_info = stores[0]
    store_id = store_info.get("id")
    if not store_id:
        raise HTTPException(status_code=400, detail={
            "error": "printful_no_store",
            "message": "No store found on this Printful account. Create one first: Stores → Connect via API in your Printful dashboard.",
        })

    existing = db.query(DropshipConnection).filter(
        DropshipConnection.shop_id == shop_id,
        DropshipConnection.supplier_type == "printful",
    ).first()
    enc_key = encrypt(data.api_key)
    if existing:
        existing.api_key = enc_key
        existing.access_token = str(store_id)
        existing.is_active = True
    else:
        db.add(DropshipConnection(shop_id=shop_id, supplier_type="printful", api_key=enc_key, access_token=str(store_id)))
    db.commit()
    return {
        "connected": True,
        "supplier_type": "printful",
        "store_name": store_info.get("name"),
        "message": f"Printful connected — store \"{store_info.get('name', 'your store')}\" verified.",
    }


@router.post("/shops/{shop_id}/dropship/connect/apikey")
def connect_apikey(
    shop_id: int,
    data: APIKeyConnectIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    if data.supplier_type not in ("zendrop", "hypersku", "wiio", "aliexpress", "printify", "gelato"):
        raise HTTPException(status_code=400, detail="Use /connect/cj for CJ Dropshipping.")
    plan = _get_plan(shop_id, db)
    _check_supplier_allowed(plan, data.supplier_type, shop_id, db)

    existing = db.query(DropshipConnection).filter(
        DropshipConnection.shop_id == shop_id,
        DropshipConnection.supplier_type == data.supplier_type,
    ).first()
    enc_key = encrypt(data.api_key)
    if existing:
        existing.api_key = enc_key
        existing.is_active = True
    else:
        conn = DropshipConnection(
            shop_id=shop_id,
            supplier_type=data.supplier_type,
            api_key=enc_key,
        )
        db.add(conn)
    db.commit()
    return {"connected": True, "supplier_type": data.supplier_type, "message": f"{data.supplier_type.title()} connected successfully."}


@router.delete("/shops/{shop_id}/dropship/connect/{supplier_type}")
def disconnect_supplier(
    shop_id: int,
    supplier_type: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    conn = db.query(DropshipConnection).filter(
        DropshipConnection.shop_id == shop_id,
        DropshipConnection.supplier_type == supplier_type,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Supplier connection not found.")
    conn.is_active = False
    db.commit()
    return {"disconnected": True, "supplier_type": supplier_type}


@router.post("/shops/{shop_id}/dropship/auto-fulfill")
def toggle_auto_fulfill(
    shop_id: int,
    data: AutoFulfillToggleIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    plan = _get_plan(shop_id, db)
    if plan not in ("premium",):
        raise HTTPException(status_code=403, detail={
            "error": "upgrade_required",
            "message": "Auto-fulfill is a Premium feature. Upgrade to enable automatic order forwarding to your supplier.",
        })
    conns = db.query(DropshipConnection).filter(
        DropshipConnection.shop_id == shop_id,
        DropshipConnection.is_active == True,
    ).all()
    if not conns:
        raise HTTPException(status_code=400, detail="Connect at least one supplier first.")
    for conn in conns:
        conn.auto_fulfill_enabled = data.enabled
    db.commit()
    return {"auto_fulfill_enabled": data.enabled}


# ── Endpoints: Product supplier link ─────────────────────────────────────────

@router.get("/shops/{shop_id}/products/{product_id}/dropship-link")
def get_product_link(
    shop_id: int,
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    links = db.query(DropshipProductLink).filter(
        DropshipProductLink.shop_id == shop_id,
        DropshipProductLink.product_id == product_id,
    ).all()
    return {"links": [
        {
            "id": l.id,
            "supplier_type": l.supplier_type,
            "supplier_product_id": l.supplier_product_id,
            "supplier_product_url": l.supplier_product_url,
            "supplier_sku": l.supplier_sku,
            "supplier_product_name": l.supplier_product_name,
            "cost_price": float(l.cost_price) if l.cost_price else None,
            "shipping_estimate_days": l.shipping_estimate_days,
            "warehouse": l.warehouse,
            "is_primary": l.is_primary,
        }
        for l in links
    ]}


@router.post("/shops/{shop_id}/products/{product_id}/dropship-link")
def save_product_link(
    shop_id: int,
    product_id: int,
    data: ProductLinkIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    plan = _get_plan(shop_id, db)
    _check_supplier_allowed(plan, data.supplier_type, shop_id, db)

    existing = db.query(DropshipProductLink).filter(
        DropshipProductLink.shop_id == shop_id,
        DropshipProductLink.product_id == product_id,
        DropshipProductLink.supplier_type == data.supplier_type,
    ).first()

    if existing:
        existing.supplier_product_url = data.supplier_product_url
        existing.supplier_product_id = data.supplier_product_id
        existing.supplier_sku = data.supplier_sku
        existing.cost_price = data.cost_price
        existing.shipping_estimate_days = data.shipping_estimate_days
        existing.warehouse = data.warehouse
        existing.is_primary = data.is_primary
    else:
        link = DropshipProductLink(
            shop_id=shop_id,
            product_id=product_id,
            supplier_type=data.supplier_type,
            supplier_product_url=data.supplier_product_url,
            supplier_product_id=data.supplier_product_id,
            supplier_sku=data.supplier_sku,
            cost_price=data.cost_price,
            shipping_estimate_days=data.shipping_estimate_days,
            warehouse=data.warehouse,
            is_primary=data.is_primary,
        )
        db.add(link)
    db.commit()
    return {"saved": True}


@router.delete("/shops/{shop_id}/products/{product_id}/dropship-link/{supplier_type}")
def remove_product_link(
    shop_id: int,
    product_id: int,
    supplier_type: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    link = db.query(DropshipProductLink).filter(
        DropshipProductLink.shop_id == shop_id,
        DropshipProductLink.product_id == product_id,
        DropshipProductLink.supplier_type == supplier_type,
    ).first()
    if not link:
        raise HTTPException(status_code=404, detail="Supplier link not found.")
    db.delete(link)
    db.commit()
    return {"removed": True}


# ── Endpoints: Order fulfillment ──────────────────────────────────────────────

@router.post("/shops/{shop_id}/orders/{order_id}/dropship-fulfill")
async def fulfill_order(
    shop_id: int,
    order_id: int,
    data: FulfillOrderIn,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    plan = _get_plan(shop_id, db)
    _check_supplier_allowed(plan, data.supplier_type, shop_id, db)

    order = db.query(Order).filter(Order.id == order_id, Order.shop_id == shop_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")

    existing_ds_order = db.query(DropshipOrder).filter(
        DropshipOrder.order_id == order_id,
        DropshipOrder.supplier_type == data.supplier_type,
        DropshipOrder.status.notin_(["failed"]),
    ).first()
    if existing_ds_order:
        raise HTTPException(status_code=400, detail="This order has already been sent to the supplier.")

    if data.supplier_type == "cj":
        conn = db.query(DropshipConnection).filter(
            DropshipConnection.shop_id == shop_id,
            DropshipConnection.supplier_type == "cj",
            DropshipConnection.is_active == True,
        ).first()
        if not conn:
            raise HTTPException(status_code=400, detail="CJ Dropshipping is not connected. Go to Suppliers to connect.")

        token = await _cj_ensure_token(conn, db)

        # Get product supplier links for items in this order
        from app.models.order import OrderItem
        items = db.query(OrderItem).filter(OrderItem.order_id == order_id).all()
        if not items:
            raise HTTPException(status_code=400, detail="Order has no items.")

        # Build CJ order payload
        cj_products = []
        for item in items:
            link = db.query(DropshipProductLink).filter(
                DropshipProductLink.product_id == item.product_id,
                DropshipProductLink.supplier_type == "cj",
            ).first()
            if not link or not link.supplier_sku:
                raise HTTPException(status_code=400, detail={
                    "error": "no_supplier_link",
                    "message": f"Product '{item.product_name}' does not have a CJ supplier link. Go to the product and add one under the Suppliers tab.",
                })
            cj_products.append({
                "vid": link.supplier_sku,
                "quantity": item.quantity,
            })

        # Parse shipping address from order
        shipping = {}
        if order.shipping_address:
            import json
            try:
                shipping = json.loads(order.shipping_address)
            except Exception:
                shipping = {"address": order.shipping_address}

        cj_payload = {
            "orderNameEn": f"ExiusCart-{order.order_number}",
            "shippingZip": shipping.get("zip", ""),
            "shippingCountryCode": shipping.get("country_code", "AE"),
            "shippingCountry": shipping.get("country", "United Arab Emirates"),
            "shippingProvince": shipping.get("province", ""),
            "shippingCity": shipping.get("city", ""),
            "shippingAddress": shipping.get("address", ""),
            "shippingCustomerName": shipping.get("name", order.notes or ""),
            "shippingPhone": shipping.get("phone", ""),
            "remark": f"ExiusCart order {order.order_number}",
            "products": cj_products,
        }

        try:
            async with httpx.AsyncClient(timeout=20) as client:
                r = await client.post(
                    f"{CJ_BASE}/shopping/order/createOrderV2",
                    json=cj_payload,
                    headers={"CJ-Access-Token": token},
                )
            result = r.json()
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"CJ API error: {str(e)}")

        if not result.get("result"):
            ds_order = DropshipOrder(
                shop_id=shop_id,
                order_id=order_id,
                supplier_type="cj",
                status="failed",
                error_message=result.get("message", "Unknown CJ error"),
            )
            db.add(ds_order)
            order.fulfillment_status = "failed"
            db.commit()
            raise HTTPException(status_code=400, detail={
                "error": "cj_order_failed",
                "message": result.get("message", "CJ rejected this order. Check product SKUs and shipping address."),
            })

        cj_order_id = result["data"].get("orderId", "")
        # CJ's create-order response sometimes includes what it actually
        # charged directly — field name unconfirmed from public docs, so try
        # the common variants. If none are present, sync_cj_tracking_job
        # picks it up later once CJ finalizes the order.
        charged = (
            result["data"].get("orderAmount") or result["data"].get("payAmount")
            or result["data"].get("totalAmount")
        )
        ds_order = DropshipOrder(
            shop_id=shop_id,
            order_id=order_id,
            supplier_type="cj",
            supplier_order_id=cj_order_id,
            status="processing",
            cost_paid=float(charged) if charged else None,
        )
        db.add(ds_order)
        order.fulfillment_status = "sent"
        db.commit()
        return {
            "fulfilled": True,
            "supplier_type": "cj",
            "supplier_order_id": cj_order_id,
            "message": "Order sent to CJ Dropshipping. Tracking will appear here once CJ ships it.",
        }

    if data.supplier_type == "printful":
        conn = db.query(DropshipConnection).filter(
            DropshipConnection.shop_id == shop_id,
            DropshipConnection.supplier_type == "printful",
            DropshipConnection.is_active == True,
        ).first()
        if not conn:
            raise HTTPException(status_code=400, detail="Printful is not connected. Go to Suppliers to connect.")

        from app.models.order import OrderItem
        items = db.query(OrderItem).filter(OrderItem.order_id == order_id).all()
        if not items:
            raise HTTPException(status_code=400, detail="Order has no items.")

        pf_items = []
        for item in items:
            link = db.query(DropshipProductLink).filter(
                DropshipProductLink.product_id == item.product_id,
                DropshipProductLink.supplier_type == "printful",
            ).first()
            if not link or not link.supplier_sku:
                raise HTTPException(status_code=400, detail={
                    "error": "no_supplier_link",
                    "message": f"Product '{item.product_name}' does not have a Printful supplier link. Re-import it from Printful, or link it manually under the product's Suppliers tab.",
                })
            # supplier_sku holds the *default* sync_variant_id set at import
            # time — there's no per-order-item variant selection on OrderItem
            # today, so every unit of this line item fulfills as that one
            # variant regardless of which size/color the buyer actually
            # picked at checkout. Same simplification CJ's import makes.
            pf_items.append({
                "sync_variant_id": int(link.supplier_sku),
                "quantity": item.quantity,
            })

        shipping = {}
        if order.shipping_address:
            import json
            try:
                shipping = json.loads(order.shipping_address)
            except Exception:
                shipping = {"address": order.shipping_address}

        recipient = {
            "name": shipping.get("name") or order.notes or "Customer",
            "address1": shipping.get("address", ""),
            "city": shipping.get("city", ""),
            "state_code": shipping.get("province") or shipping.get("state"),
            "country_code": shipping.get("country_code", "US"),
            "zip": shipping.get("zip", ""),
            "phone": shipping.get("phone"),
            "email": shipping.get("email"),
        }

        pf_payload = {
            "external_id": order.order_number,
            "recipient": recipient,
            "items": pf_items,
        }

        try:
            async with httpx.AsyncClient(timeout=20) as client:
                r = await client.post(
                    f"{PRINTFUL_BASE}/orders",
                    params={"confirm": 1},  # submit for fulfillment immediately, not a draft
                    json=pf_payload,
                    headers=_printful_headers(conn),
                )
            result = r.json()
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Printful API error: {str(e)}")

        if r.status_code not in (200, 201) or not result.get("result"):
            error_msg = (result.get("error") or {}).get("message") or result.get("result") or "Unknown Printful error"
            ds_order = DropshipOrder(
                shop_id=shop_id,
                order_id=order_id,
                supplier_type="printful",
                status="failed",
                error_message=str(error_msg)[:2000],
            )
            db.add(ds_order)
            order.fulfillment_status = "failed"
            db.commit()
            raise HTTPException(status_code=400, detail={
                "error": "printful_order_failed",
                # Billing isn't set up is the single most common real cause here
                # per Printful's own docs — confirmed orders fail outright without it.
                "message": f"Printful rejected this order: {error_msg}. If this is your first order, make sure billing is set up on your Printful account.",
            })

        pf_order = result["result"]
        pf_order_id = str(pf_order.get("id", ""))
        costs = pf_order.get("costs") or {}
        ds_order = DropshipOrder(
            shop_id=shop_id,
            order_id=order_id,
            supplier_type="printful",
            supplier_order_id=pf_order_id,
            status="processing",
            cost_paid=float(costs["total"]) if costs.get("total") else None,
        )
        db.add(ds_order)
        order.fulfillment_status = "sent"
        db.commit()
        return {
            "fulfilled": True,
            "supplier_type": "printful",
            "supplier_order_id": pf_order_id,
            "message": "Order sent to Printful. Tracking will appear here once it ships.",
        }

    # Other suppliers (Zendrop, HyperSKU, Wiio) — placeholder for their APIs
    raise HTTPException(status_code=501, detail=f"{data.supplier_type.title()} order forwarding coming soon.")


# ── Endpoints: Supplier orders dashboard ─────────────────────────────────────

@router.get("/shops/{shop_id}/dropship/orders")
def list_dropship_orders(
    shop_id: int,
    status: Optional[str] = None,
    supplier_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    q = db.query(DropshipOrder).filter(DropshipOrder.shop_id == shop_id)
    if status:
        q = q.filter(DropshipOrder.status == status)
    if supplier_type:
        q = q.filter(DropshipOrder.supplier_type == supplier_type)
    orders = q.order_by(DropshipOrder.created_at.desc()).limit(200).all()
    return {"orders": [
        {
            "id": o.id,
            "order_id": o.order_id,
            "supplier_type": o.supplier_type,
            "supplier_order_id": o.supplier_order_id,
            "status": o.status,
            "tracking_number": o.tracking_number,
            "tracking_url": o.tracking_url,
            "carrier": o.carrier,
            "cost_paid": float(o.cost_paid) if o.cost_paid else None,
            "error_message": o.error_message,
            "shipped_at": o.shipped_at.isoformat() if o.shipped_at else None,
            "created_at": o.created_at.isoformat() if o.created_at else None,
        }
        for o in orders
    ]}


# ── Background: CJ tracking sync (called by scheduler in main.py) ────────────

def sync_cj_tracking_job(db_session_factory) -> None:
    """
    Poll CJ for tracking updates on all processing/sent dropship orders.
    Called every 2 hours by the background scheduler in main.py.
    """
    db = db_session_factory()
    try:
        pending = db.query(DropshipOrder).filter(
            DropshipOrder.supplier_type == "cj",
            DropshipOrder.status.in_(["processing", "sent"]),
            DropshipOrder.supplier_order_id.isnot(None),
        ).all()

        if not pending:
            return

        logger.info(f"[CJ Tracking] Checking {len(pending)} pending orders")

        # Cache token per shop so we don't re-auth on every order
        shop_tokens: dict = {}

        for ds_order in pending:
            shop_id = ds_order.shop_id

            # Get/refresh token for this shop
            if shop_id not in shop_tokens:
                conn = db.query(DropshipConnection).filter(
                    DropshipConnection.shop_id == shop_id,
                    DropshipConnection.supplier_type == "cj",
                    DropshipConnection.is_active == True,
                ).first()
                if not conn or not conn.api_key:
                    shop_tokens[shop_id] = None
                    continue

                now = datetime.now(timezone.utc)
                if conn.access_token and conn.token_expires_at and conn.token_expires_at > now:
                    shop_tokens[shop_id] = conn.access_token
                else:
                    try:
                        api_key = decrypt(conn.api_key)
                        with httpx.Client(timeout=15) as client:
                            r = client.post(f"{CJ_BASE}/authentication/getAccessToken", json={
                                "apiKey": api_key,
                            })
                        data = r.json()
                        if not data.get("result"):
                            shop_tokens[shop_id] = None
                            continue
                        token = data["data"]["accessToken"]
                        conn.access_token = token
                        conn.token_expires_at = datetime.fromisoformat(
                            data["data"]["accessTokenExpiryDate"].replace("Z", "+00:00")
                        )
                        db.commit()
                        shop_tokens[shop_id] = token
                    except Exception as e:
                        logger.error(f"[CJ Tracking] Token refresh failed shop={shop_id}: {e}")
                        shop_tokens[shop_id] = None
                        continue

            token = shop_tokens.get(shop_id)
            if not token:
                continue

            try:
                with httpx.Client(timeout=15) as client:
                    # NOTE: exact request param name unconfirmed from public docs (orderNum vs
                    # orderId) — sending both is harmless since CJ ignores unrecognized params.
                    r = client.get(
                        f"{CJ_BASE}/logistic/trackInfo",
                        params={"orderNum": ds_order.supplier_order_id, "orderId": ds_order.supplier_order_id},
                        headers={"CJ-Access-Token": token},
                    )
                data = r.json()

                if not data.get("result") or not data.get("data"):
                    continue

                track = data["data"]

                # CJ uses different field names across API versions — handle both
                tracking_number = (
                    track.get("trackNumber") or track.get("trackingNumber")
                    or track.get("trackNum") or track.get("logisticTrackingNumber")
                )
                carrier = (
                    track.get("carrierCode") or track.get("carrier")
                    or track.get("logisticsName") or track.get("shippingName")
                )
                tracking_url = track.get("trackUrl") or track.get("trackingUrl")
                cj_status = (track.get("orderStatus") or track.get("status") or "").lower()

                # Backfill cost_paid if it wasn't available at order-creation
                # time — same unconfirmed-field-name situation as above.
                if ds_order.cost_paid is None:
                    charged = (
                        track.get("orderAmount") or track.get("payAmount")
                        or track.get("totalAmount") or track.get("productAmount")
                    )
                    if charged:
                        try:
                            ds_order.cost_paid = float(charged)
                        except (TypeError, ValueError):
                            pass

                if tracking_number:
                    ds_order.tracking_number = tracking_number
                if carrier:
                    ds_order.carrier = carrier
                if tracking_url:
                    ds_order.tracking_url = tracking_url

                # Map CJ status → our status
                if cj_status in ("delivered", "complete", "completed", "finish"):
                    ds_order.status = "delivered"
                    if not ds_order.delivered_at:
                        ds_order.delivered_at = datetime.now(timezone.utc)
                elif tracking_number and ds_order.status in ("processing", "sent"):
                    ds_order.status = "shipped"
                    if not ds_order.shipped_at:
                        ds_order.shipped_at = datetime.now(timezone.utc)

                # Mirror tracking onto the main order row so sellers see it immediately
                if tracking_number:
                    from app.models.order import Order as ShopOrder
                    order = db.query(ShopOrder).filter(ShopOrder.id == ds_order.order_id).first()
                    if order and not order.tracking_number:
                        order.tracking_number = tracking_number
                        order.carrier = carrier or order.carrier

                db.commit()
                logger.info(
                    f"[CJ Tracking] order={ds_order.order_id} "
                    f"tracking={tracking_number} status={ds_order.status}"
                )

            except Exception as e:
                logger.error(f"[CJ Tracking] Failed ds_order={ds_order.id}: {e}")
                continue

    except Exception as e:
        logger.error(f"[CJ Tracking] Job error: {e}")
    finally:
        db.close()


# ── Background: Printful tracking sync (called by scheduler in main.py) ──────

def sync_printful_tracking_job(db_session_factory) -> None:
    """
    Poll Printful for status/tracking updates on all processing/sent
    dropship orders. Called every 2 hours by the background scheduler in
    main.py, same cadence as sync_cj_tracking_job.

    Printful's own order.status values: draft, pending, failed, canceled,
    onhold, inprocess, partial, fulfilled. onhold generally means a billing
    or address problem needing the seller's attention on Printful's side —
    surfaced here as our "failed" status with a message rather than left
    silently stuck as "processing".
    """
    db = db_session_factory()
    try:
        pending = db.query(DropshipOrder).filter(
            DropshipOrder.supplier_type == "printful",
            DropshipOrder.status.in_(["processing", "sent"]),
            DropshipOrder.supplier_order_id.isnot(None),
        ).all()

        if not pending:
            return

        logger.info(f"[Printful Tracking] Checking {len(pending)} pending orders")

        conn_by_shop: dict = {}

        for ds_order in pending:
            shop_id = ds_order.shop_id

            if shop_id not in conn_by_shop:
                conn_by_shop[shop_id] = db.query(DropshipConnection).filter(
                    DropshipConnection.shop_id == shop_id,
                    DropshipConnection.supplier_type == "printful",
                    DropshipConnection.is_active == True,
                ).first()

            conn = conn_by_shop.get(shop_id)
            if not conn:
                continue

            try:
                with httpx.Client(timeout=15) as client:
                    r = client.get(f"{PRINTFUL_BASE}/orders/{ds_order.supplier_order_id}", headers=_printful_headers(conn))
                data = r.json()
                if r.status_code != 200 or not data.get("result"):
                    continue

                pf_order = data["result"]
                pf_status = (pf_order.get("status") or "").lower()
                shipments = pf_order.get("shipments") or []
                latest_shipment = shipments[-1] if shipments else {}
                tracking_number = latest_shipment.get("tracking_number")
                tracking_url = latest_shipment.get("tracking_url")
                carrier = latest_shipment.get("carrier")

                if ds_order.cost_paid is None:
                    costs = pf_order.get("costs") or {}
                    if costs.get("total"):
                        try:
                            ds_order.cost_paid = float(costs["total"])
                        except (TypeError, ValueError):
                            pass

                if tracking_number:
                    ds_order.tracking_number = tracking_number
                if carrier:
                    ds_order.carrier = carrier
                if tracking_url:
                    ds_order.tracking_url = tracking_url

                if pf_status == "fulfilled":
                    ds_order.status = "delivered"
                    if not ds_order.delivered_at:
                        ds_order.delivered_at = datetime.now(timezone.utc)
                elif pf_status in ("failed", "canceled", "onhold"):
                    ds_order.status = "failed"
                    ds_order.error_message = f"Printful order is '{pf_status}' — check this order on your Printful dashboard."
                elif tracking_number and ds_order.status in ("processing", "sent"):
                    ds_order.status = "shipped"
                    if not ds_order.shipped_at:
                        ds_order.shipped_at = datetime.now(timezone.utc)

                if tracking_number:
                    from app.models.order import Order as ShopOrder
                    order = db.query(ShopOrder).filter(ShopOrder.id == ds_order.order_id).first()
                    if order and not order.tracking_number:
                        order.tracking_number = tracking_number
                        order.carrier = carrier or order.carrier

                db.commit()
                logger.info(f"[Printful Tracking] order={ds_order.order_id} tracking={tracking_number} status={ds_order.status}")

            except Exception as e:
                logger.error(f"[Printful Tracking] Failed ds_order={ds_order.id}: {e}")
                continue

    except Exception as e:
        logger.error(f"[Printful Tracking] Job error: {e}")
    finally:
        db.close()
