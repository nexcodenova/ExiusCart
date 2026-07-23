"""
Dropshipping integration — CJ Dropshipping, Zendrop, HyperSKU, Wiio.

Plan limits:
  starter    → CJ only (1 supplier)
  premium    → all suppliers
  free_trial → no dropshipping
  thedersi_* → no dropshipping (fulfilled by TheDersi)
"""

import base64
import logging
import httpx
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.thedersi import is_thedersi_shop
from app.models.user import User
from app.models.order import Order
from app.models.subscription import Subscription
from app.models.dropship import DropshipConnection, DropshipProductLink, DropshipOrder
from app.api.v1.deps import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

# ── Supplier signup links (affiliate — update these when you have the links) ──
SUPPLIER_SIGNUP_LINKS = {
    "cj":       "https://www.cjdropshipping.com/register.html?token=bce7840c-d60b-46e7-b39c-872e1572796c",  # CJ affiliate — 2% of referred sellers' CJ revenue for 1yr
    "zendrop":  "https://app.zendrop.com/signup",                 # replace with affiliate link
    "hypersku": "https://www.hypersku.com/register",              # replace with affiliate link
    "wiio":     "https://wiio.com/register",                      # replace with affiliate link
}

CJ_BASE = "https://developers.cjdropshipping.com/api2.0/v1"

PLAN_ALLOWED_SUPPLIERS = {
    "premium":       {"cj", "zendrop", "hypersku", "wiio"},
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


# ── CJ token management ───────────────────────────────────────────────────────

async def _cj_get_token(email: str, password: str) -> dict:
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(f"{CJ_BASE}/authentication/getAccessToken", json={
            "email": email,
            "password": password,
        })
    data = r.json()
    if not data.get("result"):
        raise HTTPException(status_code=400, detail={
            "error": "cj_auth_failed",
            "message": "Could not connect to CJ Dropshipping. Check your email and password.",
        })
    return data["data"]  # { accessToken, refreshToken, expiryDate }


async def _cj_ensure_token(conn: DropshipConnection, db: Session) -> str:
    """Return a valid CJ access token, refreshing if needed."""
    now = datetime.now(timezone.utc)
    if conn.access_token and conn.token_expires_at and conn.token_expires_at > now:
        return conn.access_token

    # Re-auth using stored credentials
    if not conn.supplier_email or not conn.supplier_password_enc:
        raise HTTPException(status_code=400, detail={
            "error": "cj_reconnect_required",
            "message": "CJ session expired. Please reconnect your CJ account.",
        })
    password = base64.b64decode(conn.supplier_password_enc).decode()
    token_data = await _cj_get_token(conn.supplier_email, password)
    conn.access_token = token_data["accessToken"]
    conn.token_expires_at = datetime.fromisoformat(token_data["expiryDate"].replace("Z", "+00:00"))
    db.commit()
    return conn.access_token


# ── Schemas ───────────────────────────────────────────────────────────────────

class CJConnectIn(BaseModel):
    email: str
    password: str

class CJImportIn(BaseModel):
    cj_pid: str
    selling_price: Optional[float] = None   # seller sets markup; defaults to 2× cost

class APIKeyConnectIn(BaseModel):
    supplier_type: str   # zendrop / hypersku / wiio
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
            "cost_price": float(p.get("sellPrice") or p.get("minSellPrice") or 0),
            "category": p.get("categoryName", ""),
        }
        for p in cj_list
    ]
    return {"products": products, "total": data.get("data", {}).get("total", 0), "page": page}


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
            "cost_price": float(p.get("sellPrice") or p.get("suggestSellPrice") or 0),
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

    _shop_or_404(shop_id, current_user, db)
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

    cost = float(p.get("sellPrice") or p.get("suggestSellPrice") or primary_variant.get("variantSellPrice") or 0)
    price = body.selling_price if body.selling_price else round(cost * 2, 2)

    # Create product
    product = Product(
        shop_id=shop_id,
        name=name,
        description=p.get("description") or name,
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

    # Get CJ token to verify credentials
    token_data = await _cj_get_token(data.email, data.password)

    existing = db.query(DropshipConnection).filter(
        DropshipConnection.shop_id == shop_id,
        DropshipConnection.supplier_type == "cj",
    ).first()

    enc_password = base64.b64encode(data.password.encode()).decode()
    expires = datetime.fromisoformat(token_data["expiryDate"].replace("Z", "+00:00"))

    if existing:
        existing.supplier_email = data.email
        existing.supplier_password_enc = enc_password
        existing.access_token = token_data["accessToken"]
        existing.token_expires_at = expires
        existing.is_active = True
    else:
        conn = DropshipConnection(
            shop_id=shop_id,
            supplier_type="cj",
            supplier_email=data.email,
            supplier_password_enc=enc_password,
            access_token=token_data["accessToken"],
            token_expires_at=expires,
        )
        db.add(conn)
    db.commit()
    return {"connected": True, "supplier_type": "cj", "message": "CJ Dropshipping connected successfully."}


@router.post("/shops/{shop_id}/dropship/connect/apikey")
def connect_apikey(
    shop_id: int,
    data: APIKeyConnectIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    if data.supplier_type not in ("zendrop", "hypersku", "wiio"):
        raise HTTPException(status_code=400, detail="Use /connect/cj for CJ Dropshipping.")
    plan = _get_plan(shop_id, db)
    _check_supplier_allowed(plan, data.supplier_type, shop_id, db)

    existing = db.query(DropshipConnection).filter(
        DropshipConnection.shop_id == shop_id,
        DropshipConnection.supplier_type == data.supplier_type,
    ).first()
    if existing:
        existing.api_key = data.api_key
        existing.is_active = True
    else:
        conn = DropshipConnection(
            shop_id=shop_id,
            supplier_type=data.supplier_type,
            api_key=data.api_key,
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
                if not conn or not conn.supplier_email or not conn.supplier_password_enc:
                    shop_tokens[shop_id] = None
                    continue

                now = datetime.now(timezone.utc)
                if conn.access_token and conn.token_expires_at and conn.token_expires_at > now:
                    shop_tokens[shop_id] = conn.access_token
                else:
                    try:
                        password = base64.b64decode(conn.supplier_password_enc).decode()
                        with httpx.Client(timeout=15) as client:
                            r = client.post(f"{CJ_BASE}/authentication/getAccessToken", json={
                                "email": conn.supplier_email,
                                "password": password,
                            })
                        data = r.json()
                        if not data.get("result"):
                            shop_tokens[shop_id] = None
                            continue
                        token = data["data"]["accessToken"]
                        conn.access_token = token
                        conn.token_expires_at = datetime.fromisoformat(
                            data["data"]["expiryDate"].replace("Z", "+00:00")
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
