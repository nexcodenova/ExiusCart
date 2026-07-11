from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class ShopBase(BaseModel):
    name: str
    description: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: str = "UAE"
    currency: str = "AED"
    tax_number: Optional[str] = None


class ShopCreate(ShopBase):
    pass


class ShopUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    city: Optional[str] = None
    tax_number: Optional[str] = None
    trade_license: Optional[str] = None
    website: Optional[str] = None
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    currency: Optional[str] = None
    vat_enabled: Optional[bool] = None
    vat_rate: Optional[float] = None
    prices_include_vat: Optional[bool] = None
    show_vat_breakdown: Optional[bool] = None
    # Storefront / TheDersi profile
    about_text: Optional[str] = None
    social_instagram: Optional[str] = None
    social_tiktok: Optional[str] = None
    social_facebook: Optional[str] = None
    brand_color: Optional[str] = None
    # ExiusCart dashboard theme
    accent_color: Optional[str] = None
    font_family: Optional[str] = None


class ShopResponse(ShopBase):
    id: int
    slug: str
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    vat_enabled: bool = False
    vat_rate: float = 0.0
    prices_include_vat: bool = False
    show_vat_breakdown: bool = False
    # Storefront / TheDersi profile
    about_text: Optional[str] = None
    social_instagram: Optional[str] = None
    social_tiktok: Optional[str] = None
    social_facebook: Optional[str] = None
    brand_color: Optional[str] = None
    # ExiusCart dashboard theme
    accent_color: Optional[str] = None
    font_family: Optional[str] = None
    is_active: bool
    owner_id: int
    created_at: datetime

    class Config:
        from_attributes = True
