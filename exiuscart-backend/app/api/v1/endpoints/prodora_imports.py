"""What this store has imported from Prodora - read straight from the import
ledger (prodora_import_logs), which records the new store product and the
Prodora catalogue product for every import. Owner-only: "prodora-imports" is not
listed in shop_access.PATH_AREAS, so the staff gate keeps it owner-only."""
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.api.v1.endpoints.shopping import PRODORA_MONTHLY_IMPORT_LIMIT, _find_eligible_subscription
from app.core.database import get_db
from app.core.shop_access import get_shop_for_member
from app.models.dropship import DropshipProductLink
from app.models.product import Product
from app.models.prodora import ProdoraImportLog
from app.models.user import User

router = APIRouter()


@router.get("/shops/{shop_id}/prodora-imports")
def list_prodora_imports(
    shop_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = get_shop_for_member(db, shop_id, current_user)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    logs = (
        db.query(ProdoraImportLog)
        .filter(ProdoraImportLog.shop_id == shop.id)
        .order_by(ProdoraImportLog.id.desc())
        .all()
    )
    ids = {i for l in logs for i in (l.product_id, l.source_product_id) if i}
    products = {p.id: p for p in db.query(Product).filter(Product.id.in_(ids)).all()} if ids else {}

    # Supplier per product: the link on the store's own copy, else the one on the Prodora catalogue product.
    link_by_product: dict = {}
    if ids:
        for pid, stype in (
            db.query(DropshipProductLink.product_id, DropshipProductLink.supplier_type)
            .filter(DropshipProductLink.product_id.in_(ids))
            .order_by(DropshipProductLink.is_primary.desc(), DropshipProductLink.id)
        ):
            link_by_product.setdefault(pid, stype)

    rows = []
    for l in logs:
        mine = products.get(l.product_id) if l.product_id else None
        # The ledger has no FK, so a product the seller later deleted is still listed, marked removed.
        if mine is not None and mine.shop_id != shop.id:
            mine = None
        src = products.get(l.source_product_id) if l.source_product_id else None
        cost = float(mine.cost_price) if mine is not None and mine.cost_price is not None else None
        price = float(mine.price) if mine is not None and mine.price is not None else None
        rows.append({
            "id": l.id,
            "imported_at": l.created_at.isoformat() if l.created_at else None,
            "removed": mine is None,
            "supplier_type": link_by_product.get(l.product_id) or link_by_product.get(l.source_product_id),
            "product": None if mine is None else {
                "id": mine.id, "name": mine.name, "sku": mine.sku, "image_url": mine.image_url,
                "price": price, "cost_price": cost, "stock": mine.quantity, "is_active": mine.is_active,
            },
            "source": None if src is None else {
                "id": src.id, "name": src.name, "code": src.prodora_code, "supplier_name": src.supplier_name,
                "image_url": src.image_url,
            },
        })

    sub = _find_eligible_subscription(db, current_user)
    plan = sub.plan_type if sub else None
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    used = (
        db.query(func.count(ProdoraImportLog.id))
        .filter(ProdoraImportLog.shop_id == shop.id, ProdoraImportLog.created_at >= month_start)
        .scalar() or 0
    )
    return {
        "imports": rows,
        "usage": {
            "used": used,
            "limit": PRODORA_MONTHLY_IMPORT_LIMIT.get(plan or "", 0),  # None = unlimited
            "resets_at": (month_start + timedelta(days=32)).replace(day=1).isoformat(),
        },
    }
