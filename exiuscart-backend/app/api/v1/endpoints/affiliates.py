from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import create_access_token
from app.models.affiliate import Affiliate

router = APIRouter()


class AffiliateLoginIn(BaseModel):
    email: str
    code: str  # referral code acts as the access key


@router.post("/affiliates/login")
def affiliate_login(data: AffiliateLoginIn, db: Session = Depends(get_db)):
    affiliate = db.query(Affiliate).filter(
        Affiliate.email == data.email.lower().strip(),
        Affiliate.referral_code == data.code.upper().strip(),
    ).first()

    if not affiliate:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or access code",
        )

    if affiliate.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your affiliate account is not yet approved",
        )

    token = create_access_token(
        data={"sub": f"affiliate:{affiliate.id}", "type": "affiliate"}
    )
    return {
        "access_token": token,
        "affiliate_id": affiliate.id,
        "name": affiliate.name,
        "referral_code": affiliate.referral_code,
        "email": affiliate.email,
    }
