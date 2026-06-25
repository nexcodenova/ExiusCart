"""
Public shopping storefront endpoints — no auth required.
Powers the exiuscart-shopping frontend at port 3003.
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from app.core.database import get_db
from app.models.product import Product, Category
from app.models.shop import Shop

router = APIRouter()


def _product_out(p: Product) -> dict:
    selling = float(p.price)
    buying = float(p.cost_price) if p.cost_price else None
    discount_pct = None
    if buying and selling and buying > 0 and selling < buying:
        discount_pct = round((1 - selling / buying) * 100)
    return {
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "price": selling,
        "cost_price": buying,
        "discount_pct": discount_pct,
        "currency": p.shop.currency if p.shop else "AED",
        "image_url": p.image_url,
        "video_url": getattr(p, "video_url", None),
        "is_trending": p.is_trending,
        "is_featured": p.is_featured,
        "stock": p.quantity,
        "sku": p.sku,
        "category_name": p.category.name if p.category else None,
        "category_slug": p.category.slug if p.category else None,
        "shop_name": p.shop.name if p.shop else None,
    }


@router.get("/shopping/products")
def list_shopping_products(
    search: Optional[str] = None,
    category: Optional[str] = None,      # category slug
    trending: Optional[bool] = None,
    featured: Optional[bool] = None,
    db: Session = Depends(get_db),
):
    """
    Public product listing for the shopping storefront.
    Only returns active products from active shops.
    """
    query = (
        db.query(Product)
        .join(Shop, Product.shop_id == Shop.id)
        .outerjoin(Category, Product.category_id == Category.id)
        .options(
            joinedload(Product.shop),
            joinedload(Product.category),
        )
        .filter(Product.is_active == True, Shop.is_active == True)
    )

    if search:
        q = f"%{search}%"
        query = query.filter(
            (Product.name.ilike(q)) | (Product.description.ilike(q))
        )

    if category:
        query = query.filter(Category.slug == category)

    if trending is True:
        query = query.filter(Product.is_trending == True)

    if featured is True:
        query = query.filter(Product.is_featured == True)

    # Trending first, then featured, then newest
    products = query.order_by(
        Product.is_trending.desc(),
        Product.is_featured.desc(),
        Product.created_at.desc(),
    ).limit(100).all()

    return [_product_out(p) for p in products]


@router.get("/shopping/products/{product_id}")
def get_shopping_product(
    product_id: int,
    db: Session = Depends(get_db),
):
    product = (
        db.query(Product)
        .join(Shop, Product.shop_id == Shop.id)
        .options(
            joinedload(Product.shop),
            joinedload(Product.category),
        )
        .filter(
            Product.id == product_id,
            Product.is_active == True,
            Shop.is_active == True,
        )
        .first()
    )
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return _product_out(product)


@router.get("/shopping/categories")
def list_shopping_categories(db: Session = Depends(get_db)):
    """
    Returns all categories that have at least one active product in an active shop.
    """
    rows = (
        db.query(Category)
        .join(Product, Product.category_id == Category.id)
        .join(Shop, Product.shop_id == Shop.id)
        .filter(Product.is_active == True, Shop.is_active == True)
        .distinct()
        .order_by(Category.name)
        .all()
    )
    return [{"id": c.id, "name": c.name, "slug": c.slug} for c in rows]
