from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    phone: Optional[str] = None


class UserCreate(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    owner_name: Optional[str] = None  # alias sent by registration form
    phone: Optional[str] = None
    password: str
    ref_code: Optional[str] = None
    country: Optional[str] = None
    shop_name: Optional[str] = None  # creates a shop on registration
    # Set when arriving from the pricing page's "Try for free" CTA — starts
    # a real 7-day free trial for that exact plan (launch/growth/scale)
    # instead of the generic 14-day free_trial. None = organic signup,
    # unchanged behavior.
    plan_type: Optional[str] = None
    billing_type: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(UserBase):
    id: int
    is_active: bool
    is_superuser: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    is_superuser: bool = False
    user: UserResponse
