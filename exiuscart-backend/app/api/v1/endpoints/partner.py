"""
Partner integrations — TheDersi provisions ExiusCart accounts for their sellers.

Security model:
  - X-Partner-Key: long random secret, server-to-server HTTPS only, rotatable
  - Outgoing webhooks signed with HMAC-SHA256 (X-Signature header)
  - Setup links instead of plaintext temp passwords
  - thedersi_seller_id is the primary key — email is secondary/mutable
  - Provision is idempotent: duplicate calls return the existing account

TheDersi tier → ExiusCart plan:
  free_forever → thedersi_basic  (25 products, 50 orders/mo)
  growth       → starter         (1,000 products, 1,000 orders/mo)
  pro          → starter         (1,000 products, 1,000 orders/mo)
"""
import re
import secrets
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, HTTPException, Header, Query
from jose import jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_password_hash
from app.core.thedersi import THEDERSI_KEY, THEDERSI_INBOUND_KEY, THEDERSI_TIER_MAP, notify_thedersi
from app.models.user import User
from app.models.shop import Shop
from app.models.subscription import Subscription
from app.models.channel import ChannelConnection
from app.models.thedersi_seller import TheDersiSeller

router = APIRouter()

STORE_BASE_URL   = "https://store.exiuscart.com"
EXIUSCART_API_BASE = "https://api.exiuscart.com/api/v1"
SETUP_LINK_EXPIRE_HOURS = 48


# ── Auth ──────────────────────────────────────────────────────────────────────

def require_thedersi_key(x_partner_key: str = Header(..., alias="X-Partner-Key")):
    expected = THEDERSI_INBOUND_KEY or THEDERSI_KEY
    if not expected:
        raise HTTPException(status_code=503, detail="Partner integration not configured")
    if x_partner_key != expected:
        raise HTTPException(status_code=401, detail="Invalid partner key")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _slugify(text: str) -> str:
    return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')

def _make_slug(name: str) -> str:
    return f"{_slugify(name)}-{uuid.uuid4().hex[:6]}"

def _plan_label(plan_type: str) -> str:
    return {"thedersi_basic": "Free Forever", "starter": "Starter", "premium": "Premium"}.get(plan_type, plan_type)

def _webhook_url(webhook_secret: str) -> str:
    return f"{EXIUSCART_API_BASE}/channels/webhook/{webhook_secret}"

def _make_setup_link(user_id: int, email: str) -> str:
    """
    One-time JWT setup link — expires in 48h.
    Seller clicks this to set their own password. No plaintext password transmitted.
    """
    exp = datetime.now(timezone.utc) + timedelta(hours=SETUP_LINK_EXPIRE_HOURS)
    token = jwt.encode(
        {"sub": str(user_id), "email": email, "purpose": "setup_password", "exp": exp},
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    return f"{STORE_BASE_URL}/setup?token={token}"


def _provision_subscription(shop: Shop, plan_type: str, db: Session) -> Subscription:
    existing = db.query(Subscription).filter(Subscription.shop_id == shop.id).first()
    if existing:
        existing.plan_type   = plan_type
        existing.status      = "active"
        existing.expires_at  = None
        existing.amount_paid = 0
        existing.promo_code  = "partner_thedersi"
        db.commit()
        db.refresh(existing)
        return existing
    sub = Subscription(
        shop_id=shop.id, plan_type=plan_type, billing_type="monthly",
        status="active", amount_paid=0, currency="USD",
        promo_code="partner_thedersi", expires_at=None,
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


def _upsert_channel_connection(
    shop_id: int, thedersi_api_key: str,
    thedersi_seller_id: Optional[str], db: Session,
) -> ChannelConnection:
    existing = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.channel_type == "thedersi",
    ).first()
    if existing:
        if thedersi_api_key:
            existing.channel_api_key = thedersi_api_key
        if thedersi_seller_id:
            existing.channel_seller_id = thedersi_seller_id
        existing.is_active = True
        db.commit()
        db.refresh(existing)
        return existing
    conn = ChannelConnection(
        shop_id=shop_id, channel_type="thedersi",
        channel_api_key=thedersi_api_key or "",
        channel_seller_id=thedersi_seller_id,
        webhook_secret=secrets.token_urlsafe(32),
        is_active=True,
    )
    db.add(conn)
    db.commit()
    db.refresh(conn)
    return conn


def _upsert_thedersi_link(thedersi_seller_id: str, shop_id: int, db: Session):
    if not thedersi_seller_id:
        return
    link = db.query(TheDersiSeller).filter(
        TheDersiSeller.thedersi_seller_id == thedersi_seller_id
    ).first()
    if link:
        link.shop_id = shop_id
    else:
        db.add(TheDersiSeller(thedersi_seller_id=thedersi_seller_id, shop_id=shop_id))
    db.commit()


def _find_shop_by_seller_id(thedersi_seller_id: str, db: Session) -> Optional[Shop]:
    """Look up shop via TheDersi seller ID — preferred over email lookup."""
    link = db.query(TheDersiSeller).filter(
        TheDersiSeller.thedersi_seller_id == thedersi_seller_id
    ).first()
    if not link:
        return None
    return db.query(Shop).filter(Shop.id == link.shop_id).first()


# ── Core provision logic (shared by both endpoints) ──────────────────────────

def _do_provision(
    seller_email: str, seller_name: str, shop_name: str, tier: str,
    thedersi_seller_id: Optional[str], thedersi_api_key: Optional[str],
    db: Session,
) -> dict:
    tier = tier.lower().strip()
    if tier not in THEDERSI_TIER_MAP:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown tier '{tier}'. Valid: free_forever, growth, pro",
        )

    seller_email = seller_email.lower().strip()

    # @thedersi.lk sellers always get Premium regardless of their TheDersi plan
    if seller_email.endswith("@thedersi.lk"):
        plan_type = "premium"
        tier = "pro"  # notify TheDersi back as "pro" so they know this seller is top-tier
        logger.info(f"[domain_thedersi] premium override for {seller_email}")
    else:
        plan_type = THEDERSI_TIER_MAP[tier]["plan_type"]

    # ── Idempotency: check by thedersi_seller_id first ────────────────────────
    # If this seller was already provisioned (e.g. network retry), return existing
    # account rather than creating a duplicate.
    if thedersi_seller_id:
        existing_shop = _find_shop_by_seller_id(thedersi_seller_id, db)
        if existing_shop:
            sub  = _provision_subscription(existing_shop, plan_type, db)
            conn = _upsert_channel_connection(existing_shop.id, thedersi_api_key or "", thedersi_seller_id, db)
            user = db.query(User).filter(User.id == existing_shop.owner_id).first()
            return {
                "success": True,
                "account_created": False,
                "seller_email": user.email if user else seller_email,
                "shop_id": existing_shop.id,
                "plan": sub.plan_type,
                "plan_label": _plan_label(sub.plan_type),
                "webhook_url": _webhook_url(conn.webhook_secret),
                "login_url": f"{STORE_BASE_URL}/login",
                "note": "Existing account returned (idempotent)",
            }

    # ── Get or create user ────────────────────────────────────────────────────
    user = db.query(User).filter(User.email == seller_email).first()
    account_created = False
    setup_link      = None

    if not user:
        # Create account with a random unusable password — seller sets their own
        # via the one-time setup link (expires 48h). No plaintext password exposed.
        user = User(
            email=seller_email,
            hashed_password=get_password_hash(secrets.token_hex(32)),
            full_name=seller_name,
            is_active=True,
        )
        db.add(user)
        db.flush()
        account_created = True
        setup_link = _make_setup_link(user.id, seller_email)

    # ── Get or create shop ────────────────────────────────────────────────────
    shop = db.query(Shop).filter(Shop.owner_id == user.id).first()
    if not shop:
        shop = Shop(
            name=shop_name or f"{seller_name}'s Store",
            slug=_make_slug(shop_name or seller_name),
            owner_id=user.id,
            currency="USD",
            is_active=True,
        )
        db.add(shop)
        db.flush()

    # ── Provision subscription + channel connection ───────────────────────────
    sub  = _provision_subscription(shop, plan_type, db)
    conn = _upsert_channel_connection(shop.id, thedersi_api_key or "", thedersi_seller_id, db)

    if thedersi_seller_id:
        _upsert_thedersi_link(thedersi_seller_id, shop.id, db)
        notify_thedersi(thedersi_seller_id, tier, event="provisioned")

    result = {
        "success": True,
        "account_created": account_created,
        "seller_email": seller_email,
        "shop_id": shop.id,
        "plan": sub.plan_type,
        "plan_label": _plan_label(sub.plan_type),
        # TheDersi MUST store this — call it on every order
        "webhook_url": _webhook_url(conn.webhook_secret),
        "login_url": f"{STORE_BASE_URL}/login",
    }
    if setup_link:
        # Send this URL to the seller (email/WhatsApp). It expires in 48h.
        # Never log or expose this in browser/client code.
        result["setup_link"] = setup_link
        result["setup_link_expires_hours"] = SETUP_LINK_EXPIRE_HOURS

    return result


# ── Provision — JSON body (preferred) ────────────────────────────────────────

class ProvisionIn(BaseModel):
    seller_email: str
    seller_name: str
    shop_name: str
    tier: str
    thedersi_seller_id: Optional[str] = None
    thedersi_api_key: Optional[str] = None


@router.post("/partner/thedersi/provision", dependencies=[Depends(require_thedersi_key)])
def thedersi_provision(data: ProvisionIn, db: Session = Depends(get_db)):
    """
    Called by TheDersi when a seller joins or updates their plan.
    Idempotent — safe to retry on network failure.
    Returns setup_link (48h expiry) for new accounts — send to seller, never log it.
    Returns webhook_url — TheDersi must store this per seller and POST to it on every order.
    """
    return _do_provision(
        seller_email=data.seller_email, seller_name=data.seller_name,
        shop_name=data.shop_name, tier=data.tier,
        thedersi_seller_id=data.thedersi_seller_id,
        thedersi_api_key=data.thedersi_api_key,
        db=db,
    )


# ── Provision — query params (backward compat) ───────────────────────────────

@router.post("/partner/thedersi/provision-legacy", dependencies=[Depends(require_thedersi_key)])
def thedersi_provision_legacy(
    seller_email: str = Query(...),
    seller_name: str = Query(...),
    shop_name: str = Query(...),
    tier: str = Query(...),
    thedersi_seller_id: Optional[str] = Query(None),
    thedersi_api_key: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Backward-compat endpoint for TheDersi calls using query params. Migrate to /provision."""
    return _do_provision(
        seller_email=seller_email, seller_name=seller_name,
        shop_name=shop_name, tier=tier,
        thedersi_seller_id=thedersi_seller_id,
        thedersi_api_key=thedersi_api_key,
        db=db,
    )


# ── Upgrade ───────────────────────────────────────────────────────────────────

class UpgradeIn(BaseModel):
    new_tier: str
    thedersi_seller_id: str             # primary key — required for upgrade
    seller_email: Optional[str] = None  # fallback only if seller_id not found


@router.put("/partner/thedersi/upgrade", dependencies=[Depends(require_thedersi_key)])
def thedersi_upgrade(data: UpgradeIn, db: Session = Depends(get_db)):
    """
    Called by TheDersi when a seller upgrades or downgrades.
    Uses thedersi_seller_id as primary key (email is mutable and guessable).
    """
    new_tier = data.new_tier.lower().strip()
    if new_tier not in THEDERSI_TIER_MAP:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown tier '{new_tier}'. Valid: free_forever, growth, pro",
        )

    # Look up by immutable seller ID first
    shop = _find_shop_by_seller_id(data.thedersi_seller_id, db)

    # Fallback to email if seller_id not found (migration period)
    if not shop and data.seller_email:
        user = db.query(User).filter(User.email == data.seller_email.lower().strip()).first()
        if user:
            shop = db.query(Shop).filter(Shop.owner_id == user.id).first()

    if not shop:
        raise HTTPException(
            status_code=404,
            detail="Seller not found. Call /provision first.",
        )

    plan_type = THEDERSI_TIER_MAP[new_tier]["plan_type"]
    sub = _provision_subscription(shop, plan_type, db)

    _upsert_thedersi_link(data.thedersi_seller_id, shop.id, db)
    notify_thedersi(data.thedersi_seller_id, new_tier, event="upgraded")

    conn = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop.id,
        ChannelConnection.channel_type == "thedersi",
    ).first()

    return {
        "success": True,
        "shop_id": shop.id,
        "plan": sub.plan_type,
        "plan_label": _plan_label(sub.plan_type),
        "webhook_url": _webhook_url(conn.webhook_secret) if conn else None,
    }


# ── Status check ──────────────────────────────────────────────────────────────

@router.get("/partner/thedersi/status", dependencies=[Depends(require_thedersi_key)])
def thedersi_status(
    thedersi_seller_id: str,
    db: Session = Depends(get_db),
):
    """
    Check a seller's current ExiusCart plan and webhook URL.
    Uses thedersi_seller_id as the primary key.
    """
    shop = _find_shop_by_seller_id(thedersi_seller_id, db)
    if not shop:
        return {"exists": False}

    sub  = db.query(Subscription).filter(Subscription.shop_id == shop.id).first()
    conn = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop.id,
        ChannelConnection.channel_type == "thedersi",
    ).first()

    return {
        "exists": True,
        "shop_id": shop.id,
        "plan": sub.plan_type if sub else None,
        "plan_label": _plan_label(sub.plan_type) if sub else None,
        "status": sub.status if sub else None,
        "webhook_url": _webhook_url(conn.webhook_secret) if conn else None,
    }


# ── Seller profile (Option B: TheDersi can pull logo/banner) ──────────────────

@router.get("/partner/thedersi/seller-profile", dependencies=[Depends(require_thedersi_key)])
def thedersi_seller_profile(
    thedersi_seller_id: str,
    db: Session = Depends(get_db),
):
    """
    Return the current logo_url and banner_url for a seller.
    TheDersi can call this to pull the latest profile images at any time.
    Also available via push: ExiusCart POSTs profile_updated events automatically.
    """
    shop = _find_shop_by_seller_id(thedersi_seller_id, db)
    if not shop:
        raise HTTPException(status_code=404, detail="Seller not found")
    return {
        "thedersi_seller_id": thedersi_seller_id,
        "logo_url": shop.logo_url,
        "banner_url": shop.banner_url,
    }
