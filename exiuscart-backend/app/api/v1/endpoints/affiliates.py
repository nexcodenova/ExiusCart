from fastapi import APIRouter, Depends, HTTPException, status, Header
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session
from jose import JWTError, jwt

from app.core.database import get_db
from app.core.security import create_access_token, get_password_hash, verify_password
from app.core.config import settings
from app.core.email import send_affiliate_dashboard_ready_email
from app.models.affiliate import Affiliate, Commission
from app.models.user import User
from app.models.shop import Shop
from app.models.subscription import Subscription

router = APIRouter()


def get_current_affiliate(authorization: str = Header(None), db: Session = Depends(get_db)) -> Affiliate:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization[7:]
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    sub = payload.get("sub", "")
    if not sub.startswith("affiliate:"):
        raise HTTPException(status_code=401, detail="Invalid token type")
    affiliate_id = int(sub.split(":")[1])
    affiliate = db.query(Affiliate).filter(Affiliate.id == affiliate_id).first()
    if not affiliate:
        raise HTTPException(status_code=404, detail="Affiliate not found")
    return affiliate


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


@router.get("/affiliates/me/stats")
def affiliate_stats(
    affiliate: Affiliate = Depends(get_current_affiliate),
    db: Session = Depends(get_db),
):
    referred_users = db.query(User).filter(User.referred_by_code == affiliate.referral_code).all()
    total_signups = len(referred_users)

    conversions = 0
    for user in referred_users:
        shop = db.query(Shop).filter(Shop.owner_id == user.id).first()
        if shop:
            sub = db.query(Subscription).filter(
                Subscription.shop_id == shop.id,
                Subscription.status == "active",
            ).first()
            if sub:
                conversions += 1

    total_earnings = db.query(func.sum(Commission.amount)).filter(
        Commission.affiliate_id == affiliate.id
    ).scalar() or 0

    return {
        "total_signups": total_signups,
        "conversions": conversions,
        "total_earnings": float(total_earnings),
        "currency": "USD",
    }


@router.get("/affiliates/me/referrals")
def affiliate_referrals(
    affiliate: Affiliate = Depends(get_current_affiliate),
    db: Session = Depends(get_db),
):
    referred_users = (
        db.query(User)
        .filter(User.referred_by_code == affiliate.referral_code)
        .order_by(User.created_at.desc())
        .all()
    )

    result = []
    for user in referred_users:
        shop = db.query(Shop).filter(Shop.owner_id == user.id).first()
        sub = None
        if shop:
            sub = db.query(Subscription).filter(
                Subscription.shop_id == shop.id
            ).order_by(Subscription.id.desc()).first()

        commission = None
        if shop:
            commission = db.query(Commission).filter(
                Commission.affiliate_id == affiliate.id,
                Commission.shop_id == shop.id,
            ).first()

        result.append({
            "name": user.full_name,
            "email": user.email,
            "signed_up": user.created_at.isoformat() if user.created_at else None,
            "store_name": shop.name if shop else None,
            "plan": sub.plan_type if sub else None,
            "status": sub.status if sub else "registered",
            "commission": float(commission.amount) if commission else 0,
            "commission_status": commission.status if commission else None,
            "commission_currency": commission.currency if commission else "USD",
        })

    return result
