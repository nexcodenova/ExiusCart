from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.shop import Shop

router = APIRouter()


@router.get("/public/stats")
def public_stats(db: Session = Depends(get_db)):
    """No-auth endpoint — returns live platform stats for the marketing site."""
    active_shops = db.query(Shop).filter(Shop.is_active == True).count()
    return {"active_shops": active_shops}
