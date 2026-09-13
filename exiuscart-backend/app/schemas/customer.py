from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List
from datetime import datetime


class CustomerBase(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    notes: Optional[str] = None


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None
    is_active: Optional[bool] = None


class CustomerResponse(CustomerBase):
    id: int
    shop_id: int
    is_active: bool
    tags: List[str] = []
    created_at: datetime

    @field_validator("tags", mode="before")
    @classmethod
    def _default_tags(cls, v):
        # The tags column is nullable (rows created before this feature, or
        # never tagged) — treat NULL the same as an empty list rather than
        # failing validation.
        return v or []

    class Config:
        from_attributes = True
