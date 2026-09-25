import re
import uuid
import random
import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Request
import jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.email import send_welcome_email, send_thedersi_welcome_email, send_otp_email, send_new_signup_notification
from app.core.thedersi import is_thedersi_shop
from app.core.audit_log import record_audit_event
from app.models.user import User
from app.models.shop import Shop
from app.models.subscription import Subscription
from app.models.email_otp import EmailOTP
from app.schemas.user import UserCreate, UserResponse, UserLogin, Token

THEDERSI_STAFF_DOMAIN = "@thedersi.lk"

logger = logging.getLogger(__name__)
_email_pool = ThreadPoolExecutor(max_workers=2)


def _slugify(text: str) -> str:
    return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')

router = APIRouter()


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        # If account exists but never verified → resend OTP so they can complete signup
        if not existing_user.is_verified:
            otp_code = f"{random.randint(100000, 999999)}"
            db.query(EmailOTP).filter(EmailOTP.user_id == existing_user.id).delete()
            otp = EmailOTP(
                user_id=existing_user.id,
                otp_code=otp_code,
                expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
            )
            db.add(otp)
            db.commit()
            _email_pool.submit(send_otp_email, existing_user.email, existing_user.full_name or "", otp_code)
            return {"status": "otp_sent", "email": existing_user.email}
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    display_name = user_data.owner_name or user_data.full_name or "Store Owner"
    is_thedersi_staff = user_data.email.lower().endswith(THEDERSI_STAFF_DOMAIN)

    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        email=user_data.email,
        hashed_password=hashed_password,
        full_name=display_name,
        phone=user_data.phone,
        referred_by_code=user_data.ref_code or None,
        country=user_data.country or None,
    )
    db.add(new_user)
    db.flush()

    # Auto-create shop for every new user
    if True:
        shop_name = user_data.shop_name or f"{display_name}'s Store"
        slug = f"{_slugify(shop_name)}-{uuid.uuid4().hex[:6]}"
        # Direct ExiusCart signups always default to USD, regardless of
        # country — sellers can change this anytime in Settings. Only
        # @thedersi.lk staff accounts default to LKR (TheDersi's own market).
        currency = "LKR" if is_thedersi_staff else "USD"
        shop = Shop(
            name=shop_name,
            slug=slug,
            owner_id=new_user.id,
            currency=currency,
            country=user_data.country or "UAE",
        )
        db.add(shop)
        db.flush()  # get shop.id before creating subscription

        # @thedersi.lk staff → scale, active immediately, never expires
        if is_thedersi_staff:
            now = datetime.now(timezone.utc)
            sub = Subscription(
                shop_id=shop.id,
                plan_type="scale",
                billing_type="yearly",
                status="active",
                amount_paid=0,
                currency=currency,
                promo_code="domain_thedersi",  # marks source as domain-grant
                starts_at=now,
                expires_at=None,               # never expires
            )
            db.add(sub)
            logger.info(f"[domain_thedersi] scale granted to {new_user.email}")
        elif user_data.plan_type in ("growth", "scale"):
            # Arrived from the pricing page's Growth/Scale "Try for $1" CTA.
            # No free week for these two — the account exists, but no
            # subscription is created yet. Once the email is verified (or,
            # for a social signup, immediately), the frontend sends the
            # seller straight to a real Lemon Squeezy $1 checkout for this
            # shop (POST /shops/{shop_id}/subscription/checkout); the
            # subscription only comes into existence once that payment
            # actually succeeds, same as everywhere else a card is charged.
            pass
        else:
            # Arrived from the pricing page's Launch "Try for free" CTA, or
            # an organic signup with no plan at all — a real 7-day free
            # trial, no payment info at all, immediate access once the email
            # is verified (no admin approval gate — making a signup wait on
            # manual review kills conversion for something that costs
            # nothing and requires no card).
            from app.core.lemonsqueezy import TRIAL_FREE_DAYS
            now = datetime.now(timezone.utc)
            trial_ends = now + timedelta(days=TRIAL_FREE_DAYS)
            trial_sub = Subscription(
                shop_id=shop.id,
                plan_type="launch",
                billing_type=user_data.billing_type or "monthly",
                status="trial",
                amount_paid=0,
                currency=currency,
                starts_at=now,
                trial_ends_at=trial_ends,
                expires_at=trial_ends,
            )
            db.add(trial_sub)

    db.commit()
    db.refresh(new_user)

    # TheDersi staff: auto-verified, return token immediately
    if is_thedersi_staff:
        _email_pool.submit(send_thedersi_welcome_email, new_user.email, new_user.full_name or "")
        access_token = create_access_token(data={"sub": str(new_user.id)})
        return Token(access_token=access_token, user=UserResponse.model_validate(new_user))

    # Regular users: send OTP, require verification
    new_user.is_verified = False
    otp_code = f"{random.randint(100000, 999999)}"
    otp = EmailOTP(
        user_id=new_user.id,
        otp_code=otp_code,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
    )
    db.add(otp)
    db.commit()

    _email_pool.submit(send_otp_email, new_user.email, new_user.full_name or "", otp_code)

    return {"status": "otp_sent", "email": new_user.email}


class VerifyOTPIn(BaseModel):
    email: str
    otp_code: str
    # Mirrors register()'s plan_type — a growth/scale $1-checkout signup
    # must not get papered over with a free trial by the fallback below.
    plan_type: Optional[str] = None


@router.post("/verify-otp", response_model=Token)
def verify_otp(data: VerifyOTPIn, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Account not found")

    now = datetime.now(timezone.utc)
    otp = (
        db.query(EmailOTP)
        .filter(
            EmailOTP.user_id == user.id,
            EmailOTP.otp_code == data.otp_code,
            EmailOTP.is_used == False,
            EmailOTP.expires_at > now,
        )
        .order_by(EmailOTP.created_at.desc())
        .first()
    )
    if not otp:
        raise HTTPException(status_code=400, detail="Invalid or expired code. Please try again.")

    otp.is_used = True
    user.is_verified = True

    # Immediate access on email verification — no admin approval gate. A
    # signup that costs nothing and needs no card should never sit waiting
    # on manual review; that's pure lost conversion. register() already
    # creates a real "trial" subscription for a specific plan (Launch); this
    # fallback only fires for a plan-less organic signup that somehow has no
    # subscription row yet, giving it the same 7-day trial everyone else gets.
    # A Growth/Scale $1-checkout signup (data.plan_type) deliberately has no
    # subscription yet either way — register() left it that way on purpose —
    # so this must never paper over that with a free trial.
    shop = db.query(Shop).filter(Shop.owner_id == user.id).order_by(Shop.id.asc()).first()
    paid_plan_pending = data.plan_type in ("growth", "scale")
    if shop and not paid_plan_pending:
        existing_sub = db.query(Subscription).filter(Subscription.shop_id == shop.id).first()
        if not existing_sub:
            from app.core.lemonsqueezy import TRIAL_FREE_DAYS
            now = datetime.now(timezone.utc)
            trial_sub = Subscription(
                shop_id=shop.id,
                plan_type="launch",
                billing_type="monthly",
                status="trial",
                amount_paid=0,
                currency=shop.currency or "USD",
                starts_at=now,
                trial_ends_at=now + timedelta(days=TRIAL_FREE_DAYS),
                expires_at=now + timedelta(days=TRIAL_FREE_DAYS),
            )
            db.add(trial_sub)

    db.commit()
    db.refresh(user)

    if paid_plan_pending:
        # No "your store is live" email yet — it isn't, until the $1 charge
        # actually goes through (the frontend sends them there next). Just a
        # heads-up to us that someone verified and is headed to checkout.
        _email_pool.submit(
            send_new_signup_notification,
            user.full_name or "",
            user.email,
            shop.name if shop else "",
            f"{data.plan_type.title()} — pending $1 checkout",
        )
    else:
        _email_pool.submit(send_welcome_email, user.email, user.full_name or "", "Launch (7-day trial)")
        _email_pool.submit(
            send_new_signup_notification,
            user.full_name or "",
            user.email,
            shop.name if shop else "",
            "Launch (7-day trial)",
        )

    record_audit_event(
        db, "signup", request=request,
        actor_user_id=user.id, actor_email=user.email, actor_name=user.full_name,
        shop_id=shop.id if shop else None,
        description=f"{user.email} signed up" + (f" ({data.plan_type})" if data.plan_type else ""),
    )

    access_token = create_access_token(data={"sub": str(user.id)})
    return Token(access_token=access_token, user=UserResponse.model_validate(user))


# ── Pre-signup checkout (pay first, account created after payment) ───────────

class CheckoutSignupIn(BaseModel):
    business_name: str
    email: str
    plan_type: str          # launch | growth | scale
    billing_type: str       # monthly | yearly — the REAL cadence once billed
    # true = the $1-for-7-days trial checkout (e.g. Scale's "Try for $1"
    # CTA) — charges $1 today via a dedicated Lemon Squeezy variant instead
    # of the plan's full price; false = a normal full-price checkout.
    trial_dollar: bool = False


@router.post("/checkout-signup")
async def checkout_signup(data: CheckoutSignupIn, db: Session = Depends(get_db)):
    """
    Marketing-site "pay first" flow — no ExiusCart account exists yet. Creates a
    Lemon Squeezy checkout session with the signup details embedded as custom_data;
    the webhook (lemonsqueezy_webhook.py) auto-creates the User/Shop/Subscription
    once payment is confirmed. Rejects if the email is already registered, so the
    webhook never has to reconcile a collision.
    """
    from app.core.lemonsqueezy import create_checkout

    if data.plan_type not in ("launch", "growth", "scale"):
        raise HTTPException(status_code=422, detail="Invalid plan_type")
    if data.billing_type not in ("monthly", "yearly"):
        raise HTTPException(status_code=422, detail="Invalid billing_type")

    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="An account with this email already exists. Please log in and upgrade from your dashboard instead.",
        )

    try:
        checkout_url = await create_checkout(
            plan_type=data.plan_type,
            billing_type=data.billing_type,
            customer_email=data.email,
            customer_name=data.business_name,
            new_signup_business_name=data.business_name,
            trial_dollar=data.trial_dollar,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    return {"checkout_url": checkout_url}


class ResendOTPIn(BaseModel):
    email: str


@router.post("/resend-otp")
def resend_otp(data: ResendOTPIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or user.is_verified:
        raise HTTPException(status_code=400, detail="No pending verification for this email")

    otp_code = f"{random.randint(100000, 999999)}"
    otp = EmailOTP(
        user_id=user.id,
        otp_code=otp_code,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
    )
    db.add(otp)
    db.commit()

    _email_pool.submit(send_otp_email, user.email, user.full_name or "", otp_code)
    return {"status": "otp_sent"}


@router.post("/login", response_model=Token)
async def login(credentials: UserLogin, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == credentials.email).first()

    if not user or not verify_password(credentials.password, user.hashed_password):
        record_audit_event(
            db, "login_failed", request=request,
            actor_user_id=user.id if user else None, actor_email=credentials.email,
            description=f"Failed login attempt for {credentials.email}",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated"
        )

    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email before logging in"
        )

    # Block login only if the account has NEVER been approved (no active/trial sub exists).
    # If user submitted an upgrade request during an active trial, they still have a trial
    # sub — do not block them just because the upgrade is pending_approval.
    login_shop = None
    if not user.is_superuser:
        login_shop = db.query(Shop).filter(Shop.owner_id == user.id).order_by(Shop.id.asc()).first()
        if login_shop:
            has_active_or_trial = db.query(Subscription).filter(
                Subscription.shop_id == login_shop.id,
                Subscription.status.in_(["active", "trial"]),
            ).first()
            if not has_active_or_trial:
                # No active/trial sub — check if only pending_approval exists
                login_sub = db.query(Subscription).filter(
                    Subscription.shop_id == login_shop.id
                ).order_by(Subscription.id.desc()).first()
                if login_sub and login_sub.status == "pending_approval":
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="pending_approval"
                    )

    # A team member owns no store, so tie their sign-in to the store they work at -
    # otherwise it never shows up under that store in Admin > Store Activity.
    audit_shop = login_shop
    if audit_shop is None and not user.is_superuser:
        from app.core.shop_access import find_staff_shop
        audit_shop = find_staff_shop(db, user)
    record_audit_event(
        db, "admin_login" if user.is_superuser else "login", request=request,
        actor_user_id=user.id, actor_email=user.email, actor_name=user.full_name,
        shop_id=audit_shop.id if audit_shop else None,
        description=f"{user.email} logged in",
    )

    access_token = create_access_token(data={"sub": str(user.id)})

    return Token(
        access_token=access_token,
        is_superuser=user.is_superuser,
        user=UserResponse.model_validate(user)
    )


# ── TheDersi seller first-time setup ─────────────────────────────────────────

class SetupPasswordIn(BaseModel):
    token: str
    password: str


@router.post("/setup-password", response_model=Token)
def setup_password(data: SetupPasswordIn, db: Session = Depends(get_db)):
    """
    Redeems a one-time setup link (issued during TheDersi provision, or after a
    pre-signup checkout payment). Token is a signed JWT (purpose=setup_password, exp=48h).
    Sets the password and logs the user straight in — no approval gate. A
    pre-signup payment already confirmed via the Lemon Squeezy webhook grants
    real access immediately (see lemonsqueezy_webhook.py); this only sets the
    password on top of that.
    """
    try:
        payload = jwt.decode(
            data.token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except jwt.PyJWTError:
        raise HTTPException(status_code=400, detail="Setup link is invalid or has expired")

    if payload.get("purpose") != "setup_password":
        raise HTTPException(status_code=400, detail="Invalid token purpose")

    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="Account not found")

    if len(data.password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")

    user.hashed_password = get_password_hash(data.password)
    user.is_active = True
    db.commit()
    db.refresh(user)

    shop = db.query(Shop).filter(Shop.owner_id == user.id).order_by(Shop.id.asc()).first()

    # Detected via an active TheDersi connection, not plan_type — TheDersi's
    # own Growth/Premium tier names map to our plan_type='launch', same as a
    # direct customer, so a plan_type check alone would miss those sellers.
    if shop and is_thedersi_shop(shop.id, db):
        _email_pool.submit(send_thedersi_welcome_email, user.email, user.full_name or "")

    access_token = create_access_token(data={"sub": str(user.id)})
    return Token(access_token=access_token, user=UserResponse.model_validate(user))
