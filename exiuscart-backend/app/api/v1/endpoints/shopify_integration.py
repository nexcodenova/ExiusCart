"""Shopify Integration endpoints — Connect, Sync Products/Orders/Inventory."""
from datetime import datetime, timezone
import uuid
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.models.shop import Shop
from app.models.product import Product
from app.models.order import Order, OrderItem
from app.models.customer import Customer
from app.models.shopify_integration import ShopifyStore, ShopifySyncLog
from app.models.subscription import Subscription
from app.api.v1.deps import get_current_user
from app.core.thedersi import is_thedersi_restricted_shop
from app.core.channel_limits import check_channel_slot
import os
import json
from app.core.channel_orders import match_sku, address_json, join_name, should_auto_fulfill, queue_auto_fulfill, parse_time, take_paid_stock


def _shopify_order_number() -> str:
    ts = datetime.now().strftime("%Y%m%d%H%M")
    return f"SHP-{ts}-{uuid.uuid4().hex[:4].upper()}"

router = APIRouter()

SHOPIFY_API_VERSION = "2024-01"
SHOPIFY_CLIENT_ID = os.getenv("SHOPIFY_CLIENT_ID", "")
SHOPIFY_CLIENT_SECRET = os.getenv("SHOPIFY_CLIENT_SECRET", "")
SHOPIFY_SCOPES = "read_products,write_products,read_orders,write_orders,read_inventory,write_inventory,read_customers"


def _shop(shop_id: int, user: User, db: Session) -> Shop:
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


def _shopify_headers(access_token: str) -> dict:
    return {"X-Shopify-Access-Token": access_token, "Content-Type": "application/json"}


def _shopify_url(domain: str, path: str) -> str:
    return f"https://{domain}/admin/api/{SHOPIFY_API_VERSION}/{path}"


# ── Connection & OAuth ─────────────────────────────────────────────────────────

@router.get("/shops/{shop_id}/shopify/status")
def get_shopify_status(shop_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    store = db.query(ShopifyStore).filter(ShopifyStore.shop_id == shop_id).first()
    if not store:
        return {"connected": False, "store": None}
    logs = db.query(ShopifySyncLog).filter(ShopifySyncLog.shopify_store_id == store.id).order_by(ShopifySyncLog.started_at.desc()).limit(10).all()
    return {
        "connected": store.is_connected,
        "store": {
            "id": store.id,
            "shopify_domain": store.shopify_domain,
            "shop_name": store.shop_name,
            "shop_email": store.shop_email,
            "plan_name": store.plan_name,
            "currency": store.currency,
            "sync_products": store.sync_products,
            "sync_orders": store.sync_orders,
            "sync_inventory": store.sync_inventory,
            "last_product_sync": store.last_product_sync.isoformat() if store.last_product_sync else None,
            "last_order_sync": store.last_order_sync.isoformat() if store.last_order_sync else None,
            "products_synced": store.products_synced,
            "orders_synced": store.orders_synced,
        },
        "recent_logs": [
            {
                "id": l.id, "sync_type": l.sync_type, "direction": l.direction,
                "status": l.status, "records_processed": l.records_processed,
                "records_failed": l.records_failed,
                "started_at": l.started_at.isoformat(),
                "completed_at": l.completed_at.isoformat() if l.completed_at else None,
            } for l in logs
        ],
    }


@router.post("/shops/{shop_id}/shopify/connect")
async def connect_shopify(shop_id: int, body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Connect a Shopify store using private app credentials (access token + domain)."""
    _shop(shop_id, current_user, db)

    # Same restriction connect_channel enforces for every other channel
    # (channels.py) — Shopify has its own separate connect system (no
    # ChannelConnection row) and was never wired into that check, so a
    # TheDersi-managed shop could connect Shopify with nothing stopping it
    # server-side. Closing that here, not just in the UI.
    if is_thedersi_restricted_shop(shop_id, db):
        raise HTTPException(
            status_code=403,
            detail={
                "error": "channel_not_available",
                "message": "Your plan is managed by TheDersi. Only TheDersi and Daraz channels are available on TheDersi plans.",
            },
        )

    domain = body.get("shopify_domain", "").strip().lower()
    access_token = body.get("access_token", "").strip()
    if not domain or not access_token:
        raise HTTPException(status_code=400, detail="shopify_domain and access_token are required")

    # Normalize domain
    if not domain.endswith(".myshopify.com"):
        domain = f"{domain}.myshopify.com"

    # Verify credentials by fetching shop info
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                _shopify_url(domain, "shop.json"),
                headers=_shopify_headers(access_token)
            )
        if resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Invalid Shopify credentials. Check your domain and access token.")
        shop_data = resp.json().get("shop", {})
    except httpx.RequestError:
        raise HTTPException(status_code=400, detail="Could not reach Shopify. Check the domain.")

    # Upsert store record
    store = db.query(ShopifyStore).filter(ShopifyStore.shop_id == shop_id).first()
    if not store or not store.is_connected:
        # Only check when this would actually consume a new slot (a fresh
        # connection, or reactivating a previously disconnected one) — not
        # on every credentials update to an already-connected store. Shopify
        # is a "store" channel like WooCommerce/BigCommerce/Custom Website —
        # subject to Launch's 1-per-category cap and the plan's total, same
        # as every other channel now (see app/core/channel_limits.py).
        sub = db.query(Subscription).filter(Subscription.shop_id == shop_id).order_by(Subscription.id.desc()).first()
        plan_type = sub.plan_type if sub else "free_trial"
        check_channel_slot(shop_id, db, "shopify", plan_type)
    if not store:
        store = ShopifyStore(shop_id=shop_id)
        db.add(store)

    store.shopify_domain = domain
    store.access_token = access_token
    store.is_connected = True
    store.shop_name = shop_data.get("name")
    store.shop_email = shop_data.get("email")
    store.plan_name = shop_data.get("plan_name")
    store.currency = shop_data.get("currency")
    db.commit()
    db.refresh(store)
    return {"success": True, "shop_name": store.shop_name, "domain": domain}


@router.post("/shops/{shop_id}/shopify/disconnect")
def disconnect_shopify(shop_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    store = db.query(ShopifyStore).filter(ShopifyStore.shop_id == shop_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="No Shopify store connected")
    store.is_connected = False
    store.access_token = None
    db.commit()
    return {"success": True}


@router.put("/shops/{shop_id}/shopify/settings")
def update_sync_settings(shop_id: int, body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    store = db.query(ShopifyStore).filter(ShopifyStore.shop_id == shop_id, ShopifyStore.is_connected == True).first()
    if not store:
        raise HTTPException(status_code=404, detail="No connected Shopify store")
    for f in ("sync_products", "sync_orders", "sync_inventory"):
        if f in body:
            setattr(store, f, body[f])
    db.commit()
    return {"success": True}


# ── Product Sync: ExiusCart → Shopify ─────────────────────────────────────────

async def _push_products(store: ShopifyStore, db: Session, shop_id: int):
    """
    UNVERIFIED against a live Shopify store — until now, this crashed on
    every single product (Product has no `selling_price`/`stock` fields,
    those are `price`/`quantity`; and `category` is a relationship object,
    not a string, which json can't serialize), silently reported as
    "failed" via the bare except below rather than raising visibly. Fixed
    field names + added images + real currency conversion, but nobody has
    actually confirmed a product lands correctly on Shopify's side yet.
    """
    log = ShopifySyncLog(
        shopify_store_id=store.id, sync_type="products",
        direction="push", status="running", records_processed=0, records_failed=0
    )
    db.add(log); db.commit(); db.refresh(log)

    shop = db.query(Shop).filter(Shop.id == shop_id).first()
    source_currency = (shop.base_currency or shop.currency) if shop else "USD"
    # ShopifyStore.currency is fetched directly from Shopify's own API at
    # connect time (see the OAuth callback below) — the one channel here
    # that doesn't need a seller to state it manually.
    target_currency = store.currency or source_currency
    from app.core.currency import convert_amount_sync
    from app.models.channel_sync_log import ChannelSyncLog

    products = db.query(Product).filter(Product.shop_id == shop_id, Product.is_active == True).all()
    processed = 0; failed = 0
    async with httpx.AsyncClient(timeout=30) as client:
        for p in products:
            price = convert_amount_sync(float(p.price), source_currency, target_currency)
            images = [{"src": img.url} for img in (p.images or []) if img.url] or ([{"src": p.image_url}] if p.image_url else [])
            payload = {
                "product": {
                    "title": p.name,
                    "body_html": p.description or "",
                    "vendor": "ExiusCart",
                    "product_type": p.category.name if p.category else "",
                    "images": images,
                    "variants": [{
                        "price": f"{price:.2f}",
                        "sku": p.sku or "",
                        "inventory_quantity": p.quantity or 0,
                        "inventory_management": "shopify",
                    }],
                }
            }
            _ok = False
            _err = None
            try:
                resp = await client.post(
                    _shopify_url(store.shopify_domain, "products.json"),
                    headers=_shopify_headers(store.access_token),
                    json=payload
                )
                if resp.status_code in (200, 201):
                    processed += 1
                    _ok = True
                else:
                    failed += 1
                    _err = f"Shopify returned {resp.status_code}: {resp.text[:300]}"
            except Exception as _e:
                failed += 1
                _err = str(_e)[:300]
            # Per-product record for the Channel Listings page. Shopify's own
            # ShopifySyncLog only stores a batch total, so without this
            # Shopify would be the one connected channel with no per-product
            # listing history there.
            db.add(ChannelSyncLog(
                shop_id=shop_id, product_id=p.id, channel_type="shopify",
                action="listing", success=_ok, error_message=_err,
            ))

    db.commit()
    store.products_synced = processed
    store.last_product_sync = datetime.now(timezone.utc)
    log.status = "success" if failed == 0 else "partial"
    log.records_processed = processed
    log.records_failed = failed
    log.completed_at = datetime.now(timezone.utc)
    db.commit()


@router.post("/shops/{shop_id}/shopify/sync/products")
async def sync_products_to_shopify(
    shop_id: int, background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    _shop(shop_id, current_user, db)
    store = db.query(ShopifyStore).filter(ShopifyStore.shop_id == shop_id, ShopifyStore.is_connected == True).first()
    if not store:
        raise HTTPException(status_code=404, detail="No connected Shopify store")
    background_tasks.add_task(_push_products, store, db, shop_id)
    return {"message": "Product sync started in background"}


# ── Order Sync: Shopify → ExiusCart ───────────────────────────────────────────

def _shopify_hmac_ok(raw: bytes, header: str) -> bool:
    """Shopify signs each webhook: base64(HMAC-SHA256(app secret, raw body))."""
    if not SHOPIFY_CLIENT_SECRET or not header:
        return False
    import base64, hashlib, hmac as _hmac
    digest = base64.b64encode(_hmac.new(SHOPIFY_CLIENT_SECRET.encode(), raw, hashlib.sha256).digest()).decode()
    return _hmac.compare_digest(digest, header)


def _shopify_address(so: dict):
    a = so.get("shipping_address") or {}
    return address_json(
        name=a.get("name") or join_name(a.get("first_name"), a.get("last_name")),
        address1=a.get("address1"), address2=a.get("address2"), city=a.get("city"),
        province=a.get("province_code") or a.get("province"), zip=a.get("zip"),
        country_code=a.get("country_code"), country=a.get("country"),
        phone=a.get("phone") or so.get("phone"), email=so.get("email"),
    )


def _shopify_items(db, shop_id: int, order_id: int, so: dict) -> None:
    """Line items tied to the seller's real product (and variant) by SKU, so stock,
    reports and auto-fulfilment know what was sold. Unmatched lines keep their title."""
    for item in so.get("line_items", []):
        qty = item.get("quantity", 1)
        price = float(item.get("price", 0))
        product, variant = match_sku(db, shop_id, item.get("sku"))
        db.add(OrderItem(
            order_id=order_id,
            product_id=product.id if product else None,
            variant_id=variant.id if variant else None,
            product_name=item.get("title", ""),
            quantity=qty,
            unit_price=price,
            total_price=price * qty,
        ))


def _shopify_queue_if_ready(db, shop_id: int, order, so: dict) -> bool:
    """Paid, not yet fulfilled on Shopify, placed after auto-fulfil was switched on."""
    return (order.payment_status == "paid" and not so.get("fulfillment_status")
            and should_auto_fulfill(db, shop_id, parse_time(so.get("created_at"))))


async def _pull_orders(store: ShopifyStore, db: Session, shop_id: int):
    log = ShopifySyncLog(
        shopify_store_id=store.id, sync_type="orders",
        direction="pull", status="running", records_processed=0, records_failed=0
    )
    db.add(log); db.commit(); db.refresh(log)
    processed = 0; failed = 0
    to_fulfil = []
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                _shopify_url(store.shopify_domain, "orders.json?status=any&limit=250"),
                headers=_shopify_headers(store.access_token)
            )
        if resp.status_code != 200:
            log.status = "failed"; log.error_details = resp.text
            log.completed_at = datetime.now(timezone.utc); db.commit(); return

        for so in resp.json().get("orders", []):
            try:
                # Upsert customer
                email = so.get("email") or ""
                customer = None
                if email:
                    customer = db.query(Customer).filter(Customer.email == email, Customer.shop_id == shop_id).first()
                if not customer:
                    caddr = so.get("shipping_address") or so.get("billing_address") or {}
                    customer = Customer(
                        shop_id=shop_id,
                        name=f"{so.get('customer', {}).get('first_name', '')} {so.get('customer', {}).get('last_name', '')}".strip() or "Shopify Customer",
                        email=email or None,
                        phone=so.get("phone") or None,
                        address=caddr.get("address1") or None,
                        source="shopify",
                    )
                    db.add(customer); db.flush()

                # Create order if not already imported
                ref = f"SHOPIFY-{so['id']}"
                existing = db.query(Order).filter(Order.reference == ref, Order.shop_id == shop_id).first()
                if existing:
                    # Paid on Shopify since we first saw it (e.g. a manual/bank payment captured later)
                    if so.get("financial_status") == "paid" and existing.payment_status != "paid":
                        existing.payment_status = "paid"
                        take_paid_stock(db, existing.id)
                        if _shopify_queue_if_ready(db, shop_id, existing, so):
                            to_fulfil.append(existing.id)
                    continue

                total = float(so.get("total_price", 0))
                order = Order(
                    shop_id=shop_id,
                    order_number=_shopify_order_number(),
                    reference=ref,
                    customer_id=customer.id if customer else None,
                    source="shopify",
                    status="pending" if so.get("financial_status") in ("pending", "unpaid") else so.get("financial_status", "pending"),
                    payment_status="paid" if so.get("financial_status") == "paid" else "pending",
                    subtotal=total,
                    total=total,
                    shipping_address=_shopify_address(so),
                    notes=f"Imported from Shopify #{so.get('order_number')}",
                )
                db.add(order); db.flush()
                _shopify_items(db, shop_id, order.id, so)
                db.flush()
                if order.payment_status == "paid":
                    take_paid_stock(db, order.id)
                if _shopify_queue_if_ready(db, shop_id, order, so):
                    to_fulfil.append(order.id)
                processed += 1
            except Exception:
                failed += 1

        db.commit()
        queue_auto_fulfill(shop_id, to_fulfil)
    except Exception as e:
        log.status = "failed"; log.error_details = str(e)
        log.completed_at = datetime.now(timezone.utc); db.commit(); return

    store.orders_synced = processed
    store.last_order_sync = datetime.now(timezone.utc)
    log.status = "success" if failed == 0 else "partial"
    log.records_processed = processed
    log.records_failed = failed
    log.completed_at = datetime.now(timezone.utc)
    db.commit()


@router.post("/shops/{shop_id}/shopify/sync/orders")
async def sync_orders_from_shopify(
    shop_id: int, background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    _shop(shop_id, current_user, db)
    store = db.query(ShopifyStore).filter(ShopifyStore.shop_id == shop_id, ShopifyStore.is_connected == True).first()
    if not store:
        raise HTTPException(status_code=404, detail="No connected Shopify store")
    background_tasks.add_task(_pull_orders, store, db, shop_id)
    return {"message": "Order sync started in background"}


# ── Inventory Sync: ExiusCart → Shopify ───────────────────────────────────────

@router.post("/shops/{shop_id}/shopify/sync/inventory")
async def sync_inventory_to_shopify(
    shop_id: int, background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    _shop(shop_id, current_user, db)
    store = db.query(ShopifyStore).filter(ShopifyStore.shop_id == shop_id, ShopifyStore.is_connected == True).first()
    if not store:
        raise HTTPException(status_code=404, detail="No connected Shopify store")

    async def _push_inventory(store: ShopifyStore, db: Session, shop_id: int):
        log = ShopifySyncLog(shopify_store_id=store.id, sync_type="inventory", direction="push", status="running", records_processed=0, records_failed=0)
        db.add(log); db.commit(); db.refresh(log)
        products = db.query(Product).filter(Product.shop_id == shop_id).all()
        processed = 0; failed = 0
        async with httpx.AsyncClient(timeout=30) as client:
            # Get all Shopify products to match by SKU
            resp = await client.get(_shopify_url(store.shopify_domain, "products.json?limit=250"), headers=_shopify_headers(store.access_token))
            if resp.status_code != 200:
                log.status = "failed"; log.completed_at = datetime.now(timezone.utc); db.commit(); return
            shopify_products = resp.json().get("products", [])
            sku_to_inventory_item = {}
            for sp in shopify_products:
                for v in sp.get("variants", []):
                    if v.get("sku"):
                        sku_to_inventory_item[v["sku"]] = v.get("inventory_item_id")

            # Get location ID
            loc_resp = await client.get(_shopify_url(store.shopify_domain, "locations.json"), headers=_shopify_headers(store.access_token))
            location_id = loc_resp.json().get("locations", [{}])[0].get("id") if loc_resp.status_code == 200 else None

            if not location_id:
                log.status = "failed"; log.error_details = "No Shopify location found"; log.completed_at = datetime.now(timezone.utc); db.commit(); return

            for p in products:
                inv_item_id = sku_to_inventory_item.get(p.sku or "")
                if not inv_item_id:
                    failed += 1; continue
                try:
                    r = await client.post(
                        _shopify_url(store.shopify_domain, "inventory_levels/set.json"),
                        headers=_shopify_headers(store.access_token),
                        json={"location_id": location_id, "inventory_item_id": inv_item_id, "available": p.stock or 0}
                    )
                    if r.status_code in (200, 201): processed += 1
                    else: failed += 1
                except Exception: failed += 1

        log.status = "success" if failed == 0 else "partial"
        log.records_processed = processed; log.records_failed = failed
        log.completed_at = datetime.now(timezone.utc); db.commit()

    background_tasks.add_task(_push_inventory, store, db, shop_id)
    return {"message": "Inventory sync started in background"}


# ── Shopify Webhook Receiver ───────────────────────────────────────────────────

@router.post("/shopify/webhook/{shop_id}")
async def receive_shopify_webhook(shop_id: int, request: Request, db: Session = Depends(get_db)):
    """Receive real-time events from Shopify (orders/create, inventory_levels/update, etc.)"""
    topic = request.headers.get("X-Shopify-Topic", "")
    raw = await request.body()
    body = json.loads(raw or b"{}")
    # Only a request signed by Shopify may send an order to the seller's supplier (which spends their
    # supplier balance). Unsigned ones are still recorded, but auto-fulfilment for them is left to the
    # regular order sync, which reads Shopify with the seller's own token.
    verified = _shopify_hmac_ok(raw, request.headers.get("X-Shopify-Hmac-Sha256", ""))

    store = db.query(ShopifyStore).filter(ShopifyStore.shop_id == shop_id, ShopifyStore.is_connected == True).first()
    if not store:
        return {"ok": False}

    if topic in ("orders/create", "orders/paid", "orders/updated"):
        # Lightweight inline order import
        so = body
        try:
            email = so.get("email") or ""
            customer = None
            if email:
                customer = db.query(Customer).filter(Customer.email == email, Customer.shop_id == shop_id).first()
            if not customer:
                customer = Customer(
                    shop_id=shop_id,
                    name=f"{so.get('customer', {}).get('first_name', '')} {so.get('customer', {}).get('last_name', '')}".strip() or "Shopify Customer",
                    email=email or None,
                    source="shopify",
                )
                db.add(customer); db.flush()
            ref = f"SHOPIFY-{so['id']}"
            existing = db.query(Order).filter(Order.reference == ref, Order.shop_id == shop_id).first()
            if existing and so.get("financial_status") == "paid" and existing.payment_status != "paid":
                # orders/paid or orders/updated for an order we already have
                existing.payment_status = "paid"
                take_paid_stock(db, existing.id)
                db.commit()
                if verified and _shopify_queue_if_ready(db, shop_id, existing, so):
                    queue_auto_fulfill(shop_id, [existing.id])
            if not existing:
                total = float(so.get("total_price", 0))
                order = Order(
                    shop_id=shop_id,
                    order_number=_shopify_order_number(),
                    reference=ref,
                    source="shopify",
                    customer_id=customer.id if customer else None,
                    status="pending",
                    payment_status="paid" if so.get("financial_status") == "paid" else "pending",
                    subtotal=total,
                    total=total,
                    shipping_address=_shopify_address(so),
                    notes=f"Shopify #{so.get('order_number')}",
                )
                db.add(order); db.flush()
                _shopify_items(db, shop_id, order.id, so)
                db.flush()
                if order.payment_status == "paid":
                    take_paid_stock(db, order.id)
                db.commit()
                if verified and _shopify_queue_if_ready(db, shop_id, order, so):
                    queue_auto_fulfill(shop_id, [order.id])
        except Exception:
            pass

    return {"ok": True}
