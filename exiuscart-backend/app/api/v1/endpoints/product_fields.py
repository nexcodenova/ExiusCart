"""
Custom product fields per shop + product image upload.
"""
from typing import List, Optional, Any
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.shop import Shop
from app.models.product import Product
from app.models.product_fields import ShopField, ProductAttribute, ProductImage
from app.models.product_variant import ProductVariant
from app.models.subscription import Subscription
from fastapi import Query
from app.core.storage import upload_image as storage_upload, delete_image as storage_delete, generate_presigned_url

router = APIRouter()

# ── Pydantic schemas ──────────────────────────────────────────────────────────

class FieldCreate(BaseModel):
    label: str
    field_key: str
    field_type: str   # text | number | dropdown | date | toggle | multiselect
    options: Optional[List[str]] = None
    is_required: bool = False
    sort_order: int = 0
    category_id: Optional[int] = None  # None = applies to all categories

class FieldUpdate(BaseModel):
    label: Optional[str] = None
    field_type: Optional[str] = None
    options: Optional[List[str]] = None
    is_required: Optional[bool] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None
    category_id: Optional[int] = None

class FieldOut(BaseModel):
    id: int
    label: str
    field_key: str
    field_type: str
    options: Optional[List[str]]
    is_required: bool
    sort_order: int
    is_active: bool
    category_id: Optional[int] = None

    class Config:
        from_attributes = True

class AttributeIn(BaseModel):
    field_key: str
    value: str

class ImageOut(BaseModel):
    id: int
    url: str
    alt_text: Optional[str]
    sort_order: int
    is_primary: bool

    class Config:
        from_attributes = True

# ── Helpers ───────────────────────────────────────────────────────────────────

def get_shop_or_404(shop_id: int, db: Session, current_user: User) -> Shop:
    shop = db.query(Shop).filter(Shop.id == shop_id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    if shop.owner_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized")
    return shop

def get_product_or_404(product_id: int, shop_id: int, db: Session) -> Product:
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.shop_id == shop_id
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

# ── Shop Fields CRUD ──────────────────────────────────────────────────────────

@router.get("/shops/{shop_id}/fields", response_model=List[FieldOut])
def get_fields(
    shop_id: int,
    category_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get fields for a shop. If category_id is given, returns fields scoped to
    that category PLUS global fields (category_id=NULL). This way a product
    form always gets global fields + its category-specific fields combined.
    """
    get_shop_or_404(shop_id, db, current_user)
    query = db.query(ShopField).filter(
        ShopField.shop_id == shop_id,
        ShopField.is_active == True
    )
    if category_id is not None:
        from sqlalchemy import or_
        query = query.filter(
            or_(ShopField.category_id == category_id, ShopField.category_id == None)
        )
    return query.order_by(ShopField.sort_order).all()


@router.post("/shops/{shop_id}/fields", response_model=FieldOut, status_code=201)
def create_field(
    shop_id: int,
    data: FieldCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_shop_or_404(shop_id, db, current_user)

    # Unique field_key per shop+category combination
    existing = db.query(ShopField).filter(
        ShopField.shop_id == shop_id,
        ShopField.field_key == data.field_key,
        ShopField.category_id == data.category_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Field key already exists for this shop/category")

    field = ShopField(
        shop_id=shop_id,
        category_id=data.category_id,
        label=data.label,
        field_key=data.field_key,
        field_type=data.field_type,
        options=data.options,
        is_required=data.is_required,
        sort_order=data.sort_order,
    )
    db.add(field)
    db.commit()
    db.refresh(field)
    return field


@router.put("/shops/{shop_id}/fields/{field_id}", response_model=FieldOut)
def update_field(
    shop_id: int,
    field_id: int,
    data: FieldUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_shop_or_404(shop_id, db, current_user)
    field = db.query(ShopField).filter(ShopField.id == field_id, ShopField.shop_id == shop_id).first()
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")

    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(field, key, val)
    db.commit()
    db.refresh(field)
    return field


@router.delete("/shops/{shop_id}/fields/{field_id}", status_code=204)
def delete_field(
    shop_id: int,
    field_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_shop_or_404(shop_id, db, current_user)
    field = db.query(ShopField).filter(ShopField.id == field_id, ShopField.shop_id == shop_id).first()
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")
    db.delete(field)
    db.commit()


@router.put("/shops/{shop_id}/fields/reorder", status_code=200)
def reorder_fields(
    shop_id: int,
    order: List[int],   # list of field IDs in new order
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_shop_or_404(shop_id, db, current_user)
    for idx, field_id in enumerate(order):
        db.query(ShopField).filter(
            ShopField.id == field_id,
            ShopField.shop_id == shop_id
        ).update({"sort_order": idx})
    db.commit()
    return {"message": "Reordered"}

# ── Product Attributes (custom field values) ──────────────────────────────────

@router.put("/shops/{shop_id}/products/{product_id}/attributes")
def save_attributes(
    shop_id: int,
    product_id: int,
    attributes: List[AttributeIn],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_shop_or_404(shop_id, db, current_user)
    get_product_or_404(product_id, shop_id, db)

    # Delete existing attributes for this product and re-save
    db.query(ProductAttribute).filter(ProductAttribute.product_id == product_id).delete()
    for attr in attributes:
        db.add(ProductAttribute(product_id=product_id, field_key=attr.field_key, value=attr.value))
    db.commit()
    return {"message": "Attributes saved"}


@router.get("/shops/{shop_id}/products/{product_id}/attributes")
def get_attributes(
    shop_id: int,
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_shop_or_404(shop_id, db, current_user)
    get_product_or_404(product_id, shop_id, db)
    attrs = db.query(ProductAttribute).filter(ProductAttribute.product_id == product_id).all()
    return {a.field_key: a.value for a in attrs}

# ── Product Images ────────────────────────────────────────────────────────────

IMAGES_DEFAULT = 6    # free / starter / thedersi_basic
IMAGES_PREMIUM = 15   # premium / thedersi_pro
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB


def _image_limit(shop_id: int, db: Session) -> int:
    """Return 15 for premium/thedersi_pro shops, 6 for all others."""
    sub = db.query(Subscription).filter(
        Subscription.shop_id == shop_id,
        Subscription.status == "active",
    ).first()
    if sub and sub.plan_type in ("premium", "thedersi_pro"):
        return IMAGES_PREMIUM
    return IMAGES_DEFAULT


def _combined_image_count(product_id: int, db: Session) -> int:
    """Main product images + variants that already have an image URL."""
    main = db.query(ProductImage).filter(ProductImage.product_id == product_id).count()
    variants_with_img = db.query(ProductVariant).filter(
        ProductVariant.product_id == product_id,
        ProductVariant.image_url.isnot(None),
        ProductVariant.image_url != "",
    ).count()
    return main + variants_with_img


@router.get("/shops/{shop_id}/image-limit")
def get_image_limit(
    shop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_shop_or_404(shop_id, db, current_user)
    return {"limit": _image_limit(shop_id, db)}


@router.get("/shops/{shop_id}/products/{product_id}/images", response_model=List[ImageOut])
def get_images(
    shop_id: int,
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_shop_or_404(shop_id, db, current_user)
    get_product_or_404(product_id, shop_id, db)
    return db.query(ProductImage).filter(
        ProductImage.product_id == product_id
    ).order_by(ProductImage.sort_order).all()


class ConfirmImageBody(BaseModel):
    url: str
    content_type: str = "image/jpeg"


@router.get("/shops/{shop_id}/products/{product_id}/images/presign")
def presign_product_image(
    shop_id: int,
    product_id: int,
    content_type: str = Query("image/jpeg"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return a presigned PUT URL so the browser uploads directly to R2."""
    get_shop_or_404(shop_id, db, current_user)
    get_product_or_404(product_id, shop_id, db)
    limit = _image_limit(shop_id, db)
    if _combined_image_count(product_id, db) >= limit:
        raise HTTPException(status_code=400, detail=f"Image limit reached ({limit} total across main + variants)")
    ext = content_type.split("/")[-1].replace("jpeg", "jpg")
    return generate_presigned_url(shop_id, product_id, ext, content_type)


@router.post("/shops/{shop_id}/products/{product_id}/images/confirm", response_model=ImageOut, status_code=201)
def confirm_product_image(
    shop_id: int,
    product_id: int,
    body: ConfirmImageBody,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """After browser uploads directly to R2, register the URL in the DB."""
    get_shop_or_404(shop_id, db, current_user)
    get_product_or_404(product_id, shop_id, db)
    limit = _image_limit(shop_id, db)
    if _combined_image_count(product_id, db) >= limit:
        raise HTTPException(status_code=400, detail=f"Image limit reached ({limit} total)")
    count = db.query(ProductImage).filter(ProductImage.product_id == product_id).count()
    is_primary = count == 0
    image = ProductImage(product_id=product_id, url=body.url, sort_order=count, is_primary=is_primary)
    db.add(image)
    if is_primary:
        product_obj = get_product_or_404(product_id, shop_id, db)
        product_obj.image_url = body.url
    db.commit()
    db.refresh(image)
    from app.api.v1.endpoints.channels import trigger_product_sync
    trigger_product_sync(product_id, shop_id, background_tasks)
    return image


@router.get("/shops/{shop_id}/products/{product_id}/variant-image/presign")
def presign_variant_image(
    shop_id: int,
    product_id: int,
    content_type: str = Query("image/jpeg"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return a presigned PUT URL for a variant image upload."""
    get_shop_or_404(shop_id, db, current_user)
    get_product_or_404(product_id, shop_id, db)
    limit = _image_limit(shop_id, db)
    if _combined_image_count(product_id, db) >= limit:
        raise HTTPException(status_code=400, detail=f"Image limit reached ({limit} total across main + variants)")
    ext = content_type.split("/")[-1].replace("jpeg", "jpg")
    return generate_presigned_url(shop_id, product_id, ext, content_type)


@router.get("/shops/{shop_id}/products/{product_id}/size-chart/presign")
def presign_size_chart_image(
    shop_id: int,
    product_id: int,
    content_type: str = Query("image/jpeg"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Presigned PUT URL for the product's single size chart image — a
    separate field on Product, not counted against the gallery image limit."""
    get_shop_or_404(shop_id, db, current_user)
    get_product_or_404(product_id, shop_id, db)
    ext = content_type.split("/")[-1].replace("jpeg", "jpg")
    return generate_presigned_url(shop_id, product_id, ext, content_type)


@router.post("/shops/{shop_id}/products/{product_id}/images", response_model=ImageOut, status_code=201)
async def upload_image(
    shop_id: int,
    product_id: int,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_shop_or_404(shop_id, db, current_user)
    get_product_or_404(product_id, shop_id, db)

    limit = _image_limit(shop_id, db)
    combined = _combined_image_count(product_id, db)
    if combined >= limit:
        raise HTTPException(status_code=400, detail=f"Image limit reached ({limit} total across main + variants)")

    count = db.query(ProductImage).filter(ProductImage.product_id == product_id).count()

    # Validate file type
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, WebP, and GIF images are allowed")

    # Read and check file size
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size must be under 5MB")

    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "jpg"
    try:
        url = storage_upload(contents, shop_id, product_id, ext, content_type=file.content_type or "image/jpeg")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Image upload failed: {exc}")
    is_primary = count == 0  # first image is primary

    image = ProductImage(
        product_id=product_id,
        url=url,
        sort_order=count,
        is_primary=is_primary,
    )
    db.add(image)

    if is_primary:
        product_obj = get_product_or_404(product_id, shop_id, db)
        product_obj.image_url = url

    db.commit()
    db.refresh(image)

    # Re-sync to connected channels so the product reaches them WITH its image.
    # (Initial product create syncs before images exist; this fills them in.)
    from app.api.v1.endpoints.channels import trigger_product_sync
    trigger_product_sync(product_id, shop_id, background_tasks)

    return image


@router.delete("/shops/{shop_id}/products/{product_id}/images/{image_id}", status_code=204)
def delete_image(
    shop_id: int,
    product_id: int,
    image_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_shop_or_404(shop_id, db, current_user)
    image = db.query(ProductImage).filter(
        ProductImage.id == image_id,
        ProductImage.product_id == product_id
    ).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    was_primary = image.is_primary
    storage_delete(image.url)
    db.delete(image)
    db.flush()

    if was_primary:
        next_img = db.query(ProductImage).filter(
            ProductImage.product_id == product_id
        ).order_by(ProductImage.sort_order).first()
        product_obj = db.query(Product).filter(Product.id == product_id).first()
        if next_img:
            next_img.is_primary = True
            if product_obj:
                product_obj.image_url = next_img.url
        elif product_obj:
            product_obj.image_url = None

    db.commit()


@router.put("/shops/{shop_id}/products/{product_id}/images/{image_id}/primary", status_code=200)
def set_primary_image(
    shop_id: int,
    product_id: int,
    image_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_shop_or_404(shop_id, db, current_user)
    get_product_or_404(product_id, shop_id, db)

    # Unset all primary
    db.query(ProductImage).filter(ProductImage.product_id == product_id).update({"is_primary": False})
    # Set new primary
    db.query(ProductImage).filter(ProductImage.id == image_id).update({"is_primary": True})

    new_primary = db.query(ProductImage).filter(ProductImage.id == image_id).first()
    if new_primary:
        product_obj = db.query(Product).filter(Product.id == product_id, Product.shop_id == shop_id).first()
        if product_obj:
            product_obj.image_url = new_primary.url

    db.commit()
    return {"message": "Primary image updated"}


@router.post("/shops/{shop_id}/products/{product_id}/variant-image")
async def upload_variant_image(
    shop_id: int,
    product_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload an image for a specific variant and return its R2 URL (no ProductImage record created)."""
    get_shop_or_404(shop_id, db, current_user)
    get_product_or_404(product_id, shop_id, db)

    limit = _image_limit(shop_id, db)
    combined = _combined_image_count(product_id, db)
    if combined >= limit:
        raise HTTPException(status_code=400, detail=f"Image limit reached ({limit} total across main + variants)")

    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, WebP, and GIF images are allowed")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size must be under 5MB")

    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "jpg"
    try:
        url = storage_upload(contents, shop_id, product_id, ext, content_type=file.content_type or "image/jpeg")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Image upload failed: {exc}")

    return {"url": url}
