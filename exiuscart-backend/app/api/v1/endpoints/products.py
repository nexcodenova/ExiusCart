from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from slugify import slugify
from pydantic import BaseModel
import uuid
from app.core.database import get_db
from app.models.user import User
from app.models.shop import Shop
from app.models.product import Product, Category
from app.models.product_variant import ProductVariant
from app.models.subscription import Subscription
from app.schemas.product import ProductCreate, ProductResponse, ProductUpdate, CategoryCreate, CategoryResponse
from app.api.v1.deps import get_current_user
from app.api.v1.endpoints.channels import trigger_product_sync, trigger_product_delete

PLAN_PRODUCT_LIMITS = {
    "free_trial":     25,
    "thedersi_basic": 25,
    "starter":        1000,
    "thedersi_pro":   1000,
    "premium":        -1,    # unlimited
}


class BulkProductRow(BaseModel):
    name: str
    sku: Optional[str] = None
    price: float
    cost_price: Optional[float] = None
    quantity: int = 0
    low_stock_threshold: int = 5
    description: Optional[str] = None
    category: Optional[str] = None  # category name — will be created if missing


class BulkImportResult(BaseModel):
    created: int
    skipped: int
    errors: List[str]

router = APIRouter()


def generate_slug(name: str) -> str:
    base_slug = slugify(name)
    return f"{base_slug}-{uuid.uuid4().hex[:6]}"


# ── Categories ─────────────────────────────────────────────────────────────────

@router.post("/shops/{shop_id}/products/categories", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    shop_id: int,
    category_data: CategoryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    if category_data.parent_id:
        parent = db.query(Category).filter(
            Category.id == category_data.parent_id,
            Category.shop_id == shop_id
        ).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent category not found")

    new_category = Category(
        name=category_data.name,
        description=category_data.description,
        parent_id=category_data.parent_id,
        sort_order=category_data.sort_order,
        slug=generate_slug(category_data.name),
        shop_id=shop_id
    )
    db.add(new_category)
    db.commit()
    db.refresh(new_category)
    return new_category


@router.get("/shops/{shop_id}/products/categories", response_model=List[CategoryResponse])
async def get_categories(
    shop_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    categories = db.query(Category).filter(
        Category.shop_id == shop_id,
        Category.parent_id == None
    ).order_by(Category.sort_order).all()
    return categories


@router.delete("/shops/{shop_id}/products/categories/{category_id}", status_code=status.HTTP_200_OK)
async def delete_category(
    shop_id: int,
    category_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    category = db.query(Category).filter(
        Category.id == category_id,
        Category.shop_id == shop_id
    ).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    db.query(Product).filter(
        Product.category_id == category_id,
        Product.shop_id == shop_id
    ).update({"category_id": None})

    db.delete(category)
    db.commit()
    return {"message": "Category deleted. Products moved to uncategorised."}


# ── Products ───────────────────────────────────────────────────────────────────

@router.post("/shops/{shop_id}/products/bulk-import", response_model=BulkImportResult)
async def bulk_import_products(
    shop_id: int,
    rows: List[BulkProductRow],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    created = 0
    skipped = 0
    errors: list[str] = []
    cat_cache: dict[str, int] = {}

    for i, row in enumerate(rows):
        try:
            if not row.name.strip():
                skipped += 1
                continue

            category_id = None
            if row.category:
                cat_name = row.category.strip()
                if cat_name not in cat_cache:
                    cat_obj = db.query(Category).filter(
                        Category.shop_id == shop_id,
                        Category.name == cat_name,
                    ).first()
                    if not cat_obj:
                        cat_obj = Category(
                            name=cat_name,
                            slug=generate_slug(cat_name),
                            shop_id=shop_id,
                        )
                        db.add(cat_obj)
                        db.flush()
                    cat_cache[cat_name] = cat_obj.id
                category_id = cat_cache[cat_name]

            new_product = Product(
                name=row.name.strip(),
                sku=row.sku or None,
                price=row.price,
                cost_price=row.cost_price,
                quantity=row.quantity,
                low_stock_threshold=row.low_stock_threshold,
                description=row.description or None,
                category_id=category_id,
                slug=generate_slug(row.name),
                shop_id=shop_id,
            )
            db.add(new_product)
            created += 1
        except Exception as exc:
            errors.append(f"Row {i + 1} ({row.name!r}): {exc}")
            skipped += 1

    db.commit()
    return BulkImportResult(created=created, skipped=skipped, errors=errors)


@router.post("/shops/{shop_id}/products", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    shop_id: int,
    product_data: ProductCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    subscription = db.query(Subscription).filter(Subscription.shop_id == shop_id).first()
    if subscription:
        plan_key = subscription.plan_type.lower()
        limit = PLAN_PRODUCT_LIMITS.get(plan_key, 50)
        if limit != -1:
            current_count = db.query(Product).filter(Product.shop_id == shop_id).count()
            if current_count >= limit:
                raise HTTPException(
                    status_code=403,
                    detail=f"Product limit reached for your plan ({limit} products). Please upgrade."
                )

    new_product = Product(
        **product_data.model_dump(),
        slug=generate_slug(product_data.name),
        shop_id=shop_id
    )
    db.add(new_product)
    db.commit()
    db.refresh(new_product)

    trigger_product_sync(new_product.id, shop_id, background_tasks)
    return new_product


@router.get("/shops/{shop_id}/products", response_model=List[ProductResponse])
async def get_products(
    shop_id: int,
    category: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Product).filter(Product.shop_id == shop_id)

    if category:
        cat_obj = db.query(Category).filter(
            Category.shop_id == shop_id,
            Category.name == category
        ).first()
        if cat_obj:
            query = query.filter(Product.category_id == cat_obj.id)

    if search:
        query = query.filter(Product.name.ilike(f"%{search}%"))

    products = query.offset(skip).limit(limit).all()
    return products


@router.get("/shops/{shop_id}/products/{product_id}", response_model=ProductResponse)
async def get_product(
    shop_id: int,
    product_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.shop_id == shop_id
    ).first()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.put("/shops/{shop_id}/products/{product_id}", response_model=ProductResponse)
async def update_product(
    shop_id: int,
    product_id: int,
    product_data: ProductUpdate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.shop_id == shop_id
    ).first()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    update_data = product_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(product, field, value)

    db.commit()
    db.refresh(product)

    trigger_product_sync(product.id, shop_id, background_tasks)
    return product


@router.delete("/shops/{shop_id}/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    shop_id: int,
    product_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.shop_id == shop_id
    ).first()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    trigger_product_delete(product_id, shop_id, background_tasks)
    db.delete(product)
    db.commit()


# ── Product Variants ──────────────────────────────────────────────────────────

class VariantIn(BaseModel):
    size: Optional[str] = None
    color: Optional[str] = None
    sku: Optional[str] = None
    quantity: int = 0
    price: Optional[float] = None


class VariantOut(BaseModel):
    id: int
    size: Optional[str]
    color: Optional[str]
    sku: Optional[str]
    quantity: int
    price: Optional[float]

    class Config:
        from_attributes = True


@router.get("/shops/{shop_id}/products/{product_id}/variants", response_model=List[VariantOut])
def get_variants(
    shop_id: int,
    product_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.id == product_id, Product.shop_id == shop_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product.variants


@router.put("/shops/{shop_id}/products/{product_id}/variants", response_model=List[VariantOut])
def save_variants(
    shop_id: int,
    product_id: int,
    variants: List[VariantIn],
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.id == product_id, Product.shop_id == shop_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    db.query(ProductVariant).filter(ProductVariant.product_id == product_id).delete()
    new_variants = []
    for v in variants:
        pv = ProductVariant(
            product_id=product_id,
            size=v.size,
            color=v.color,
            sku=v.sku,
            quantity=v.quantity,
            price=v.price,
        )
        db.add(pv)
        new_variants.append(pv)
    db.commit()
    for pv in new_variants:
        db.refresh(pv)

    trigger_product_sync(product_id, shop_id, background_tasks)
    return new_variants
