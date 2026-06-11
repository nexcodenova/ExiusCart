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
from app.models.subscription import Subscription
from app.schemas.product import ProductCreate, ProductResponse, ProductUpdate, CategoryCreate, CategoryResponse
from app.api.v1.deps import get_current_user
from app.api.v1.endpoints.channels import trigger_product_sync, trigger_product_delete

PLAN_PRODUCT_LIMITS = {
    "trial": 50,
    "thedersi_basic": 50,   # free forever for TheDersi free sellers
    "starter": 1000,
    "business": 1000,
    "pro": -1,
    "premium": -1,
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


# Categories
@router.post("/categories", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
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


@router.get("/categories", response_model=List[CategoryResponse])
async def get_categories(
    shop_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Return only root categories — children are nested via relationship
    categories = db.query(Category).filter(
        Category.shop_id == shop_id,
        Category.parent_id == None
    ).order_by(Category.sort_order).all()
    return categories


@router.delete("/categories/{category_id}", status_code=status.HTTP_200_OK)
async def delete_category(
    category_id: int,
    shop_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    category = db.query(Category).filter(
        Category.id == category_id,
        Category.shop_id == shop_id
    ).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    # Move products to uncategorised instead of blocking or orphaning
    db.query(Product).filter(
        Product.category_id == category_id,
        Product.shop_id == shop_id
    ).update({"category_id": None})

    db.delete(category)
    db.commit()
    return {"message": "Category deleted. Products moved to uncategorised."}


# Products
@router.post("/", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
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

    # Plan limit enforcement
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

    # Push to all connected channels (TheDersi etc.) in background
    trigger_product_sync(new_product.id, shop_id, background_tasks)
    return new_product


@router.get("/", response_model=List[ProductResponse])
async def get_products(
    shop_id: int,
    category_id: Optional[int] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Product).filter(Product.shop_id == shop_id)

    if category_id:
        query = query.filter(Product.category_id == category_id)
    if search:
        query = query.filter(Product.name.ilike(f"%{search}%"))

    products = query.offset(skip).limit(limit).all()
    return products


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: int,
    shop_id: int,
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


@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: int,
    shop_id: int,
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

    # Sync updated product to all connected channels
    trigger_product_sync(product.id, shop_id, background_tasks)
    return product


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: int,
    shop_id: int,
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

    # Remove from all connected channels before deleting
    trigger_product_delete(product_id, shop_id, background_tasks)
    db.delete(product)
    db.commit()


@router.post("/bulk-import", response_model=BulkImportResult)
async def bulk_import_products(
    shop_id: int,
    rows: List[BulkProductRow],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Import multiple products from a parsed CSV payload."""
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    created = 0
    skipped = 0
    errors: list[str] = []

    # Cache category name → id
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
