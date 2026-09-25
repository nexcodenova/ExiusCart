"""Social sign-in (Google / Facebook) and password reset.

Social login never trusts anything the browser says about who the user is:
each provider's token is verified server-side against the provider itself and
checked to have been issued for OUR app (Google `aud`, Facebook `app_id`), so
a token minted for some other site can't be replayed here.

A provider only appears in /auth/social/config (and so only shows a button in
the apps) once its credentials are set in the backend environment — nothing
is half-enabled:
  GOOGLE_CLIENT_ID
  FACEBOOK_APP_ID + FACEBOOK_APP_SECRET

Apple sign-in was removed (no Apple Developer Program membership) — if it
ever comes back, GOOGLE_CLIENT_ID/FACEBOOK_APP_ID above are the pattern to
follow: an APPLE_CLIENT_ID env var, a _verify_apple() identity check, and an
entry in social_config()'s response.
"""
import hashlib
import logging
import os
import re
import secrets
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.email import (
    send_password_reset_email, send_welcome_email, send_thedersi_welcome_email,
    send_new_signup_notification,
)
from app.core.rate_limit import limiter
from app.core.audit_log import record_audit_event
from app.api.v1.deps import get_current_user
from app.core.security import get_password_hash, create_access_token
from app.models.affiliate import Affiliate
from app.models.shop import Shop
from app.models.subscription import Subscription
from app.models.user import User
from app.schemas.user import UserResponse

logger = logging.getLogger(__name__)
router = APIRouter()
_email_pool = ThreadPoolExecutor(max_workers=2)

THEDERSI_STAFF_DOMAIN = "@thedersi.lk"
STORE_URL = os.getenv("STORE_URL", "https://store.exiuscart.com").rstrip("/")
RESET_TOKEN_TTL = timedelta(hours=1)

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
FACEBOOK_APP_ID = os.getenv("FACEBOOK_APP_ID", "")
FACEBOOK_APP_SECRET = os.getenv("FACEBOOK_APP_SECRET", "")
_HTTP_TIMEOUT = 8.0


def _slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


# ── Which providers are switched on ───────────────────────────────────────────

@router.get("/social/config")
def social_config():
    """Public client identifiers only — safe to expose, and it lets the apps
    stay free of build-time env vars (a provider appears the moment its
    credentials land in the backend environment)."""
    return {
        "google": {"client_id": GOOGLE_CLIENT_ID} if GOOGLE_CLIENT_ID else None,
        "facebook": {"app_id": FACEBOOK_APP_ID} if FACEBOOK_APP_ID and FACEBOOK_APP_SECRET else None,
    }


# ── Provider verification ─────────────────────────────────────────────────────

class _Identity(BaseModel):
    email: str
    name: str = ""


def _verify_google(access_token: str) -> _Identity:
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google sign-in isn't set up yet.")
    try:
        info = httpx.get("https://oauth2.googleapis.com/tokeninfo",
                         params={"access_token": access_token}, timeout=_HTTP_TIMEOUT)
        if info.status_code != 200:
            raise HTTPException(status_code=401, detail="Google sign-in failed. Please try again.")
        data = info.json()
        if data.get("aud") != GOOGLE_CLIENT_ID and data.get("azp") != GOOGLE_CLIENT_ID:
            raise HTTPException(status_code=401, detail="Google sign-in failed. Please try again.")
        email = (data.get("email") or "").lower()
        if not email or str(data.get("email_verified")).lower() != "true":
            raise HTTPException(status_code=400, detail="Your Google account has no verified email.")
        name = ""
        try:
            ui = httpx.get("https://www.googleapis.com/oauth2/v3/userinfo",
                           headers={"Authorization": f"Bearer {access_token}"}, timeout=_HTTP_TIMEOUT)
            name = (ui.json().get("name") or "") if ui.status_code == 200 else ""
        except Exception:
            pass
        return _Identity(email=email, name=name)
    except httpx.HTTPError:
        logger.warning("[social] google verification request failed", exc_info=True)
        raise HTTPException(status_code=502, detail="Couldn't reach Google. Please try again.")


def _verify_facebook(access_token: str) -> _Identity:
    if not (FACEBOOK_APP_ID and FACEBOOK_APP_SECRET):
        raise HTTPException(status_code=503, detail="Facebook sign-in isn't set up yet.")
    try:
        dbg = httpx.get(
            "https://graph.facebook.com/debug_token",
            params={"input_token": access_token, "access_token": f"{FACEBOOK_APP_ID}|{FACEBOOK_APP_SECRET}"},
            timeout=_HTTP_TIMEOUT,
        ).json().get("data", {})
        if not dbg.get("is_valid") or str(dbg.get("app_id")) != FACEBOOK_APP_ID:
            raise HTTPException(status_code=401, detail="Facebook sign-in failed. Please try again.")
        me = httpx.get("https://graph.facebook.com/me",
                       params={"fields": "id,name,email", "access_token": access_token},
                       timeout=_HTTP_TIMEOUT).json()
        email = (me.get("email") or "").lower()
        if not email:
            raise HTTPException(
                status_code=400,
                detail="Facebook didn't share an email address. Sign up with your email instead.",
            )
        return _Identity(email=email, name=me.get("name") or "")
    except httpx.HTTPError:
        logger.warning("[social] facebook verification request failed", exc_info=True)
        raise HTTPException(status_code=502, detail="Couldn't reach Facebook. Please try again.")


# ── Find-or-create account ────────────────────────────────────────────────────

def _create_account(db: Session, identity: _Identity, ref_code: Optional[str], country: Optional[str], plan_type: Optional[str] = None) -> User:
    """Same shape as a verified email signup: user + shop + 7-day trial. The
    provider already verified the email, so no OTP step. The random password
    is unusable on purpose — they can set a real one via Forgot password."""
    display_name = identity.name.strip() or identity.email.split("@")[0]
    is_thedersi_staff = identity.email.endswith(THEDERSI_STAFF_DOMAIN)

    user = User(
        email=identity.email,
        hashed_password=get_password_hash(secrets.token_urlsafe(32)),
        full_name=display_name,
        referred_by_code=ref_code or None,
        country=country or None,
        is_verified=True,
    )
    db.add(user)
    db.flush()

    shop_name = f"{display_name}'s Store"
    currency = "LKR" if is_thedersi_staff else "USD"
    shop = Shop(
        name=shop_name,
        slug=f"{_slugify(shop_name)}-{uuid.uuid4().hex[:6]}",
        owner_id=user.id,
        currency=currency,
        country=country or "UAE",
    )
    db.add(shop)
    db.flush()

    now = datetime.now(timezone.utc)
    paid_plan_pending = plan_type in ("growth", "scale")
    if is_thedersi_staff:
        db.add(Subscription(
            shop_id=shop.id, plan_type="scale", billing_type="yearly", status="active",
            amount_paid=0, currency=currency, promo_code="domain_thedersi",
            starts_at=now, expires_at=None,
        ))
    elif paid_plan_pending:
        # Arrived from the pricing page's Growth/Scale "Try for $1" CTA via
        # Google/Facebook — same as register()'s email path: no subscription
        # yet, the caller (social_login below) sends the seller straight to
        # a real Lemon Squeezy $1 checkout for this shop right after.
        pass
    else:
        from app.core.lemonsqueezy import TRIAL_FREE_DAYS
        ends = now + timedelta(days=TRIAL_FREE_DAYS)
        db.add(Subscription(
            shop_id=shop.id, plan_type="launch", billing_type="monthly", status="trial",
            amount_paid=0, currency=currency, starts_at=now, trial_ends_at=ends, expires_at=ends,
        ))
    db.commit()
    db.refresh(user)

    if is_thedersi_staff:
        _email_pool.submit(send_thedersi_welcome_email, user.email, user.full_name or "")
        _email_pool.submit(send_new_signup_notification, user.full_name or "", user.email, shop.name, "Launch (7-day trial)")
    elif paid_plan_pending:
        # No "your store is live" email yet — it isn't, until the $1 charge
        # actually goes through.
        _email_pool.submit(send_new_signup_notification, user.full_name or "", user.email, shop.name, f"{plan_type.title()} — pending $1 checkout")
    else:
        _email_pool.submit(send_welcome_email, user.email, user.full_name or "", "Launch (7-day trial)")
        _email_pool.submit(send_new_signup_notification, user.full_name or "", user.email, shop.name, "Launch (7-day trial)")
    return user


class SocialLoginIn(BaseModel):
    provider: str                      # google | facebook
    token: str                         # the provider's access token
    ref_code: Optional[str] = None
    country: Optional[str] = None
    # Mirrors register()'s plan_type — set when arriving from the pricing
    # page's Growth/Scale "Try for $1" CTA, so a brand-new account isn't
    # given a free trial it never asked for. None on the login page and on
    # Launch's free-trial signup (both fall back to the normal 7-day trial).
    plan_type: Optional[str] = None
    # False from the login page: signing in must never silently create an
    # account — sign-up is where the terms are accepted.
    allow_signup: bool = True


@router.post("/social")
@limiter.limit("20/minute")
def social_login(request: Request, data: SocialLoginIn, db: Session = Depends(get_db)):
    if data.provider == "google":
        identity = _verify_google(data.token)
    elif data.provider == "facebook":
        identity = _verify_facebook(data.token)
    else:
        raise HTTPException(status_code=422, detail="Unknown sign-in provider")

    user = db.query(User).filter(User.email == identity.email).first()
    is_new = user is None
    if user is None and not data.allow_signup:
        raise HTTPException(
            status_code=404,
            detail="We couldn't find an ExiusCart account for that email. Please sign up first.",
        )
    if user is None:
        user = _create_account(db, identity, data.ref_code, data.country, data.plan_type)
    else:
        if not user.is_active:
            raise HTTPException(status_code=403, detail="Account is deactivated")
        # The provider has verified this email, which is what OTP verification
        # would have proven — unblock an account that signed up but never
        # entered its code.
        if not user.is_verified:
            user.is_verified = True
            db.commit()
            db.refresh(user)

    signup_shop = db.query(Shop).filter(Shop.owner_id == user.id).order_by(Shop.id.asc()).first()
    if signup_shop is None and not user.is_superuser:
        from app.core.shop_access import find_staff_shop
        signup_shop = find_staff_shop(db, user)
    record_audit_event(
        db, "social_signup" if is_new else "social_login", request=request,
        actor_user_id=user.id, actor_email=user.email, actor_name=user.full_name,
        shop_id=signup_shop.id if signup_shop else None,
        description=f"{user.email} {'signed up' if is_new else 'logged in'} via {data.provider}",
    )

    token = create_access_token(data={"sub": str(user.id)})
    return {
        "access_token": token,
        "token_type": "bearer",
        "is_superuser": user.is_superuser,
        "is_new": is_new,
        "user": UserResponse.model_validate(user),
    }


# ── Forgot / reset password ───────────────────────────────────────────────────

def _password_fingerprint(user: User) -> str:
    """Ties a reset token to the password it was issued against, so it stops
    working the moment the password changes — a reset link is single-use
    without needing a table to track used tokens."""
    return hashlib.sha256((user.hashed_password or "").encode()).hexdigest()[:16]


class ForgotPasswordIn(BaseModel):
    email: EmailStr


@router.post("/forgot-password")
@limiter.limit("5/minute")
def forgot_password(request: Request, data: ForgotPasswordIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if user and user.is_active:
        token = jwt.encode(
            {
                "sub": str(user.id),
                "purpose": "reset_password",
                "pwd": _password_fingerprint(user),
                "exp": datetime.now(timezone.utc) + RESET_TOKEN_TTL,
            },
            settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM,
        )
        _email_pool.submit(
            send_password_reset_email, user.email, user.full_name or "",
            f"{STORE_URL}/reset-password?token={token}",
        )
    # Identical response whether or not the address has an account, so this
    # can't be used to find out who's registered.
    return {"status": "ok"}


class ResetPasswordIn(BaseModel):
    token: str
    password: str


@router.post("/reset-password")
@limiter.limit("10/minute")
def reset_password(request: Request, data: ResetPasswordIn, db: Session = Depends(get_db)):
    bad_link = HTTPException(status_code=400, detail="This reset link is invalid or has expired. Request a new one.")
    try:
        payload = jwt.decode(data.token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise bad_link
    if payload.get("purpose") != "reset_password":
        raise bad_link

    user = db.query(User).filter(User.id == int(payload.get("sub", 0))).first()
    if not user or not user.is_active or payload.get("pwd") != _password_fingerprint(user):
        raise bad_link
    if len(data.password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")

    user.hashed_password = get_password_hash(data.password)
    # A reset also proves control of the inbox.
    user.is_verified = True
    db.commit()
    return {"status": "ok"}


# ── Finish setting up (details a social sign-in can't provide) ────────────────

class CompleteProfileIn(BaseModel):
    phone: Optional[str] = None       # full international number, e.g. +971501234567
    country: Optional[str] = None     # ISO 3166-1 alpha-2
    shop_name: Optional[str] = None
    ref_code: Optional[str] = None


@router.post("/complete-profile")
def complete_profile(
    data: CompleteProfileIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Google/Facebook hand over a name and email, never a phone number,
    country or referral code — and the streamlined email signup skips them too.
    The dashboard collects them once, right after first login, through this
    endpoint. Every field is optional so a partial answer still saves."""
    shop = db.query(Shop).filter(Shop.owner_id == current_user.id).order_by(Shop.id.asc()).first()

    if data.phone is not None and data.phone.strip():
        phone = re.sub(r"[^\d+]", "", data.phone)
        if len(re.sub(r"\D", "", phone)) < 7:
            raise HTTPException(status_code=422, detail="Please enter a valid phone number.")
        current_user.phone = phone

    if data.country and len(data.country.strip()) == 2:
        code = data.country.strip().upper()
        current_user.country = code
        if shop:
            shop.country = code

    if data.shop_name and data.shop_name.strip() and shop:
        shop.name = data.shop_name.strip()[:120]

    ref = (data.ref_code or "").strip()
    if ref and not current_user.referred_by_code:
        valid = db.query(Affiliate).filter(Affiliate.referral_code == ref, Affiliate.status == "approved").first()
        if not valid:
            raise HTTPException(status_code=400, detail="That referral code isn't valid.")
        current_user.referred_by_code = ref

    db.commit()
    db.refresh(current_user)
    return {"user": UserResponse.model_validate(current_user), "shop_name": shop.name if shop else None}
