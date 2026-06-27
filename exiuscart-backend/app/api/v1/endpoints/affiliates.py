from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from jose import JWTError, jwt

from app.core.database import get_db
from app.core.security import create_access_token, get_password_hash, verify_password
from app.core.config import settings
from app.core.email import send_affiliate_dashboard_ready_email
from app.models.affiliate import Affiliate

router = APIRouter()


class AffiliateLoginIn(BaseModel):
    email: str
    password: str


class AffiliateSetupIn(BaseModel):
    token: str
    password: str


def _affiliate_token_response(affiliate: Affiliate) -> dict:
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


@router.post("/affiliates/login")
def affiliate_login(data: AffiliateLoginIn, db: Session = Depends(get_db)):
    affiliate = db.query(Affiliate).filter(
        Affiliate.email == data.email.lower().strip(),
    ).first()

    if (
        not affiliate
        or not affiliate.password_hash
        or not verify_password(data.password, affiliate.password_hash)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if affiliate.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your affiliate account is not yet approved. Check your email for an approval notification.",
        )

    return _affiliate_token_response(affiliate)


@router.post("/affiliates/setup-password")
def affiliate_setup_password(data: AffiliateSetupIn, db: Session = Depends(get_db)):
    """
    Redeems the one-time setup link sent in the approval email.
    Sets the affiliate's password and returns an access token so they're immediately logged in.
    Also sends a 'dashboard ready' confirmation email.
    """
    try:
        payload = jwt.decode(
            data.token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except JWTError:
        raise HTTPException(status_code=400, detail="Setup link is invalid or has expired.")

    if payload.get("purpose") != "affiliate_setup":
        raise HTTPException(status_code=400, detail="Invalid setup link.")

    affiliate_id = payload.get("sub")
    affiliate = db.query(Affiliate).filter(Affiliate.id == int(affiliate_id)).first()
    if not affiliate:
        raise HTTPException(status_code=404, detail="Account not found.")

    if len(data.password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters.")

    affiliate.password_hash = get_password_hash(data.password)
    db.commit()
    db.refresh(affiliate)

    try:
        send_affiliate_dashboard_ready_email(
            to=affiliate.email,
            full_name=affiliate.name,
            referral_code=affiliate.referral_code,
        )
    except Exception:
        pass

    return _affiliate_token_response(affiliate)
