"""Shopify Integration endpoints — Connect, Sync Products/Orders/Inventory."""
from datetime import datetime, timezone
from typing import Optional
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
from app.api.v1.deps import get_current_user
import os

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
    log = ShopifySyncLog(
        shopify_store_id=store.id, sync_type="products",
        direction="push", status="running", records_processed=0, records_failed=0
    )
    db.add(log); db.commit(); db.refresh(log)
    products = db.query(Product).filter(Product.shop_id == shop_id).all()
    processed = 0; failed = 0
    async with httpx.AsyncClient(timeout=30) as client:
        for p in products:
            payload = {
                "product": {
                    "title": p.name,
                    "body_html": getattr(p, "description", "") or "",
                    "vendor": "ExiusCart",
                    "product_type": getattr(p, "category", "") or "",
                    "variants": [{
                        "price": str(p.selling_price),
                        "sku": p.sku or "",
                        "inventory_quantity": p.stock or 0,
                        "inventory_management": "shopify",
                    }],
                }
            }
            try:
                resp = await client.post(
                    _shopify_url(store.shopify_domain, "products.json"),
                    headers=_shopify_headers(store.access_token),
                    json=payload
                )
                if resp.status_code in (200, 201):
                    processed += 1
                else:
                    failed += 1
            except Exception:
                failed += 1

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

async def _pull_orders(store: ShopifyStore, db: Session, shop_id: int):
    log = ShopifySyncLog(
        shopify_store_id=store.id, sync_type="orders",
        direction="pull", status="running", records_processed=0, records_failed=0
    )
    db.add(log); db.commit(); db.refresh(log)
    processed = 0; failed = 0
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
                    )
                    db.add(customer); db.flush()

                # Create order if not already imported
                ref = f"SHOPIFY-{so['id']}"
                existing = db.query(Order).filter(Order.reference == ref, Order.shop_id == shop_id).first()
                if existing:
                    continue

                order = Order(
                    shop_id=shop_id,
                    reference=ref,
                    customer_id=customer.id if customer else None,
                    status=so.get("financial_status", "pending"),
                    total=float(so.get("total_price", 0)),
                    payment_method="shopify",
                    notes=f"Imported from Shopify #{so.get('order_number')}",
                )
                db.add(order); db.flush()

                for item in so.get("line_items", []):
                    oi = OrderItem(
                        order_id=order.id,
                        product_name=item.get("title", ""),
                        sku=item.get("sku", ""),
                        quantity=item.get("quantity", 1),
                        unit_price=float(item.get("price", 0)),
                        total_price=float(item.get("price", 0)) * item.get("quantity", 1),
                    )
                    db.add(oi)
                processed += 1
            except Exception:
                failed += 1

        db.commit()
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
    body = await request.json()

    store = db.query(ShopifyStore).filter(ShopifyStore.shop_id == shop_id, ShopifyStore.is_connected == True).first()
    if not store:
        return {"ok": False}

    if topic == "orders/create":
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
                )
                db.add(customer); db.flush()
            ref = f"SHOPIFY-{so['id']}"
            if not db.query(Order).filter(Order.reference == ref, Order.shop_id == shop_id).first():
                order = Order(
                    shop_id=shop_id, reference=ref,
                    customer_id=customer.id if customer else None,
                    status=so.get("financial_status", "pending"),
                    total=float(so.get("total_price", 0)),
                    payment_method="shopify",
                    notes=f"Shopify #{so.get('order_number')}",
                )
                db.add(order); db.flush()
                for item in so.get("line_items", []):
                    db.add(OrderItem(order_id=order.id, product_name=item.get("title", ""), sku=item.get("sku", ""), quantity=item.get("quantity", 1), unit_price=float(item.get("price", 0)), total_price=float(item.get("price", 0)) * item.get("quantity", 1)))
                db.commit()
        except Exception:
            pass

    return {"ok": True}
