from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime


class DiscountBase(BaseModel):
    code: str
    discount_type: str  # "percentage" | "fixed"
    value: float
    min_order_amount: Optional[float] = None
    usage_limit: Optional[int] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    is_active: bool = True

    @field_validator("code")
    @classmethod
    def _normalize_code(cls, v: str) -> str:
        v = v.strip().upper()
        if not v:
            raise ValueError("Code can't be empty.")
        return v

    @field_validator("discount_type")
    @classmethod
    def _valid_type(cls, v: str) -> str:
        if v not in ("percentage", "fixed"):
            raise ValueError("discount_type must be 'percentage' or 'fixed'.")
        return v

    @field_validator("value")
    @classmethod
    def _positive_value(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Value must be greater than 0.")
        return v


class DiscountCreate(DiscountBase):
    pass


class DiscountUpdate(BaseModel):
    code: Optional[str] = None
    discount_type: Optional[str] = None
    value: Optional[float] = None
    min_order_amount: Optional[float] = None
    usage_limit: Optional[int] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    is_active: Optional[bool] = None


class DiscountResponse(DiscountBase):
    id: int
    shop_id: int
    times_used: int
    created_at: datetime

    class Config:
        from_attributes = True
