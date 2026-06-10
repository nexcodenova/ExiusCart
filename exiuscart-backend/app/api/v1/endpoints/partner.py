"""
Partner integrations:
  - TheDersi: provision ExiusCart accounts for their sellers automatically
"""
import os
import secrets
import string
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.orm import Session
from slugify import slugify
import uuid

from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.user import User
from app.models.shop import Shop
from app.models.subscription import Subscription

router = APIRouter()

# ── Plan definitions ──────────────────────────────────────────────────────────

# thedersi_basic = trial features, but expires_at = NULL (free forever)
# starter        = full starter plan, 1 year provisioned by TheDersi
THEDERSI_TIER_MAP = {
    "free":     {"plan_type": "thedersi_basic", "duration_months": None},  # forever
    "standard": {"plan_type": "starter",        "duration_months": 12},    # 999 LKR plan
    "premium":  {"plan_type": "starter",        "duration_months": 12},    # 1699 LKR plan
}

# ── Auth helper ───────────────────────────────────────────────────────────────

THEDERSI_KEY = os.getenv("THEDERSI_PARTNER_KEY", "")


def require_thedersi_key(x_partner_key: str = Header(..., alias="X-Partner-Key")):
    if not THEDERSI_KEY:
        raise HTTPException(status_code=503, detail="Partner integration not configured")
    if x_partner_key != THEDERSI_KEY:
        raise HTTPException(status_code=401, detail="Invalid partner key")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _random_password(length: int = 12) -> str:
    chars = string.ascii_letters + string.digits + "!@#$"
    return "".join(secrets.choice(chars) for _ in range(length))


def _make_slug(name: str) -> str:
    return f"{slugify(name)}-{uuid.uuid4().hex[:6]}"


def _provision_subscription(shop: Shop, plan_type: str, duration_months: Optional[int], db: Session):
    """Create or replace the shop's subscription with the partner plan."""
    existing = db.query(Subscription).filter(Subscription.shop_id == shop.id).first()

    expires_at = None
    if duration_months is not None:
        expires_at = datetime.now(timezone.utc) + timedelta(days=30 * duration_months)

    if existing:
        existing.plan_type = plan_type
        existing.status = "active"
        existing.expires_at = expires_at
        existing.amount_paid = 0
        existing.promo_code = "partner_thedersi"
        db.commit()
        db.refresh(existing)
        return existing

    sub = Subscription(
        shop_id=shop.id,
        plan_type=plan_type,
        billing_type="monthly",
        status="active",
        amount_paid=0,
        currency="LKR",
        promo_code="partner_thedersi",
        expires_at=expires_at,
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


# ── TheDersi provision endpoint ───────────────────────────────────────────────

@router.post("/partner/thedersi/provision", dependencies=[Depends(require_thedersi_key)])
def thedersi_provision(
    seller_email: str,
    seller_name: str,
    shop_name: str,
    tier: str,                    # "free" | "standard" | "premium"
    db: Session = Depends(get_db),
):
    """
    Called by TheDersi backend when a seller joins or upgrades their plan.
    Creates the ExiusCart account if it doesn't exist, then provisions the
    right subscription tier.

    Tier mapping:
      free     → thedersi_basic (50 products, free forever)
      standard → starter (999 LKR plan, 1 year)
      premium  → starter (1699 LKR plan, 1 year)
    """
    tier = tier.lower()
    if tier not in THEDERSI_TIER_MAP:
        raise HTTPException(status_code=400, detail=f"Unknown tier '{tier}'. Use: free, standard, premium")

    plan_cfg = THEDERSI_TIER_MAP[tier]
    seller_email = seller_email.lower().strip()

    user = db.query(User).filter(User.email == seller_email).first()
    temp_password = None
    account_created = False

    if not user:
        # Create new ExiusCart account
        temp_password = _random_password()
        user = User(
            email=seller_email,
            hashed_password=get_password_hash(temp_password),
            full_name=seller_name,
            is_active=True,
            country="LK",
        )
        db.add(user)
        db.flush()
        account_created = True

    # Get or create the shop
    shop = db.query(Shop).filter(Shop.owner_id == user.id).first()
    if not shop:
        shop = Shop(
            name=shop_name or f"{seller_name}'s Store",
            slug=_make_slug(shop_name or seller_name),
            owner_id=user.id,
            currency="LKR",
            country="LK",
            is_active=True,
        )
        db.add(shop)
        db.flush()

    # Provision subscription
    sub = _provision_subscription(shop, plan_cfg["plan_type"], plan_cfg["duration_months"], db)

    db.commit()

    plan_label = {
        "thedersi_basic": "Basic (Free Forever)",
        "starter": "Starter",
    }.get(sub.plan_type, sub.plan_type)

    return {
        "success": True,
        "account_created": account_created,
        "seller_email": seller_email,
        "shop_id": shop.id,
        "plan": sub.plan_type,
        "plan_label": plan_label,
        "expires_at": sub.expires_at.isoformat() if sub.expires_at else "Never (free forever)",
        "login_url": "https://store.exiuscart.com/login",
        **({"temp_password": temp_password} if temp_password else {}),
    }


# ── TheDersi upgrade endpoint ─────────────────────────────────────────────────

@router.put("/partner/thedersi/upgrade", dependencies=[Depends(require_thedersi_key)])
def thedersi_upgrade(
    seller_email: str,
    new_tier: str,
    db: Session = Depends(get_db),
):
    """Called by TheDersi when a seller upgrades from free to a paid plan."""
    new_tier = new_tier.lower()
    if new_tier not in THEDERSI_TIER_MAP:
        raise HTTPException(status_code=400, detail=f"Unknown tier '{new_tier}'")

    user = db.query(User).filter(User.email == seller_email.lower().strip()).first()
    if not user:
        raise HTTPException(status_code=404, detail="Seller not found in ExiusCart")

    shop = db.query(Shop).filter(Shop.owner_id == user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Seller has no shop in ExiusCart")

    plan_cfg = THEDERSI_TIER_MAP[new_tier]
    sub = _provision_subscription(shop, plan_cfg["plan_type"], plan_cfg["duration_months"], db)

    return {
        "success": True,
        "seller_email": seller_email,
        "plan": sub.plan_type,
        "expires_at": sub.expires_at.isoformat() if sub.expires_at else "Never (free forever)",
    }


# ── TheDersi status check ─────────────────────────────────────────────────────

@router.get("/partner/thedersi/status", dependencies=[Depends(require_thedersi_key)])
def thedersi_status(
    seller_email: str,
    db: Session = Depends(get_db),
):
    """Check a seller's current ExiusCart plan status."""
    user = db.query(User).filter(User.email == seller_email.lower().strip()).first()
    if not user:
        return {"exists": False}

    shop = db.query(Shop).filter(Shop.owner_id == user.id).first()
    if not shop:
        return {"exists": True, "has_shop": False}

    sub = db.query(Subscription).filter(Subscription.shop_id == shop.id).first()
    return {
        "exists": True,
        "has_shop": True,
        "shop_id": shop.id,
        "plan": sub.plan_type if sub else None,
        "status": sub.status if sub else None,
        "expires_at": sub.expires_at.isoformat() if sub and sub.expires_at else "Never",
    }
