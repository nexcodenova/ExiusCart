from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.shop import Shop
from app.models.product import Product
from app.models.product_variant import ProductVariant
from app.models.bundle_component import BundleComponent

router = APIRouter()


class BundleComponentIn(BaseModel):
    component_product_id: int
    allowed_variant_ids: List[int] = []
    quantity: int = 1


def _get_shop(shop_id: int, user: User, db: Session) -> Shop:
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


def _get_product(product_id: int, shop_id: int, db: Session) -> Product:
    p = db.query(Product).filter(Product.id == product_id, Product.shop_id == shop_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    return p


def deduct_bundle_components(bundle_product_id: int, order_qty: int, db: Session) -> None:
    """Deduct stock from each component when a bundle is sold. Safe to call — no-op if not a bundle."""
    components = db.query(BundleComponent).filter(
        BundleComponent.bundle_product_id == bundle_product_id
    ).all()
    for c in components:
        comp = db.query(Product).filter(Product.id == c.component_product_id).first()
        if comp:
            comp.quantity = max(0, comp.quantity - (c.quantity * order_qty))


@router.get("/shops/{shop_id}/products/{product_id}/bundle-components")
def get_bundle_components(
    shop_id: int,
    product_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_shop(shop_id, current_user, db)
    _get_product(product_id, shop_id, db)
    components = db.query(BundleComponent).filter(
        BundleComponent.bundle_product_id == product_id
    ).all()
    result = []
    for c in components:
        comp_product = db.query(Product).filter(Product.id == c.component_product_id).first()
        allowed_ids = c.allowed_variant_ids or []
        allowed_variants = db.query(ProductVariant).filter(ProductVariant.id.in_(allowed_ids)).all() if allowed_ids else []
        result.append({
            "id": c.id,
            "component_product_id": c.component_product_id,
            "component_product_name": comp_product.name if comp_product else "Unknown",
            "allowed_variant_ids": allowed_ids,
            "allowed_variants": [
                {"id": v.id, "size": v.size, "color": v.color, "quantity": v.quantity}
                for v in allowed_variants
            ],
            "quantity": c.quantity,
        })
    return result


@router.put("/shops/{shop_id}/products/{product_id}/bundle-components")
def save_bundle_components(
    shop_id: int,
    product_id: int,
    components: List[BundleComponentIn],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_shop(shop_id, current_user, db)
    product = _get_product(product_id, shop_id, db)

    # Validate all component products belong to the same shop, and that any
    # allowed_variant_ids actually belong to that specific component product
    # — never trust the client to only send real, matching variant IDs.
    for c in components:
        if c.component_product_id == product_id:
            raise HTTPException(status_code=400, detail="A bundle cannot include itself as a component")
        comp = db.query(Product).filter(
            Product.id == c.component_product_id,
            Product.shop_id == shop_id
        ).first()
        if not comp:
            raise HTTPException(status_code=400, detail=f"Product {c.component_product_id} not found in this shop")
        if c.allowed_variant_ids:
            real_ids = {
                v.id for v in db.query(ProductVariant.id).filter(
                    ProductVariant.product_id == c.component_product_id,
                    ProductVariant.id.in_(c.allowed_variant_ids),
                ).all()
            }
            if real_ids != set(c.allowed_variant_ids):
                raise HTTPException(status_code=400, detail=f"One or more selected options don't belong to product {c.component_product_id}")

    # Deduplicate: one row per component product, summing quantity and
    # merging any allowed variant selections if it somehow appears twice.
    seen: dict = {}
    for c in components:
        key = c.component_product_id
        if key not in seen:
            seen[key] = {"quantity": 0, "allowed_variant_ids": set()}
        seen[key]["quantity"] += max(1, c.quantity)
        seen[key]["allowed_variant_ids"].update(c.allowed_variant_ids or [])

    # Replace all components
    db.query(BundleComponent).filter(BundleComponent.bundle_product_id == product_id).delete()
    for comp_id, data in seen.items():
        db.add(BundleComponent(
            bundle_product_id=product_id,
            component_product_id=comp_id,
            allowed_variant_ids=sorted(data["allowed_variant_ids"]) or None,
            quantity=data["quantity"],
        ))

    product.is_bundle = len(components) > 0
    db.commit()
    return {"saved": len(components)}
