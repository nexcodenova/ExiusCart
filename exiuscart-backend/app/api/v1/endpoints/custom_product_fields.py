"""
Seller-defined extra product fields for the Custom Website channel — e.g.
"Quantity Tiers" or "Gift Wrap Available". The seller builds this schema
once in the dashboard (same idea as the Signup Forms field builder); the
values for each field then get filled in per product on the Products
page, and are read from Product.custom_field_values.
"""

import logging
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.models.custom_product_fields import CustomProductFieldSettings, CUSTOM_FIELD_TYPES
from app.api.v1.deps import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


def _shop_or_404(shop_id: int, user: User, db: Session):
    from app.models.shop import Shop
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


class CustomFieldIn(BaseModel):
    id: str
    label: str
    type: str
    required: bool = False
    options: Optional[List[str]] = None


class CustomFieldSettingsIn(BaseModel):
    fields: List[CustomFieldIn]


@router.get("/shops/{shop_id}/custom-website/field-definitions")
def get_custom_field_definitions(shop_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _shop_or_404(shop_id, current_user, db)
    settings = db.query(CustomProductFieldSettings).filter(CustomProductFieldSettings.shop_id == shop_id).first()
    return {"fields": settings.fields if settings else []}


@router.put("/shops/{shop_id}/custom-website/field-definitions")
def set_custom_field_definitions(
    shop_id: int, data: CustomFieldSettingsIn,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    for f in data.fields:
        if f.type not in CUSTOM_FIELD_TYPES:
            raise HTTPException(status_code=422, detail=f"Field type must be one of {sorted(CUSTOM_FIELD_TYPES)}")
        if f.type == "dropdown" and not f.options:
            raise HTTPException(status_code=422, detail=f"Dropdown field '{f.label}' needs at least one option.")

    settings = db.query(CustomProductFieldSettings).filter(CustomProductFieldSettings.shop_id == shop_id).first()
    if not settings:
        settings = CustomProductFieldSettings(shop_id=shop_id)
        db.add(settings)
    settings.fields = [f.model_dump() for f in data.fields]
    db.commit()
    return {"fields": settings.fields}
