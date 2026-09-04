"""
Seller-facing Meta Ad Library search — same shared core the admin-side
Prodora curation flow uses (app/core/meta_ad_library.py), just shop-scoped
auth instead of require_superuser. Lets a seller check whether a product
they're considering is already being advertised for real, before they
commit to listing it — a lightweight validation signal, same spirit as
the admin side's ad-proof-gathering for winning-products.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.meta_ad_library import search_meta_ad_library
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.api.v1.endpoints.channels import _shop_or_404

router = APIRouter()


@router.get("/shops/{shop_id}/meta-ads/search")
async def shop_meta_ads_search(
    shop_id: int,
    q: str,
    country: str = "US",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _shop_or_404(shop_id, current_user, db)
    ads = await search_meta_ad_library(q, country)
    return {"ads": ads}
