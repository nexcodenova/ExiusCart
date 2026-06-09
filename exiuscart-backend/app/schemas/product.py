from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from decimal import Decimal


class CategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    parent_id: Optional[int] = None
    sort_order: int = 0


class CategoryCreate(CategoryBase):
    pass


class CategoryResponse(CategoryBase):
    id: int
    slug: str
    shop_id: int
    is_active: bool
    created_at: datetime
    children: Optional[List["CategoryResponse"]] = []

    class Config:
        from_attributes = True


CategoryResponse.model_rebuild()


class ProductBase(BaseModel):
    name: str
    description: Optional[str] = None
    sku: Optional[str] = None
    barcode: Optional[str] = None
    price: Decimal
    cost_price: Optional[Decimal] = None
    quantity: int = 0
    low_stock_threshold: int = 5
    category_id: Optional[int] = None


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    sku: Optional[str] = None
    barcode: Optional[str] = None
    price: Optional[Decimal] = None
    cost_price: Optional[Decimal] = None
    quantity: Optional[int] = None
    low_stock_threshold: Optional[int] = None
    category_id: Optional[int] = None
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    is_active: Optional[bool] = None
    is_featured: Optional[bool] = None
    is_trending: Optional[bool] = None


class ProductResponse(ProductBase):
    id: int
    slug: str
    shop_id: int
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    is_active: bool
    is_featured: bool
    is_trending: bool = False
    created_at: datetime
    category: Optional[CategoryResponse] = None

    class Config:
        from_attributes = True
