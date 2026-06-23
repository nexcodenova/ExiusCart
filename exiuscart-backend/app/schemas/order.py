from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from decimal import Decimal


class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int
    unit_price: Decimal


class OrderItemResponse(BaseModel):
    id: int
    product_id: int
    quantity: int
    unit_price: Decimal
    total_price: Decimal

    class Config:
        from_attributes = True


class OrderCreate(BaseModel):
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    items: List[OrderItemCreate]
    notes: Optional[str] = None
    shipping_address: Optional[str] = None
    source: str = "pos"  # pos, whatsapp, online


class OrderUpdate(BaseModel):
    status: Optional[str] = None
    payment_status: Optional[str] = None
    notes: Optional[str] = None


class ShipOrderIn(BaseModel):
    tracking_number: Optional[str] = None
    carrier: Optional[str] = None
    estimated_delivery: Optional[str] = None
    delivery_charge: Optional[float] = None  # what the customer pays for delivery (orders < 10,000)


class OrderResponse(BaseModel):
    id: int
    order_number: str
    shop_id: int
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    status: str
    payment_status: str
    source: str
    subtotal: Decimal
    tax_amount: Decimal
    discount_amount: Decimal
    total: Decimal
    notes: Optional[str] = None
    shipping_address: Optional[str] = None
    tracking_number: Optional[str] = None
    carrier: Optional[str] = None
    delivery_charge: Optional[Decimal] = None
    shipped_at: Optional[datetime] = None
    estimated_delivery: Optional[str] = None
    items: List[OrderItemResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True
