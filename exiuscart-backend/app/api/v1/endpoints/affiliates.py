from fastapi import APIRouter, Depends, HTTPException, status, Header
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session
from jose import JWTError, jwt

from app.core.database import get_db
from app.core.security import create_access_token, get_password_hash, verify_password
from app.core.config import settings
from app.core.email import send_affiliate_dashboard_ready_email
from app.models.affiliate import Affiliate, Commission, PayoutRequest
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
    from datetime import datetime, timezone, timedelta
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

    now = datetime.now(timezone.utc)
    lock_cutoff = now - timedelta(days=30)

    all_commissions = db.query(Commission).filter(
        Commission.affiliate_id == affiliate.id
    ).all()

    locked_amount = 0.0
    pending_approval_amount = 0.0
    available_amount = 0.0
    paid_amount = 0.0

    for c in all_commissions:
        created = c.created_at
        if created and created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        if c.status == "paid":
            paid_amount += float(c.amount)
        elif c.status == "approved":
            available_amount += float(c.amount)
        elif c.status == "pending":
            if created and created > lock_cutoff:
                locked_amount += float(c.amount)
            else:
                pending_approval_amount += float(c.amount)

    total_earnings = locked_amount + pending_approval_amount + available_amount + paid_amount

    return {
        "total_signups": total_signups,
        "conversions": conversions,
        "total_clicks": affiliate.total_clicks or 0,
        "total_earnings": total_earnings,
        "locked_amount": locked_amount,
        "pending_approval_amount": pending_approval_amount,
        "available_amount": available_amount,
        "paid_amount": paid_amount,
        "currency": "USD",
    }


class PayoutDetailsIn(BaseModel):
    payout_method: str  # paypal | skrill | payoneer
    paypal_email: str = ""
    skrill_email: str = ""
    payoneer_id: str = ""


@router.get("/affiliates/me/payout-details")
def get_payout_details(
    affiliate: Affiliate = Depends(get_current_affiliate),
):
    return {
        "payout_method": affiliate.payout_method or "",
        "paypal_email": affiliate.paypal_email or "",
        "skrill_email": affiliate.skrill_email or "",
        "payoneer_id": affiliate.payoneer_id or "",
    }


@router.patch("/affiliates/me/payout-details")
def update_payout_details(
    data: PayoutDetailsIn,
    affiliate: Affiliate = Depends(get_current_affiliate),
    db: Session = Depends(get_db),
):
    affiliate.payout_method = data.payout_method
    affiliate.paypal_email = data.paypal_email or None
    affiliate.skrill_email = data.skrill_email or None
    affiliate.payoneer_id = data.payoneer_id or None
    db.commit()
    return {"message": "Payout details saved"}


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


# ── Payout request ────────────────────────────────────────────────────────────

@router.post("/affiliates/me/request-payout", status_code=201)
def request_payout(
    affiliate: Affiliate = Depends(get_current_affiliate),
    db: Session = Depends(get_db),
):
    from datetime import datetime, timezone, timedelta
    from app.core.email import send_affiliate_payout_requested_email

    if affiliate.status != "active":
        raise HTTPException(status_code=403, detail="Affiliate account is not active")

    # Check payout method is set
    payout_address = (
        affiliate.paypal_email if affiliate.payout_method == "paypal"
        else affiliate.skrill_email if affiliate.payout_method == "skrill"
        else affiliate.payoneer_id if affiliate.payout_method == "payoneer"
        else None
    )
    if not affiliate.payout_method or not payout_address:
        raise HTTPException(status_code=422, detail="Set your payout method in Profile before requesting a payout")

    # Calculate available (approved commissions not yet in a pending request)
    now = datetime.now(timezone.utc)
    approved_commissions = db.query(Commission).filter(
        Commission.affiliate_id == affiliate.id,
        Commission.status == "approved",
    ).all()
    available = sum(float(c.amount) for c in approved_commissions)

    if available < 100.0:
        raise HTTPException(
            status_code=422,
            detail=f"Minimum payout is $100. Your available balance is ${available:.2f}",
        )

    # Check no pending request already open
    existing = db.query(PayoutRequest).filter(
        PayoutRequest.affiliate_id == affiliate.id,
        PayoutRequest.status == "pending",
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="You already have a pending payout request")

    req = PayoutRequest(
        affiliate_id=affiliate.id,
        amount=available,
        currency="USD",
        payout_method=affiliate.payout_method,
        payout_address=payout_address,
        status="pending",
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    try:
        send_affiliate_payout_requested_email(
            to=affiliate.email,
            full_name=affiliate.name,
            amount=available,
            payout_method=affiliate.payout_method,
            payout_address=payout_address,
        )
    except Exception:
        pass

    return {
        "id": req.id,
        "amount": float(req.amount),
        "currency": req.currency,
        "payout_method": req.payout_method,
        "payout_address": req.payout_address,
        "status": req.status,
        "requested_at": req.requested_at,
    }


@router.get("/affiliates/me/payout-requests")
def get_payout_requests(
    affiliate: Affiliate = Depends(get_current_affiliate),
    db: Session = Depends(get_db),
):
    requests = db.query(PayoutRequest).filter(
        PayoutRequest.affiliate_id == affiliate.id,
    ).order_by(PayoutRequest.requested_at.desc()).all()
    return [
        {
            "id": r.id,
            "amount": float(r.amount),
            "currency": r.currency,
            "payout_method": r.payout_method,
            "payout_address": r.payout_address,
            "status": r.status,
            "admin_notes": r.admin_notes,
            "requested_at": r.requested_at,
            "paid_at": r.paid_at,
        }
        for r in requests
    ]


# ── Password change ───────────────────────────────────────────────────────────

class PasswordChangeIn(BaseModel):
    current_password: str
    new_password: str


@router.patch("/affiliates/me/password")
def change_password(
    data: PasswordChangeIn,
    affiliate: Affiliate = Depends(get_current_affiliate),
    db: Session = Depends(get_db),
):
    if not affiliate.password_hash or not verify_password(data.current_password, affiliate.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(data.new_password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")
    affiliate.password_hash = get_password_hash(data.new_password)
    db.commit()
    return {"message": "Password updated"}


# ── Click tracking (public redirect) ─────────────────────────────────────────

from fastapi.responses import RedirectResponse

@router.get("/affiliates/ref/{code}", include_in_schema=False)
def affiliate_ref_redirect(code: str, db: Session = Depends(get_db)):
    affiliate = db.query(Affiliate).filter(
        Affiliate.referral_code == code,
        Affiliate.status == "active",
    ).first()
    if affiliate:
        affiliate.total_clicks = (affiliate.total_clicks or 0) + 1
        db.commit()
    return RedirectResponse(
        url=f"https://exiuscart.com/register?ref={code}",
        status_code=302,
    )
