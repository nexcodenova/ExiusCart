"""
Prodora storefront endpoints. Product browsing requires a Prodora access
token — issued only to ExiusCart accounts on an active Starter or Premium
subscription (see POST /shopping/request-access).
"""
from typing import Optional
from datetime import timedelta
import uuid
from slugify import slugify
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from app.core.database import get_db
from app.core.security import create_access_token, decode_token
from app.models.product import Product, Category
from app.models.product_fields import ProductImage
from app.models.shop import Shop
from app.models.user import User
from app.models.subscription import Subscription

router = APIRouter()

# Plans that grant Prodora access. Free trial and TheDersi plans are
# deliberately excluded — Prodora is a Starter/Premium perk only.
PRODORA_ELIGIBLE_PLANS = ("starter", "premium")

_security = HTTPBearer()


class ProdoraAccessRequest(BaseModel):
    email: EmailStr


def _find_eligible_subscription(db: Session, user: User) -> Optional[Subscription]:
    shop = (
        db.query(Shop)
        .filter(Shop.owner_id == user.id, Shop.is_active == True)
        .order_by(Shop.id.asc())
        .first()
    )
    if not shop:
        return None
    return (
        db.query(Subscription)
        .filter(
            Subscription.shop_id == shop.id,
            Subscription.status == "active",
            Subscription.plan_type.in_(PRODORA_ELIGIBLE_PLANS),
        )
        .order_by(Subscription.created_at.desc())
        .first()
    )


async def get_prodora_user(
    credentials: HTTPAuthorizationCredentials = Depends(_security),
    db: Session = Depends(get_db),
) -> User:
    """Re-verifies plan eligibility on every call — a lapsed/downgraded
    subscription loses Prodora access immediately, not just at token expiry."""
    payload = decode_token(credentials.credentials)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == int(user_id)).first() if user_id else None
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid session")

    if not _find_eligible_subscription(db, user):
        raise HTTPException(
            status_code=403,
            detail="Prodora is available exclusively to ExiusCart Starter and Premium users.",
        )
    return user


@router.post("/shopping/request-access")
def request_prodora_access(body: ProdoraAccessRequest, db: Session = Depends(get_db)):
    """
    Email-only access gate. Only ExiusCart accounts with an active Starter
    or Premium subscription receive a token — free trial and TheDersi
    accounts are rejected with a clear reason.
    """
    user = db.query(User).filter(func.lower(User.email) == body.email.lower()).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="No ExiusCart account found with this email.",
        )

    if not _find_eligible_subscription(db, user):
        raise HTTPException(
            status_code=403,
            detail="Prodora is available exclusively to ExiusCart Starter and Premium users.",
        )

    token = create_access_token(data={"sub": str(user.id)}, expires_delta=timedelta(hours=24))
    return {"access_token": token, "name": user.full_name or user.email}


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
        "currency": "USD",
        "image_url": p.image_url,
        "video_url": getattr(p, "video_url", None),
        "source_url": getattr(p, "source_url", None),
        "is_trending": p.is_trending,
        "is_featured": p.is_featured,
        "stock": p.quantity,
        "sku": p.sku,
        "category_name": p.category.name if p.category else None,
        "category_slug": p.category.slug if p.category else None,
    }


@router.get("/shopping/products")
def list_shopping_products(
    search: Optional[str] = None,
    category: Optional[str] = None,      # category slug
    trending: Optional[bool] = None,
    featured: Optional[bool] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_prodora_user),
):
    """
    Product listing for the Prodora storefront. Requires a valid Prodora
    access token (see POST /shopping/request-access).
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
        .filter(
            Product.is_active == True,
            Shop.is_active == True,
            Shop.slug == "exiuscart-dropshipping-system",
        )
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
    _: User = Depends(get_prodora_user),
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
            Shop.slug == "exiuscart-dropshipping-system",
        )
        .first()
    )
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return _product_out(product)


@router.post("/shopping/products/{product_id}/import")
def import_shopping_product(
    product_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_prodora_user),
):
    """
    One-click import: copies a Prodora catalog product into the calling
    seller's own ExiusCart shop as a real, editable product — pre-filled
    with name, price, description, and photo. Previously "Add to My
    ExiusCart Store" was just a link to log in; the seller had to rebuild
    the whole listing by hand.
    """
    source = (
        db.query(Product)
        .join(Shop, Product.shop_id == Shop.id)
        .options(joinedload(Product.category))
        .filter(
            Product.id == product_id,
            Product.is_active == True,
            Shop.is_active == True,
            Shop.slug == "exiuscart-dropshipping-system",
        )
        .first()
    )
    if not source:
        raise HTTPException(status_code=404, detail="Product not found")

    shop = (
        db.query(Shop)
        .filter(Shop.owner_id == user.id, Shop.is_active == True)
        .order_by(Shop.id.asc())
        .first()
    )
    if not shop:
        raise HTTPException(status_code=404, detail="No active ExiusCart shop found for this account")

    # Match by category name into the seller's own categories — the source
    # category_id belongs to the curated catalog shop, not this seller's
    # shop, so it can't be copied directly (categories are shop-scoped).
    category_id = None
    if source.category:
        match = db.query(Category).filter(
            Category.shop_id == shop.id, Category.name == source.category.name
        ).first()
        if match:
            category_id = match.id

    new_product = Product(
        shop_id=shop.id,
        category_id=category_id,
        name=source.name,
        description=source.description,
        price=source.price,
        cost_price=source.cost_price,
        sku=f"{(source.sku or 'PRODORA')}-{uuid.uuid4().hex[:6]}",
        quantity=0,
        low_stock_threshold=5,
        slug=f"{slugify(source.name)}-{uuid.uuid4().hex[:6]}",
        image_url=source.image_url,
        video_url=source.video_url,
        source_url=source.source_url,
    )
    db.add(new_product)
    db.flush()

    if source.image_url:
        db.add(ProductImage(product_id=new_product.id, url=source.image_url, sort_order=0, is_primary=True))

    db.commit()
    db.refresh(new_product)
    return {"product_id": new_product.id, "name": new_product.name, "shop_id": shop.id}


@router.get("/shopping/categories")
def list_shopping_categories(db: Session = Depends(get_db), _: User = Depends(get_prodora_user)):
    """
    Returns all categories that have at least one active product in an active shop.
    """
    rows = (
        db.query(Category)
        .join(Product, Product.category_id == Category.id)
        .join(Shop, Product.shop_id == Shop.id)
        .filter(
            Product.is_active == True,
            Shop.is_active == True,
            Shop.slug == "exiuscart-dropshipping-system",
        )
        .distinct()
        .order_by(Category.name)
        .all()
    )
    return [{"id": c.id, "name": c.name, "slug": c.slug} for c in rows]
