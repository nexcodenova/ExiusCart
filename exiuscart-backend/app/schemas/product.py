from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from decimal import Decimal

# Fixed icon keys a product highlight can use — kept small and curated
# (not freeform) so every consuming storefront (Custom Website/ODTSI, or
# any future one) can map each key to a real icon component instead of
# trusting arbitrary seller input. Values are lucide-react names since
# that's what ExiusCart's own dashboard already uses throughout.
PRODUCT_HIGHLIGHT_ICONS = (
    "clock", "calendar", "mail", "truck", "package", "shield",
    "download", "check-circle", "refresh-cw", "star", "gift", "tag",
)


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
    compare_at_price: Optional[Decimal] = None   # original price before discount
    cost_price: Optional[Decimal] = None
    quantity: int = 0
    low_stock_threshold: int = 5
    category_id: Optional[int] = None
    supplier_id: Optional[int] = None
    list_on_marketplace: bool = True  # off = product stays in POS/inventory only, never sent to TheDersi
    is_gift: bool = False  # TheDersi-specific: offered as a free gift at TheDersi checkout
    pos_enabled: bool = True  # available for in-store POS sale
    pos_is_gift: bool = False  # marked as a gift item specifically for POS
    custom_field_values: Optional[Dict[str, Any]] = None  # Custom Website channel's seller-defined fields
    product_type: str = "physical"  # "physical" | "digital" | "affiliate"
    digital_file_url: Optional[str] = None
    digital_file_name: Optional[str] = None
    digital_email_subject: Optional[str] = None  # override the default delivery-email subject
    digital_email_message: Optional[str] = None  # override the default delivery-email greeting/message
    affiliate_url: Optional[str] = None
    affiliate_cta_text: Optional[str] = None
    faq: Optional[List[Dict[str, str]]] = None  # [{question, answer}, ...]
    shipping_note: Optional[str] = None
    shipping_steps: Optional[List[str]] = None  # ["Order confirmed", "Packed", ...]
    seo_keywords: Optional[List[str]] = None
    highlights: Optional[List[Dict[str, str]]] = None  # [{icon, label}, ...] — icon from PRODUCT_HIGHLIGHT_ICONS


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    sku: Optional[str] = None
    barcode: Optional[str] = None
    price: Optional[Decimal] = None
    compare_at_price: Optional[Decimal] = None
    cost_price: Optional[Decimal] = None
    quantity: Optional[int] = None
    low_stock_threshold: Optional[int] = None
    category_id: Optional[int] = None
    supplier_id: Optional[int] = None
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    size_chart_url: Optional[str] = None
    is_active: Optional[bool] = None
    is_featured: Optional[bool] = None
    is_trending: Optional[bool] = None
    list_on_marketplace: Optional[bool] = None
    is_gift: Optional[bool] = None
    pos_enabled: Optional[bool] = None
    pos_is_gift: Optional[bool] = None
    custom_field_values: Optional[Dict[str, Any]] = None
    product_type: Optional[str] = None
    digital_file_url: Optional[str] = None
    digital_file_name: Optional[str] = None
    digital_email_subject: Optional[str] = None
    digital_email_message: Optional[str] = None
    affiliate_url: Optional[str] = None
    affiliate_cta_text: Optional[str] = None
    faq: Optional[List[Dict[str, str]]] = None
    shipping_note: Optional[str] = None
    shipping_steps: Optional[List[str]] = None
    seo_keywords: Optional[List[str]] = None
    highlights: Optional[List[Dict[str, str]]] = None


class SupplierRef(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class ProductResponse(ProductBase):
    id: int
    slug: str
    shop_id: int
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    size_chart_url: Optional[str] = None
    is_active: bool
    is_featured: bool
    is_trending: bool = False
    is_bundle: bool = False
    created_at: datetime
    category: Optional[CategoryResponse] = None
    supplier_id: Optional[int] = None
    supplier: Optional[SupplierRef] = None
    is_dropship_imported: bool = False

    @property
    def discount_percent(self) -> Optional[int]:
        if self.compare_at_price and self.compare_at_price > self.price:
            return round((1 - float(self.price) / float(self.compare_at_price)) * 100)
        return None

    class Config:
        from_attributes = True
