"""Printify (print-on-demand) - the seller connects their OWN Printify account
with their own API token (same model as CJ / Printful). This module adds what
comes after the key check in dropshipping.connect_apikey:

  * list the seller's own Printify products and import one into the store
  * forward a customer order to Printify (create order, then send to production)
  * poll Printify for status / tracking

Built from Printify's public API docs (https://developers.printify.com) and
covered by mocked-HTTP tests only. It has NOT been run against a live Printify
account yet, so treat the first real order as the live test.
Printify money values (price, cost) are integer cents in the account currency.
"""
import json
import logging
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.api.v1.endpoints.dropshipping import (
    _get_plan, _rehost_printful_image, _shop_or_404,
)
from app.core.database import get_db
from app.core.encryption import decrypt
from app.core.thedersi import is_thedersi_restricted_shop
from app.models.dropship import DropshipConnection, DropshipOrder, DropshipProductLink
from app.models.order import Order
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter()

PRINTIFY_BASE = "https://api.printify.com/v1"


def printify_headers(conn: DropshipConnection) -> dict:
    # Printify requires a User-Agent. conn.access_token holds the chosen Printify shop id.
    return {"Authorization": f"Bearer {decrypt(conn.api_key)}", "User-Agent": "ExiusCart", "Content-Type": "application/json"}


def get_printify_conn_or_400(shop_id: int, db: Session) -> DropshipConnection:
    conn = db.query(DropshipConnection).filter(
        DropshipConnection.shop_id == shop_id,
        DropshipConnection.supplier_type == "printify",
        DropshipConnection.is_active == True,
    ).first()
    if not conn or not conn.access_token:
        raise HTTPException(status_code=400, detail={
            "error": "printify_not_connected",
            "message": "Connect Printify first in the Suppliers section.",
        })
    return conn


def pick_shop_id(shops) -> Optional[str]:
    """A token can see several Printify shops; prefer one made for API orders."""
    if not isinstance(shops, list) or not shops:
        return None
    api = [s for s in shops if (s.get("sales_channel") or "").lower() in ("api", "custom_integration", "manual")]
    return str((api or shops)[0].get("id"))


def _cents(v) -> Optional[float]:
    try:
        return round(int(v) / 100, 2)
    except (TypeError, ValueError):
        return None


class PrintifyImportIn(BaseModel):
    product_id: str
    selling_price: Optional[float] = None


@router.get("/shops/{shop_id}/dropship/printify/my-products")
async def printify_my_products(
    shop_id: int,
    page: int = 1,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The seller's own designed products in their Printify shop."""
    _shop_or_404(shop_id, current_user, db)
    plan = _get_plan(shop_id, db)
    if is_thedersi_restricted_shop(shop_id, db) or plan == "free_trial":
        raise HTTPException(status_code=403, detail="Print-on-demand product browse is not available on your plan.")
    conn = get_printify_conn_or_400(shop_id, db)
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(f"{PRINTIFY_BASE}/shops/{conn.access_token}/products.json",
                                 params={"page": max(page, 1), "limit": 20}, headers=printify_headers(conn))
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Could not reach Printify: {e}")
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Printify API error: {r.status_code} {r.text[:300]}")
    body = r.json()
    out = []
    for p in body.get("data") or []:
        imgs = p.get("images") or []
        default = next((i for i in imgs if i.get("is_default")), imgs[0] if imgs else {})
        out.append({
            "product_id": p.get("id"),
            "name": p.get("title"),
            "image": default.get("src"),
            "variant_count": len([v for v in (p.get("variants") or []) if v.get("is_enabled")]),
        })
    return {"products": out, "total": body.get("total", len(out)), "page": page}


def _variant_parts(product: dict, variant: dict) -> tuple:
    """(color, size) for a Printify variant via the product's option definitions."""
    names = {}
    for opt in product.get("options") or []:
        for val in opt.get("values") or []:
            names[val.get("id")] = ((opt.get("type") or opt.get("name") or "").lower(), val.get("title"))
    color = size = None
    others = []
    for vid in variant.get("options") or []:
        kind, title = names.get(vid, ("", None))
        if not title:
            continue
        if "color" in kind or "colour" in kind:
            color = title
        elif "size" in kind:
            size = title
        else:
            others.append(title)
    if size is None and others:
        size = others.pop(0)
    if color is None and others:
        color = others.pop(0)
    return color, size


@router.post("/shops/{shop_id}/dropship/printify/import")
async def printify_import(
    shop_id: int,
    body: PrintifyImportIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Imports one of the seller's Printify products as a sellable store product.
    Cost price comes from Printify itself (variant cost); the first enabled
    variant is the default ordered variant, same simplification as Printful."""
    from app.models.product import Product
    from app.models.product_fields import ProductImage
    from app.models.product_variant import ProductVariant
    from app.api.v1.endpoints.products import generate_slug, PLAN_PRODUCT_LIMITS
    from app.core.currency import convert_amount

    shop = _shop_or_404(shop_id, current_user, db)
    plan = _get_plan(shop_id, db)
    if is_thedersi_restricted_shop(shop_id, db) or plan == "free_trial":
        raise HTTPException(status_code=403, detail="Product import is not available on your plan.")
    limit = PLAN_PRODUCT_LIMITS.get(plan, 25)
    if limit != -1 and db.query(Product).filter(Product.shop_id == shop_id).count() >= limit:
        raise HTTPException(status_code=403, detail=f"Product limit reached ({limit} on your plan). Upgrade to add more.")

    conn = get_printify_conn_or_400(shop_id, db)
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(f"{PRINTIFY_BASE}/shops/{conn.access_token}/products/{body.product_id}.json",
                                 headers=printify_headers(conn))
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Could not reach Printify: {e}")
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Printify API error: {r.status_code} {r.text[:300]}")

    pf = r.json()
    variants = [v for v in (pf.get("variants") or []) if v.get("is_enabled")]
    if not variants:
        raise HTTPException(status_code=400, detail="This Printify product has no enabled variants to import.")
    name = (pf.get("title") or "Printify Product").strip()
    target = shop.base_currency or shop.currency or "USD"

    primary = variants[0]
    cost_usd = _cents(primary.get("cost"))
    if body.selling_price:
        price = body.selling_price
    else:
        raw = _cents(primary.get("price"))
        price = await convert_amount(raw, "USD", target) if raw else None
    if not price:
        raise HTTPException(status_code=400, detail="Couldn't determine a price. Set one manually.")
    cost_price = await convert_amount(cost_usd, "USD", target) if cost_usd else None

    product = Product(
        shop_id=shop_id, name=name, description=(pf.get("description") or name), price=price, cost_price=cost_price,
        sku=f"PY-{str(body.product_id)[-8:]}",
        quantity=999999,  # made per order, never out of stock
        low_stock_threshold=0, slug=generate_slug(name),
    )
    db.add(product)
    db.flush()

    imgs = [i.get("src") for i in (pf.get("images") or []) if i.get("src")]
    seen, ordered = set(), []
    for u in imgs:
        if u not in seen:
            seen.add(u); ordered.append(u)
    async with httpx.AsyncClient() as rehost:
        rehosted = {u: await _rehost_printful_image(rehost, u, shop_id, product.id) for u in ordered[:10]}
    for i, u in enumerate(ordered[:10]):
        db.add(ProductImage(product_id=product.id, url=rehosted[u], sort_order=i, is_primary=(i == 0)))

    for v in variants:
        color, size = _variant_parts(pf, v)
        vp = _cents(v.get("price"))
        db.add(ProductVariant(
            product_id=product.id, size=size, color=color, sku=str(v.get("id")), quantity=999999,
            price=(await convert_amount(vp, "USD", target)) if vp else None,
        ))

    db.add(DropshipProductLink(
        shop_id=shop_id, product_id=product.id, supplier_type="printify",
        supplier_product_id=str(body.product_id), supplier_sku=str(primary.get("id")),
        supplier_product_name=name, cost_price=cost_price, is_primary=True,
    ))
    db.commit()
    db.refresh(product)
    logger.info(f"[Printify Import] shop={shop_id} product={product.id} printify_product={body.product_id} variants={len(variants)}")
    return {"product_id": product.id, "name": product.name, "price": float(product.price)}


def _recipient(order: Order) -> dict:
    shipping = {}
    if order.shipping_address:
        try:
            shipping = json.loads(order.shipping_address)
        except Exception:
            shipping = {"address": order.shipping_address}
    full = (shipping.get("name") or order.notes or "Customer").strip()
    first, _, last = full.partition(" ")
    return {
        "first_name": first or "Customer", "last_name": last or "-",
        "email": shipping.get("email") or "", "phone": shipping.get("phone") or "",
        "country": shipping.get("country_code", "US"),
        "region": shipping.get("province") or shipping.get("state") or "",
        "address1": shipping.get("address", ""), "city": shipping.get("city", ""), "zip": shipping.get("zip", ""),
    }


async def place_printify_order(shop_id: int, order_id: int, order: Order, db: Session) -> dict:
    """Create the order on Printify and send it to production. Called from
    dropshipping._fulfill_order_core for supplier_type == "printify"."""
    from app.models.order import OrderItem

    conn = get_printify_conn_or_400(shop_id, db)
    items = db.query(OrderItem).filter(OrderItem.order_id == order_id).all()
    if not items:
        raise HTTPException(status_code=400, detail="Order has no items.")

    line_items = []
    for item in items:
        link = db.query(DropshipProductLink).filter(
            DropshipProductLink.product_id == item.product_id, DropshipProductLink.supplier_type == "printify",
        ).first()
        if not link or not link.supplier_product_id or not link.supplier_sku:
            raise HTTPException(status_code=400, detail={
                "error": "no_supplier_link",
                "message": f"Product '{item.product_name}' does not have a Printify supplier link. Re-import it from Printify.",
            })
        line_items.append({"product_id": link.supplier_product_id, "variant_id": int(link.supplier_sku), "quantity": item.quantity})

    payload = {
        "external_id": order.order_number, "label": order.order_number, "line_items": line_items,
        "shipping_method": 1,  # 1 = standard
        "send_shipping_notification": False, "address_to": _recipient(order),
    }

    def fail(msg: str, code: str = "printify_order_failed"):
        db.add(DropshipOrder(shop_id=shop_id, order_id=order_id, supplier_type="printify", status="failed", error_message=str(msg)[:2000]))
        order.fulfillment_status = "failed"
        db.commit()
        raise HTTPException(status_code=400, detail={"error": code, "message": f"Printify rejected this order: {msg}"})

    base = f"{PRINTIFY_BASE}/shops/{conn.access_token}"
    try:
        async with httpx.AsyncClient(timeout=25) as client:
            r = await client.post(f"{base}/orders.json", json=payload, headers=printify_headers(conn))
            if r.status_code not in (200, 201) or not (r.json() or {}).get("id"):
                fail((r.json() or {}).get("message") or (r.json() or {}).get("errors") or r.text[:300])
            pid = str(r.json()["id"])
            s = await client.post(f"{base}/orders/{pid}/send_to_production.json", headers=printify_headers(conn))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Printify API error: {e}")

    if s.status_code not in (200, 201):
        # The order exists on Printify but was not released - say so, don't pretend it is on its way.
        db.add(DropshipOrder(shop_id=shop_id, order_id=order_id, supplier_type="printify", supplier_order_id=pid, status="failed",
                             error_message=f"Created on Printify but not sent to production ({s.status_code}): {s.text[:300]}"))
        order.fulfillment_status = "failed"
        db.commit()
        raise HTTPException(status_code=400, detail={
            "error": "printify_send_failed",
            "message": "The order was created on Printify but could not be sent to production. Open it in your Printify dashboard to finish it.",
        })

    db.add(DropshipOrder(shop_id=shop_id, order_id=order_id, supplier_type="printify", supplier_order_id=pid, status="processing"))
    order.fulfillment_status = "sent"
    db.commit()
    return {"fulfilled": True, "supplier_type": "printify", "supplier_order_id": pid,
            "message": "Order sent to Printify. Tracking will appear here once it ships."}


def sync_printify_tracking_job(db_session_factory) -> None:
    """Poll Printify for status / tracking on open Printify orders (every 2h, scheduled in main.py).
    Printify order statuses: pending, on-hold, sending-to-production, in-production, fulfilled,
    partially-fulfilled, canceled, has-issues."""
    db = db_session_factory()
    try:
        pending = db.query(DropshipOrder).filter(
            DropshipOrder.supplier_type == "printify",
            DropshipOrder.status.in_(["processing", "sent", "shipped"]),
            DropshipOrder.supplier_order_id.isnot(None),
        ).all()
        conns: dict = {}
        for ds in pending:
            if ds.shop_id not in conns:
                conns[ds.shop_id] = db.query(DropshipConnection).filter(
                    DropshipConnection.shop_id == ds.shop_id, DropshipConnection.supplier_type == "printify",
                    DropshipConnection.is_active == True).first()
            conn = conns[ds.shop_id]
            if not conn or not conn.access_token:
                continue
            try:
                with httpx.Client(timeout=15) as client:
                    r = client.get(f"{PRINTIFY_BASE}/shops/{conn.access_token}/orders/{ds.supplier_order_id}.json", headers=printify_headers(conn))
                if r.status_code != 200:
                    continue
                po = r.json()
                status = (po.get("status") or "").lower()
                ships = po.get("shipments") or []
                last = ships[-1] if ships else {}
                number, url, carrier = last.get("number"), last.get("url"), last.get("carrier")
                if number: ds.tracking_number = number
                if url: ds.tracking_url = url
                if carrier: ds.carrier = carrier

                if status in ("canceled", "on-hold", "has-issues"):
                    ds.status = "failed"
                    ds.error_message = f"Printify order is '{status}'. Check this order on your Printify dashboard."
                elif last.get("delivered_at"):
                    ds.status = "delivered"
                    ds.delivered_at = ds.delivered_at or datetime.now(timezone.utc)
                elif number and status in ("fulfilled", "partially-fulfilled", "in-production", "sending-to-production", "pending"):
                    if ds.status != "shipped":
                        ds.status = "shipped"
                        ds.shipped_at = ds.shipped_at or datetime.now(timezone.utc)
                if number:
                    o = db.query(Order).filter(Order.id == ds.order_id).first()
                    if o and not o.tracking_number:
                        o.tracking_number = number
                        o.carrier = carrier or o.carrier
                db.commit()
            except Exception as e:
                logger.error(f"[Printify Tracking] ds_order={ds.id}: {e}")
    except Exception as e:
        logger.error(f"[Printify Tracking] Job error: {e}")
    finally:
        db.close()
