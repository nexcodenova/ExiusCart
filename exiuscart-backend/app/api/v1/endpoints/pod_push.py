"""
Design -> print-on-demand product, for Printful and Gelato (Printify lives in printify.py).

Printful
  catalogue search, a product's colours/sizes/print placements, then:
  * create a sync product in the seller's own Printful store (Manual/API store)
    with the design on the chosen placement, optionally import it into
    ExiusCart (linked, so orders auto-send to Printful)
  * Printful's own mockup generator (real photos of the real blank, free,
    no AI allowance used) - results saved to Brand Assets
Gelato
  products come from a template the seller makes once in Gelato; we read the
  template's variants and image placeholders and create a product from it
  with the design in every placeholder.

UNVERIFIED against live accounts: built from Printful's and Gelato's public
API docs, checked with mocked HTTP only. The first real product is the live test.
"""
import asyncio
import io
import logging
import time
from typing import List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.api.v1.endpoints.dropshipping import (
    PRINTFUL_BASE, _check_supplier_allowed, _get_plan, _get_printful_conn_or_400, _printful_headers, _shop_or_404,
)
from app.core.database import get_db
from app.core.encryption import decrypt
from app.models.dropship import DropshipConnection
from app.models.studio import StudioAsset
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter()

_PF_CATALOG = {"at": 0.0, "items": []}
CATALOG_TTL = 24 * 3600
MAX_VARIANTS = 100
MOCKUP_WAIT_SECONDS = 50


def _asset_or_404(db: Session, shop_id: int, asset_id: int) -> StudioAsset:
    a = db.query(StudioAsset).filter(StudioAsset.id == asset_id, StudioAsset.shop_id == shop_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Design not found")
    return a


async def _printful_for_shop(shop_id: int, user: User, db: Session) -> DropshipConnection:
    _shop_or_404(shop_id, user, db)
    _check_supplier_allowed(_get_plan(shop_id, db), "printful", shop_id, db)
    return await _get_printful_conn_or_400(shop_id, db)


async def _pf(conn: DropshipConnection, method: str, path: str, **kw):
    try:
        async with httpx.AsyncClient(timeout=40) as client:
            r = await client.request(method, f"{PRINTFUL_BASE}{path}", headers=_printful_headers(conn), **kw)
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Could not reach Printful: {e}")
    data = r.json() if r.content else {}
    if r.status_code not in (200, 201):
        msg = None
        if isinstance(data, dict):
            msg = (data.get("error") or {}).get("message") or (data.get("result") if isinstance(data.get("result"), str) else None)
        raise HTTPException(status_code=502, detail=f"Printful said: {msg or r.status_code}")
    return data.get("result") if isinstance(data, dict) else data


def _design_size(url: str) -> Optional[tuple]:
    """(width, height) of the design, to keep its proportions when placing it."""
    try:
        from PIL import Image
        r = httpx.get(url, timeout=30, follow_redirects=True)
        with Image.open(io.BytesIO(r.content)) as im:
            return im.size
    except Exception:
        return None


def place(area_w: int, area_h: int, design: Optional[tuple], scale: float) -> Optional[dict]:
    """Printful position: design `scale` x the print-area width, proportions kept, centred
    horizontally, at the top (where chest prints go). None = let Printful fit it."""
    if not area_w or not area_h or not design or not design[0] or not design[1]:
        return None
    scale = max(0.2, min(float(scale), 1.0))
    w = area_w * scale
    h = w * design[1] / design[0]
    if h > area_h:  # tall design: fit the height instead
        h = area_h
        w = h * design[0] / design[1]
    return {"area_width": area_w, "area_height": area_h, "width": round(w), "height": round(h),
            "top": 0, "left": round((area_w - w) / 2)}


async def _printfile_for(conn, catalog_product_id: int, placement: str, variant_id: int) -> Optional[tuple]:
    pf = await _pf(conn, "GET", f"/mockup-generator/printfiles/{catalog_product_id}")
    files = {f.get("printfile_id"): f for f in (pf or {}).get("printfiles") or []}
    for vp in (pf or {}).get("variant_printfiles") or []:
        if vp.get("variant_id") == variant_id:
            f = files.get((vp.get("placements") or {}).get(placement))
            if f:
                return f.get("width"), f.get("height")
    return None


# ── Printful catalogue ───────────────────────────────────────────────────────

@router.get("/shops/{shop_id}/printful/catalog")
async def printful_catalog_search(shop_id: int, q: str = "", db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    conn = await _printful_for_shop(shop_id, current_user, db)
    if not _PF_CATALOG["items"] or time.time() - _PF_CATALOG["at"] > CATALOG_TTL:
        rows = await _pf(conn, "GET", "/products")
        _PF_CATALOG["items"] = [{"id": p.get("id"), "title": p.get("title"), "type": p.get("type_name"), "brand": p.get("brand"),
                                 "model": p.get("model"), "image": p.get("image")} for p in (rows or []) if p.get("id") and not p.get("is_discontinued")]
        _PF_CATALOG["at"] = time.time()
    words = [w for w in q.lower().split() if w]
    items = [p for p in _PF_CATALOG["items"] if all(w in f"{p['title']} {p['type']} {p['brand']} {p['model']}".lower() for w in words)] if words else _PF_CATALOG["items"]
    return {"products": items[:40], "total": len(items)}


@router.get("/shops/{shop_id}/printful/catalog/{catalog_product_id}")
async def printful_catalog_options(shop_id: int, catalog_product_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    conn = await _printful_for_shop(shop_id, current_user, db)
    detail = await _pf(conn, "GET", f"/products/{catalog_product_id}")
    pf = await _pf(conn, "GET", f"/mockup-generator/printfiles/{catalog_product_id}")
    variants = [{"id": v.get("id"), "color": v.get("color"), "color_code": v.get("color_code"), "size": v.get("size"), "price": v.get("price")}
                for v in (detail or {}).get("variants") or [] if v.get("in_stock", True)]
    placements = (pf or {}).get("available_placements") or {"front": "Front print"}
    return {
        "variants": variants,
        "colors": [{"name": c, "hex": next((v["color_code"] for v in variants if v["color"] == c), None)}
                   for c in dict.fromkeys(v["color"] for v in variants if v["color"])],
        "sizes": list(dict.fromkeys(v["size"] for v in variants if v["size"])),
        "placements": [{"key": k, "label": v} for k, v in placements.items()],
    }


# ── Printful: design -> product ──────────────────────────────────────────────

class PrintfulPushIn(BaseModel):
    catalog_product_id: int
    variant_ids: List[int]
    price: float
    title: str
    placement: str = "front"
    scale: float = 0.8
    import_to_store: bool = True
    store_price: Optional[float] = None
    make_mockups: bool = True


@router.post("/shops/{shop_id}/studio/assets/{asset_id}/printful")
async def send_design_to_printful(shop_id: int, asset_id: int, body: PrintfulPushIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    conn = await _printful_for_shop(shop_id, current_user, db)
    asset = _asset_or_404(db, shop_id, asset_id)
    ids = list(dict.fromkeys(int(v) for v in body.variant_ids))[:MAX_VARIANTS]
    if not ids:
        raise HTTPException(status_code=400, detail="Pick at least one colour and size.")
    if body.price <= 0 or not body.title.strip():
        raise HTTPException(status_code=400, detail="A title and a price are needed.")

    area = await _printfile_for(conn, body.catalog_product_id, body.placement, ids[0])
    position = place(area[0], area[1], _design_size(asset.url), body.scale) if area else None
    file = {"type": body.placement or "front", "url": asset.url}
    if position:
        file["position"] = position
    try:
        created = await _pf(conn, "POST", "/store/products", json={
            "sync_product": {"name": body.title.strip()[:200], "thumbnail": asset.url},
            "sync_variants": [{"variant_id": v, "retail_price": f"{body.price:.2f}", "files": [file]} for v in ids],
        })
    except HTTPException as e:
        # Stores connected to Etsy/Shopify inside Printful get their products from that platform
        raise HTTPException(status_code=502, detail=f"{e.detail}. If your Printful store is connected to Etsy or Shopify, "
                                                     "create the product there, or connect a Printful 'Manual order / API' store.")
    sync_id = int((created or {}).get("id") or 0)
    if not sync_id:
        raise HTTPException(status_code=502, detail="Printful did not return the new product.")
    asset.meta = {**(asset.meta or {}), "printful_product_id": sync_id}
    db.commit()

    mockups = None
    if body.make_mockups:
        mockups = await _printful_mockups(conn, db, shop_id, asset, body.catalog_product_id, ids, body.placement, position)

    store_product = None
    if body.import_to_store:
        from app.api.v1.endpoints.dropshipping import PrintfulImportIn, printful_import
        try:
            store_product = await printful_import(shop_id, PrintfulImportIn(sync_product_id=sync_id, selling_price=body.store_price),
                                                  db=db, current_user=current_user)
        except HTTPException as e:
            store_product = {"error": e.detail if isinstance(e.detail, str) else (e.detail or {}).get("message", "Import failed")}
    logger.info(f"[Printful push] shop={shop_id} asset={asset.id} sync_product={sync_id} variants={len(ids)}")
    return {"printful_product_id": sync_id, "mockups": mockups, "store_product": store_product}


class PrintfulMockupIn(BaseModel):
    catalog_product_id: int
    variant_ids: List[int]
    placement: str = "front"
    scale: float = 0.8


@router.post("/shops/{shop_id}/studio/assets/{asset_id}/printful-mockups")
async def printful_official_mockups(shop_id: int, asset_id: int, body: PrintfulMockupIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Printful's own mockup photos of the real blank with this design. Free; not counted as AI images."""
    conn = await _printful_for_shop(shop_id, current_user, db)
    asset = _asset_or_404(db, shop_id, asset_id)
    ids = list(dict.fromkeys(int(v) for v in body.variant_ids))[:10]
    if not ids:
        raise HTTPException(status_code=400, detail="Pick at least one colour.")
    area = await _printfile_for(conn, body.catalog_product_id, body.placement, ids[0])
    position = place(area[0], area[1], _design_size(asset.url), body.scale) if area else None
    return await _printful_mockups(conn, db, shop_id, asset, body.catalog_product_id, ids, body.placement, position)


async def _printful_mockups(conn, db: Session, shop_id: int, asset: StudioAsset, catalog_product_id: int,
                            variant_ids: List[int], placement: str, position: Optional[dict]) -> dict:
    """Starts a Printful mockup task, waits for it (a minute at most) and saves the photos to Brand Assets."""
    f = {"placement": placement or "front", "image_url": asset.url}
    if position:
        f["position"] = position
    try:
        task = await _pf(conn, "POST", f"/mockup-generator/create-task/{catalog_product_id}",
                         json={"variant_ids": variant_ids[:10], "format": "jpg", "files": [f]})
    except HTTPException as e:
        return {"status": "failed", "message": str(e.detail), "assets": []}
    key = (task or {}).get("task_key")
    deadline = time.time() + MOCKUP_WAIT_SECONDS
    result = None
    while key and time.time() < deadline:
        await asyncio.sleep(3)
        try:
            result = await _pf(conn, "GET", "/mockup-generator/task", params={"task_key": key})
        except HTTPException:
            continue
        if (result or {}).get("status") in ("completed", "failed"):
            break
    if not result or result.get("status") != "completed":
        return {"status": (result or {}).get("status") or "pending", "message": "Printful is still making the mockups. Try again in a minute.", "assets": []}

    from app.api.v1.endpoints.studio import save_asset
    saved, seen = [], set()
    for m in result.get("mockups") or []:
        for url in [m.get("mockup_url")] + [x.get("url") for x in (m.get("extra") or [])]:
            if url and url not in seen:
                seen.add(url)
                a = save_asset(db, shop_id, "mockup", url, f"{(asset.title or 'Design')[:80]} · Printful mockup", source="printful",
                               meta={"design_asset_id": asset.id, "catalog_product_id": catalog_product_id, "placement": placement})
                saved.append({"id": a.id, "url": a.url})
    return {"status": "completed", "assets": saved[:24]}


# ── Gelato: design -> product from the seller's template ─────────────────────

GELATO_ECOM = "https://ecommerce.gelatoapis.com/v1"


async def _gelato_for_shop(shop_id: int, user: User, db: Session) -> DropshipConnection:
    _shop_or_404(shop_id, user, db)
    _check_supplier_allowed(_get_plan(shop_id, db), "gelato", shop_id, db)
    conn = db.query(DropshipConnection).filter(DropshipConnection.shop_id == shop_id, DropshipConnection.supplier_type == "gelato",
                                               DropshipConnection.is_active == True).first()
    if not conn or not conn.api_key:
        raise HTTPException(status_code=400, detail={"error": "gelato_not_connected", "message": "Connect Gelato first in the Suppliers section."})
    return conn


async def _gelato(conn, method: str, path: str, **kw):
    try:
        async with httpx.AsyncClient(timeout=40) as client:
            r = await client.request(method, f"{GELATO_ECOM}{path}", headers={"X-API-KEY": decrypt(conn.api_key)}, **kw)
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Could not reach Gelato: {e}")
    data = r.json() if r.content else {}
    if r.status_code not in (200, 201):
        raise HTTPException(status_code=502, detail=f"Gelato said: {(data or {}).get('message') or r.status_code}")
    return data


@router.get("/shops/{shop_id}/gelato/templates/{template_id}")
async def gelato_template(shop_id: int, template_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    conn = await _gelato_for_shop(shop_id, current_user, db)
    t = await _gelato(conn, "GET", f"/templates/{template_id}")
    variants = [{"id": v.get("id"), "title": v.get("title"),
                 "placeholders": [p.get("name") for p in (v.get("imagePlaceholders") or []) if p.get("name")]}
                for v in t.get("variants") or []]
    return {"id": t.get("id"), "title": t.get("templateName") or t.get("title"), "variants": variants,
            "preview": t.get("previewUrl")}


class GelatoPushIn(BaseModel):
    template_id: str
    title: str
    description: Optional[str] = None
    variant_ids: Optional[List[str]] = None   # template variant ids; all when empty
    visible: bool = False                       # show it in the store connected to Gelato right away


@router.post("/shops/{shop_id}/studio/assets/{asset_id}/gelato")
async def send_design_to_gelato(shop_id: int, asset_id: int, body: GelatoPushIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    conn = await _gelato_for_shop(shop_id, current_user, db)
    asset = _asset_or_404(db, shop_id, asset_id)
    if not body.title.strip():
        raise HTTPException(status_code=400, detail="A title is needed.")
    stores = await _gelato(conn, "GET", "/stores")
    store_list = stores.get("stores") if isinstance(stores, dict) else stores
    store_id = (store_list or [{}])[0].get("id")
    if not store_id:
        raise HTTPException(status_code=400, detail="Your Gelato account has no store yet. Create one in Gelato first.")
    t = await _gelato(conn, "GET", f"/templates/{body.template_id}")
    wanted = set(body.variant_ids or [])
    variants = [{"templateVariantId": v.get("id"),
                 "imagePlaceholders": [{"name": p.get("name"), "fileUrl": asset.url} for p in (v.get("imagePlaceholders") or []) if p.get("name")]}
                for v in t.get("variants") or [] if not wanted or v.get("id") in wanted]
    if not variants:
        raise HTTPException(status_code=400, detail="That template has no variants to use.")
    created = await _gelato(conn, "POST", f"/stores/{store_id}/products:create-from-template", json={
        "templateId": body.template_id, "title": body.title.strip()[:200], "description": (body.description or body.title).strip()[:5000],
        "isVisibleInTheOnlineStore": bool(body.visible), "salesChannels": ["web"], "variants": variants,
    })
    product_id = created.get("id")
    asset.meta = {**(asset.meta or {}), "gelato_product_id": product_id}
    db.commit()
    logger.info(f"[Gelato push] shop={shop_id} asset={asset.id} product={product_id} variants={len(variants)}")
    return {"gelato_product_id": product_id, "store_id": store_id}
