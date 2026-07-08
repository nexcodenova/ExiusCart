"""
Super-admin endpoints — all routes require is_superuser.
"""
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from pydantic import BaseModel

from app.core.database import get_db
from app.api.v1.deps import get_current_user
from app.core.email import (
    send_dashboard_live_email,
    send_affiliate_pending_email,
    send_affiliate_approved_email,
)
from app.core.security import create_access_token
from app.models.user import User
from app.models.shop import Shop
from app.models.subscription import Subscription
from app.models.lead import Lead
from app.models.affiliate import Affiliate, Commission
from app.models.product import Product, Category
from app.models.order import Order
from app.models.partner import PartnerLicense
from app.models.admin_settings import AdminSettings

router = APIRouter()


# ── Guard ─────────────────────────────────────────────────────────────────────

def require_superuser(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Superuser access required")
    return current_user


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class LeadCreate(BaseModel):
    name: str
    shop_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None
    business_type: Optional[str] = None
    notes: Optional[str] = None
    status: str = "new"
    source: str = "manual"

class LeadUpdate(BaseModel):
    name: Optional[str] = None
    shop_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None
    business_type: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    source: Optional[str] = None

class LeadOut(BaseModel):
    id: int
    name: str
    shop_name: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    city: Optional[str]
    business_type: Optional[str]
    notes: Optional[str]
    status: str
    source: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Admin Stats ───────────────────────────────────────────────────────────────

@router.get("/admin/stats")
def get_admin_stats(
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    total_shops = db.query(func.count(Shop.id)).scalar() or 0
    active_shops = db.query(func.count(Shop.id)).filter(Shop.is_active == True).scalar() or 0
    total_users = db.query(func.count(User.id)).filter(User.is_superuser == False).scalar() or 0

    # Revenue: sum of amount_paid from approved/active subscriptions
    total_revenue = db.query(func.sum(Subscription.amount_paid)).filter(
        Subscription.status == "active"
    ).scalar() or 0

    # Pending subscriptions (need manual approval)
    pending_count = db.query(func.count(Subscription.id)).filter(
        Subscription.status.in_(["trial", "pending_approval"])
    ).scalar() or 0

    # Expiring soon (within 7 days)
    now = datetime.now(timezone.utc)
    seven_days = now + timedelta(days=7)
    expiring_count = db.query(func.count(Subscription.id)).filter(
        Subscription.status == "active",
        Subscription.expires_at != None,
        Subscription.expires_at <= seven_days,
        Subscription.expires_at >= now,
    ).scalar() or 0

    return {
        "total_shops": total_shops,
        "active_shops": active_shops,
        "total_users": total_users,
        "monthly_revenue": float(total_revenue),
        "pending_payments": pending_count,
        "expiring_soon": expiring_count,
    }


# ── Shops ─────────────────────────────────────────────────────────────────────

@router.get("/admin/shops")
def list_shops(
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    query = db.query(Shop).options(
        joinedload(Shop.owner),
        joinedload(Shop.subscription),
    )
    if search:
        q = f"%{search}%"
        query = query.join(User, Shop.owner_id == User.id).filter(
            (Shop.name.ilike(q)) | (User.email.ilike(q)) | (User.full_name.ilike(q))
        )
    if status_filter == "active":
        query = query.filter(Shop.is_active == True)
    elif status_filter == "suspended":
        query = query.filter(Shop.is_active == False)

    shops = query.order_by(Shop.created_at.desc()).all()

    result = []
    for shop in shops:
        sub = shop.subscription
        product_count = db.query(func.count(Product.id)).filter(Product.shop_id == shop.id).scalar() or 0
        order_count = db.query(func.count(Order.id)).filter(Order.shop_id == shop.id).scalar() or 0
        result.append({
            "id": shop.id,
            "name": shop.name,
            "email": shop.email or shop.owner.email,
            "phone": shop.phone or "",
            "owner": shop.owner.full_name,
            "owner_email": shop.owner.email,
            "is_active": shop.is_active,
            "created_at": shop.created_at.isoformat() if shop.created_at else None,
            "subscription_id": sub.id if sub else None,
            "plan": sub.plan_type if sub else "none",
            "subscription_status": sub.status if sub else "none",
            "billing_type": sub.billing_type if sub else None,
            "starts_at": sub.starts_at.isoformat() if sub and sub.starts_at else None,
            "expires_at": sub.expires_at.isoformat() if sub and sub.expires_at else None,
            "product_count": product_count,
            "order_count": order_count,
        })
    return result


@router.put("/admin/shops/{shop_id}/status")
def toggle_shop_status(
    shop_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    shop = db.query(Shop).filter(Shop.id == shop_id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    shop.is_active = not shop.is_active
    db.commit()
    return {"id": shop.id, "is_active": shop.is_active}


class ChangePlanIn(BaseModel):
    plan_type: str
    billing_type: str = "monthly"


@router.put("/admin/shops/{shop_id}/plan")
def change_shop_plan(
    shop_id: int,
    data: ChangePlanIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    shop = db.query(Shop).filter(Shop.id == shop_id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    now = datetime.now(timezone.utc)
    sub = db.query(Subscription).filter(Subscription.shop_id == shop_id).order_by(Subscription.id.desc()).first()
    if sub:
        sub.plan_type = data.plan_type
        sub.billing_type = data.billing_type
        sub.status = "active"
        sub.starts_at = now
        sub.expires_at = now + timedelta(days=365 if data.billing_type == "yearly" else 30)
    else:
        sub = Subscription(
            shop_id=shop_id,
            plan_type=data.plan_type,
            billing_type=data.billing_type,
            status="active",
            amount_paid=0,
            currency="AED",
            starts_at=now,
            expires_at=now + timedelta(days=30),
        )
        db.add(sub)
    db.commit()
    return {"message": "Plan updated", "plan_type": data.plan_type}


@router.delete("/admin/shops/{shop_id}")
def delete_shop(
    shop_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    shop = db.query(Shop).filter(Shop.id == shop_id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    shop.is_active = False
    sub = db.query(Subscription).filter(Subscription.shop_id == shop_id).first()
    if sub:
        sub.status = "cancelled"
    db.commit()
    return {"message": "Shop deactivated"}


# ── Users ─────────────────────────────────────────────────────────────────────

@router.get("/admin/users")
def list_users(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    query = db.query(User).filter(User.is_superuser == False).options(joinedload(User.shops))
    if search:
        q = f"%{search}%"
        query = query.filter(
            (User.full_name.ilike(q)) | (User.email.ilike(q))
        )
    users = query.order_by(User.created_at.desc()).all()

    result = []
    for user in users:
        shop = user.shops[0] if user.shops else None
        sub = db.query(Subscription).filter(Subscription.shop_id == shop.id).order_by(Subscription.created_at.desc()).first() if shop else None
        source = "thedersi" if (sub and sub.promo_code == "partner_thedersi") else "exiuscart"
        result.append({
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "phone": user.phone or "",
            "is_active": user.is_active,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "store_name": shop.name if shop else None,
            "store_id": shop.id if shop else None,
            "plan_type": sub.plan_type if sub else None,
            "plan_status": sub.status if sub else None,
            "source": source,
            "referred_by_code": user.referred_by_code or None,
        })
    return result


@router.put("/admin/users/{user_id}/status")
def toggle_user_status(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    user = db.query(User).filter(User.id == user_id, User.is_superuser == False).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = not user.is_active
    db.commit()
    return {"id": user.id, "is_active": user.is_active}


# ── Subscriptions / Payments ──────────────────────────────────────────────────

@router.get("/admin/subscriptions")
def list_subscriptions(
    status_filter: Optional[str] = None,
    plan_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    query = db.query(Subscription).options(joinedload(Subscription.shop))
    if status_filter:
        query = query.filter(Subscription.status == status_filter)
    if plan_filter:
        query = query.filter(Subscription.plan_type == plan_filter)

    subs = query.order_by(Subscription.created_at.desc()).all()

    now = datetime.now(timezone.utc)
    seven_days = now + timedelta(days=7)

    result = []
    for sub in subs:
        # Compute derived status
        derived_status = sub.status
        if sub.status == "active" and sub.expires_at and sub.expires_at <= seven_days:
            derived_status = "expiring"

        result.append({
            "id": sub.id,
            "shop_id": sub.shop_id,
            "shop_name": sub.shop.name if sub.shop else "Unknown",
            "plan_type": sub.plan_type,
            "billing_type": sub.billing_type,
            "status": derived_status,
            "amount_paid": float(sub.amount_paid) if sub.amount_paid else 0,
            "currency": sub.currency,
            "starts_at": sub.starts_at.isoformat() if sub.starts_at else None,
            "expires_at": sub.expires_at.isoformat() if sub.expires_at else None,
            "trial_ends_at": sub.trial_ends_at.isoformat() if sub.trial_ends_at else None,
            "created_at": sub.created_at.isoformat() if sub.created_at else None,
        })
    return result


@router.put("/admin/subscriptions/{sub_id}/approve")
def approve_subscription(
    sub_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    sub = db.query(Subscription).options(joinedload(Subscription.shop)).filter(
        Subscription.id == sub_id
    ).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    now = datetime.now(timezone.utc)
    sub.starts_at = now

    if sub.plan_type == "free_trial":
        # Free trial approval: start the 14-day countdown now
        sub.status = "trial"
        sub.trial_ends_at = now + timedelta(days=14)
        sub.expires_at = now + timedelta(days=14)
    else:
        # Paid plan approval: activate immediately
        sub.status = "active"
        if sub.billing_type == "monthly":
            sub.expires_at = now + timedelta(days=30)
        elif sub.billing_type == "yearly":
            sub.expires_at = now + timedelta(days=365)
        else:
            sub.expires_at = None  # Lifetime / one-time

    # ── Auto-commission: check if shop owner was referred by an affiliate ──────
    # One commission per shop per affiliate, ever — regardless of plan changes/upgrades.
    # No commission on free trials.
    if sub.shop and sub.plan_type != "free_trial":
        shop_owner = db.query(User).filter(User.id == sub.shop.owner_id).first()
        if shop_owner and shop_owner.referred_by_code:
            affiliate = db.query(Affiliate).filter(
                Affiliate.referral_code == shop_owner.referred_by_code,
                Affiliate.status == "active",
            ).first()
            if affiliate:
                # Guard: one commission per shop per affiliate, not per subscription
                already_commissioned = db.query(Commission).filter(
                    Commission.affiliate_id == affiliate.id,
                    Commission.shop_id == sub.shop_id,
                ).first()
                if not already_commissioned:
                    commission_amount = 75.0 if sub.billing_type == "yearly" else 25.0
                    commission = Commission(
                        affiliate_id=affiliate.id,
                        shop_id=sub.shop_id,
                        subscription_id=sub.id,
                        amount=commission_amount,
                        currency="USD",
                        status="pending",
                    )
                    db.add(commission)

    db.commit()

    # Send "dashboard is live" email to shop owner
    if sub.shop:
        owner = db.query(User).filter(User.id == sub.shop.owner_id).first()
        if owner:
            from concurrent.futures import ThreadPoolExecutor
            _pool = ThreadPoolExecutor(max_workers=1)
            _pool.submit(
                send_dashboard_live_email,
                owner.email,
                owner.full_name or "",
                sub.shop.name or "Your Shop",
            )

    return {"message": "Subscription approved", "id": sub_id}


@router.put("/admin/subscriptions/{sub_id}/reject")
def reject_subscription(
    sub_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    sub = db.query(Subscription).filter(Subscription.id == sub_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    sub.status = "cancelled"
    db.commit()
    return {"message": "Subscription rejected", "id": sub_id}


class UpdateSubscriptionIn(BaseModel):
    plan_type: str
    billing_type: str
    status: str
    amount_paid: float = 0.0
    currency: str = "AED"
    expires_at: Optional[str] = None  # ISO date string or null for lifetime


@router.patch("/admin/subscriptions/{sub_id}")
def update_subscription(
    sub_id: int,
    body: UpdateSubscriptionIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    """Admin manually edits any subscription — plan, billing type, status, amount, expiry."""
    sub = db.query(Subscription).filter(Subscription.id == sub_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")

    now = datetime.now(timezone.utc)
    sub.plan_type = body.plan_type
    sub.billing_type = body.billing_type
    sub.status = body.status
    sub.amount_paid = body.amount_paid
    sub.currency = body.currency

    if body.expires_at:
        try:
            # Accept "YYYY-MM-DD" or full ISO string
            raw = body.expires_at[:10]  # take date part only
            sub.expires_at = datetime.strptime(raw, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except Exception:
            sub.expires_at = None
    else:
        # Auto-calculate if activating a paid plan without explicit date
        if body.status == "active" and not body.expires_at:
            if body.billing_type == "monthly":
                sub.expires_at = now + timedelta(days=30)
            elif body.billing_type == "yearly":
                sub.expires_at = now + timedelta(days=365)
            else:
                sub.expires_at = None  # Lifetime
        elif body.status == "trial":
            sub.expires_at = now + timedelta(days=14)
            sub.trial_ends_at = now + timedelta(days=14)
        else:
            sub.expires_at = None

    if body.status in ("active", "trial") and not sub.starts_at:
        sub.starts_at = now

    db.commit()
    return {"message": "Subscription updated", "id": sub_id}


# ── Dashboard quick panels ────────────────────────────────────────────────────

@router.get("/admin/pending-subscriptions")
def pending_subscriptions(
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    """Accounts awaiting manual admin approval (pending_approval = new registrations, trial = legacy)."""
    subs = db.query(Subscription).options(joinedload(Subscription.shop)).filter(
        Subscription.status.in_(["pending_approval", "trial"])
    ).order_by(Subscription.created_at.desc()).limit(50).all()

    return [
        {
            "id": sub.id,
            "shop_name": sub.shop.name if sub.shop else "Unknown",
            "plan_type": sub.plan_type,
            "amount_paid": float(sub.amount_paid) if sub.amount_paid else 0,
            "currency": sub.currency,
            "created_at": sub.created_at.isoformat() if sub.created_at else None,
        }
        for sub in subs
    ]


@router.get("/admin/expiring-subscriptions")
def expiring_subscriptions(
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    """Active subscriptions expiring in the next 7 days."""
    now = datetime.now(timezone.utc)
    seven_days = now + timedelta(days=7)
    subs = db.query(Subscription).options(joinedload(Subscription.shop)).filter(
        Subscription.status == "active",
        Subscription.expires_at != None,
        Subscription.expires_at <= seven_days,
        Subscription.expires_at >= now,
    ).order_by(Subscription.expires_at).limit(10).all()

    return [
        {
            "id": sub.id,
            "shop_name": sub.shop.name if sub.shop else "Unknown",
            "plan_type": sub.plan_type,
            "billing_type": sub.billing_type,
            "expires_at": sub.expires_at.isoformat() if sub.expires_at else None,
            "days_left": max(0, (sub.expires_at - now).days) if sub.expires_at else 0,
        }
        for sub in subs
    ]


@router.get("/admin/recent-shops")
def recent_shops(
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    """Last 10 registered shops for the dashboard."""
    shops = db.query(Shop).options(
        joinedload(Shop.owner),
        joinedload(Shop.subscription),
    ).order_by(Shop.created_at.desc()).limit(10).all()

    return [
        {
            "id": shop.id,
            "name": shop.name,
            "owner": shop.owner.full_name,
            "plan": shop.subscription.plan_type if shop.subscription else "none",
            "subscription_status": shop.subscription.status if shop.subscription else "none",
            "is_active": shop.is_active,
            "created_at": shop.created_at.isoformat() if shop.created_at else None,
        }
        for shop in shops
    ]


# ── Leads ─────────────────────────────────────────────────────────────────────

@router.get("/admin/leads", response_model=List[LeadOut])
def list_leads(
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    query = db.query(Lead)
    if search:
        q = f"%{search}%"
        query = query.filter(
            (Lead.name.ilike(q)) | (Lead.shop_name.ilike(q)) |
            (Lead.phone.ilike(q)) | (Lead.email.ilike(q))
        )
    if status_filter:
        query = query.filter(Lead.status == status_filter)
    return query.order_by(Lead.created_at.desc()).all()


@router.post("/admin/leads", response_model=LeadOut, status_code=201)
def create_lead(
    data: LeadCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    lead = Lead(**data.model_dump())
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead


@router.put("/admin/leads/{lead_id}", response_model=LeadOut)
def update_lead(
    lead_id: int,
    data: LeadUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(lead, key, val)
    db.commit()
    db.refresh(lead)
    return lead


@router.delete("/admin/leads/{lead_id}", status_code=204)
def delete_lead(
    lead_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    db.delete(lead)
    db.commit()


# ── Reports ───────────────────────────────────────────────────────────────────

@router.get("/admin/reports")
def get_admin_reports(
    date_range: Optional[str] = "last_30_days",
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    now = datetime.now(timezone.utc)

    # Determine start date based on range
    range_map = {
        "last_7_days": timedelta(days=7),
        "last_30_days": timedelta(days=30),
        "last_90_days": timedelta(days=90),
        "this_year": timedelta(days=365),
    }
    delta = range_map.get(date_range or "last_30_days", timedelta(days=30))
    start_date = now - delta

    # Monthly revenue: group active subscriptions by month of created_at
    monthly_rows = (
        db.query(
            func.date_trunc("month", Subscription.created_at).label("month"),
            func.sum(Subscription.amount_paid).label("total"),
        )
        .filter(
            Subscription.status == "active",
            Subscription.created_at >= start_date,
        )
        .group_by(func.date_trunc("month", Subscription.created_at))
        .order_by(func.date_trunc("month", Subscription.created_at))
        .all()
    )
    monthly_revenue = [
        {
            "month": row.month.strftime("%b") if row.month else "",
            "value": float(row.total or 0),
        }
        for row in monthly_rows
    ]

    # Top shops: by number of active subscriptions (proxy for revenue activity)
    top_shop_rows = (
        db.query(
            Shop,
            func.coalesce(func.sum(Subscription.amount_paid), 0).label("revenue"),
        )
        .join(Subscription, Subscription.shop_id == Shop.id, isouter=True)
        .filter(Shop.is_active == True)
        .group_by(Shop.id)
        .order_by(func.coalesce(func.sum(Subscription.amount_paid), 0).desc())
        .limit(10)
        .all()
    )
    top_shops = [
        {
            "name": shop.name,
            "revenue": float(revenue or 0),
        }
        for shop, revenue in top_shop_rows
    ]

    # Plan distribution
    plan_rows = (
        db.query(
            Subscription.plan_type,
            func.count(Subscription.id).label("count"),
        )
        .filter(Subscription.status == "active")
        .group_by(Subscription.plan_type)
        .all()
    )
    total_subs = sum(row.count for row in plan_rows) or 1
    plan_distribution = [
        {
            "plan": row.plan_type or "Unknown",
            "count": row.count,
            "percentage": round((row.count / total_subs) * 100),
        }
        for row in plan_rows
    ]

    # Quick stats for the selected range
    new_shops = db.query(func.count(Shop.id)).filter(Shop.created_at >= start_date).scalar() or 0
    new_users = (
        db.query(func.count(User.id))
        .filter(User.is_superuser == False, User.created_at >= start_date)
        .scalar() or 0
    )
    payments_count = (
        db.query(func.count(Subscription.id))
        .filter(Subscription.status == "active", Subscription.created_at >= start_date)
        .scalar() or 0
    )
    total_active_shops = db.query(func.count(Shop.id)).filter(Shop.is_active == True).scalar() or 1
    total_revenue = db.query(func.sum(Subscription.amount_paid)).filter(
        Subscription.status == "active"
    ).scalar() or 0
    avg_revenue_per_shop = float(total_revenue) / total_active_shops

    return {
        "monthly_revenue": monthly_revenue,
        "top_shops": top_shops,
        "plan_distribution": plan_distribution,
        "quick_stats": {
            "new_shops": new_shops,
            "new_users": new_users,
            "payments_count": payments_count,
            "avg_revenue_per_shop": round(avg_revenue_per_shop, 2),
            "total_revenue": float(total_revenue),
        },
    }


# ── Affiliates ────────────────────────────────────────────────────────────────

def _affiliate_out(affiliate: Affiliate, db: Session) -> dict:
    total_earned = db.query(func.sum(Commission.amount)).filter(
        Commission.affiliate_id == affiliate.id,
        Commission.status == "paid",
    ).scalar() or 0
    pending_amount = db.query(func.sum(Commission.amount)).filter(
        Commission.affiliate_id == affiliate.id,
        Commission.status == "pending",
    ).scalar() or 0
    referral_count = db.query(func.count(User.id)).filter(
        User.referred_by_code == affiliate.referral_code
    ).scalar() or 0
    return {
        "id": affiliate.id,
        "name": affiliate.name,
        "email": affiliate.email,
        "phone": affiliate.phone,
        "company": affiliate.company,
        "website": affiliate.website,
        "how_promote": affiliate.how_promote,
        "referral_code": affiliate.referral_code,
        "referral_link": f"https://exiuscart.com/register?ref={affiliate.referral_code}",
        "affiliate_type": affiliate.affiliate_type,
        "status": affiliate.status,
        "commission_monthly": 25.0,
        "commission_yearly": 75.0,
        "total_earned": float(total_earned),
        "pending_amount": float(pending_amount),
        "referral_count": referral_count,
        "notes": affiliate.notes,
        "payout_method": affiliate.payout_method or "",
        "paypal_email": affiliate.paypal_email or "",
        "skrill_email": affiliate.skrill_email or "",
        "payoneer_id": affiliate.payoneer_id or "",
        "created_at": affiliate.created_at,
        "approved_at": affiliate.approved_at,
    }


@router.get("/admin/affiliates")
def list_affiliates(
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    query = db.query(Affiliate)
    if search:
        q = f"%{search}%"
        query = query.filter(
            (Affiliate.name.ilike(q)) | (Affiliate.email.ilike(q)) | (Affiliate.referral_code.ilike(q))
        )
    if status_filter:
        query = query.filter(Affiliate.status == status_filter)
    affiliates = query.order_by(Affiliate.created_at.desc()).all()
    return [_affiliate_out(a, db) for a in affiliates]


@router.get("/admin/affiliates/{affiliate_id}")
def get_affiliate(
    affiliate_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    affiliate = db.query(Affiliate).filter(Affiliate.id == affiliate_id).first()
    if not affiliate:
        raise HTTPException(status_code=404, detail="Affiliate not found")
    result = _affiliate_out(affiliate, db)
    # Include commission history
    commissions = db.query(Commission).options(
        joinedload(Commission.shop)
    ).filter(Commission.affiliate_id == affiliate_id).order_by(Commission.created_at.desc()).all()
    result["commissions"] = [
        {
            "id": c.id,
            "shop_name": c.shop.name if c.shop else "",
            "amount": float(c.amount),
            "currency": c.currency,
            "status": c.status,
            "paid_at": c.paid_at,
            "created_at": c.created_at,
        }
        for c in commissions
    ]
    return result


@router.put("/admin/affiliates/{affiliate_id}/status")
def update_affiliate_status(
    affiliate_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    affiliate = db.query(Affiliate).filter(Affiliate.id == affiliate_id).first()
    if not affiliate:
        raise HTTPException(status_code=404, detail="Affiliate not found")
    was_pending = affiliate.status == "pending"
    if affiliate.status == "pending":
        affiliate.status = "active"
        affiliate.approved_at = datetime.now(timezone.utc)
    elif affiliate.status == "active":
        affiliate.status = "suspended"
    else:
        affiliate.status = "active"
    db.commit()

    # Send approval email with password setup link only when transitioning from pending → active
    if was_pending:
        try:
            setup_token = create_access_token(
                data={"sub": str(affiliate.id), "purpose": "affiliate_setup"},
                expires_delta=timedelta(hours=72),
            )
            setup_url = f"https://affiliates.exiuscart.com/setup-password?token={setup_token}"
            send_affiliate_approved_email(
                to=affiliate.email,
                full_name=affiliate.name,
                setup_url=setup_url,
            )
        except Exception:
            pass

    return {"status": affiliate.status}


@router.put("/admin/commissions/{commission_id}/approve")
def approve_commission(
    commission_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    commission = db.query(Commission).filter(Commission.id == commission_id).first()
    if not commission:
        raise HTTPException(status_code=404, detail="Commission not found")
    commission.status = "approved"
    commission.approved_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Commission approved for payout"}


@router.put("/admin/commissions/{commission_id}/pay")
def mark_commission_paid(
    commission_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    commission = db.query(Commission).filter(Commission.id == commission_id).first()
    if not commission:
        raise HTTPException(status_code=404, detail="Commission not found")
    commission.status = "paid"
    commission.paid_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Commission marked as paid"}


# ── Public: Affiliate Application ────────────────────────────────────────────

import random
import string


class AffiliateApply(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    company: Optional[str] = None
    website: Optional[str] = None
    how_promote: Optional[str] = None
    # "external" (anyone) or "shop_owner" (existing ExiusCart customer — higher rates)
    affiliate_type: str = "external"


def _generate_referral_code(name: str, db: Session) -> str:
    """Generate a unique referral code like JOHN8F2A."""
    prefix = ''.join(c for c in name.upper() if c.isalpha())[:4].ljust(4, 'X')
    for _ in range(20):
        suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
        code = f"{prefix}{suffix}"
        if not db.query(Affiliate).filter(Affiliate.referral_code == code).first():
            return code
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=10))


@router.post("/affiliates/apply", status_code=201)
def apply_as_affiliate(
    data: AffiliateApply,
    db: Session = Depends(get_db),
):
    """
    Public endpoint — anyone can apply to become an affiliate.
    Shop owners must apply with their ExiusCart account email — they get higher rates.
    Commission tiers (per calendar month of paid referrals):
      External:    1-10 → 20%,  11+ → 35%
      Shop owner:  1-10 → 25%,  11+ → 40%
    """
    existing = db.query(Affiliate).filter(Affiliate.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="This email is already registered as an affiliate.")

    # Shop owner path — verify they have an active ExiusCart account
    if data.affiliate_type == "shop_owner":
        user = db.query(User).filter(User.email == data.email, User.is_active == True).first()
        if not user:
            raise HTTPException(
                status_code=400,
                detail="No active ExiusCart account found with this email. "
                       "Please use the email you registered your shop with.",
            )
        shop = db.query(Shop).filter(Shop.owner_id == user.id).first()
        if not shop:
            raise HTTPException(
                status_code=400,
                detail="No shop found for this account. "
                       "Please register your shop on ExiusCart first.",
            )
        base_rate = 25.00
        tier2_rate = 40.00
    else:
        base_rate = 20.00
        tier2_rate = 35.00

    referral_code = _generate_referral_code(data.name, db)
    affiliate = Affiliate(
        name=data.name,
        email=data.email,
        phone=data.phone,
        company=data.company,
        website=data.website,
        how_promote=data.how_promote,
        referral_code=referral_code,
        affiliate_type=data.affiliate_type,
        status="pending",
        commission_rate=base_rate,
        commission_rate_tier2=tier2_rate,
        tier_threshold=10,
    )
    db.add(affiliate)
    db.commit()
    db.refresh(affiliate)

    # Send pending-review confirmation email (fire-and-forget, don't fail if email fails)
    try:
        send_affiliate_pending_email(to=data.email, full_name=data.name)
    except Exception:
        pass

    return {
        "message": "Your affiliate application has been submitted! We'll review it and get back to you within 24 hours.",
        "referral_code": referral_code,
        "affiliate_type": data.affiliate_type,
        "commission_monthly": 25.0,
        "commission_yearly": 75.0,
    }


# ── Shopping: Admin product management ───────────────────────────────────────

from slugify import slugify
import uuid as _uuid


def _slugify_unique(name: str) -> str:
    base = slugify(name)
    return f"{base}-{_uuid.uuid4().hex[:6]}"


def _shopping_product_out(p: Product) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "price": float(p.price),
        "cost_price": float(p.cost_price) if p.cost_price else None,
        "currency": "USD",
        "image_url": p.image_url,
        "video_url": p.video_url,
        "source_url": getattr(p, "source_url", None),
        "is_active": p.is_active,
        "is_featured": p.is_featured,
        "is_trending": p.is_trending,
        "stock": p.quantity,
        "sku": p.sku,
        "category_id": p.category_id,
        "category_name": p.category.name if p.category else None,
        "shop_id": p.shop_id,
        "shop_name": p.shop.name if p.shop else None,
        "created_at": p.created_at,
    }


class ShoppingProductCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: float                          # selling price in USD shown to dropshippers
    cost_price: Optional[float] = None   # buying/supplier price in USD
    sku: Optional[str] = None
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    source_url: Optional[str] = None     # supplier page (AliExpress, CJ, etc.)
    category_name: Optional[str] = None  # free-text, auto-creates category in admin shop
    is_featured: bool = False
    is_trending: bool = False
    is_active: bool = True


class ShoppingProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    cost_price: Optional[float] = None
    sku: Optional[str] = None
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    source_url: Optional[str] = None
    category_name: Optional[str] = None
    is_featured: Optional[bool] = None
    is_trending: Optional[bool] = None
    is_active: Optional[bool] = None


@router.get("/admin/shopping/products")
def admin_list_shopping_products(
    search: Optional[str] = None,
    shop_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    query = (
        db.query(Product)
        .join(Shop, Product.shop_id == Shop.id)
        .options(joinedload(Product.shop), joinedload(Product.category))
        .filter(Shop.slug == "exiuscart-dropshipping-system")
        .order_by(Product.is_trending.desc(), Product.is_featured.desc(), Product.created_at.desc())
    )
    if search:
        q = f"%{search}%"
        query = query.filter(Product.name.ilike(q))
    if shop_id:
        query = query.filter(Product.shop_id == shop_id)
    return [_shopping_product_out(p) for p in query.limit(200).all()]


def _get_or_create_category(db: Session, shop_id: int, name: str):
    from app.models.product import Category
    cat_slug = slugify(name)
    cat = db.query(Category).filter(Category.shop_id == shop_id, Category.slug == cat_slug).first()
    if not cat:
        cat = Category(name=name.strip().title(), slug=cat_slug, shop_id=shop_id)
        db.add(cat)
        db.flush()
    return cat


@router.post("/admin/shopping/upload-image")
async def admin_upload_shopping_image(
    file: UploadFile,
    _: User = Depends(require_superuser),
):
    """Upload a product image to R2 and return the public URL."""
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File must be under 10 MB")
    ext = (file.filename or "img").rsplit(".", 1)[-1].lower()
    from app.core.storage import upload_shop_image
    url = upload_shop_image(contents, 0, "catalog", ext, content_type=file.content_type or "image/jpeg")
    return {"url": url}


def _get_or_create_system_shop(db: Session, admin_user: User) -> Shop:
    """Get or create the dedicated ExiusCart Dropshipping system shop."""
    shop = db.query(Shop).filter(Shop.slug == "exiuscart-dropshipping-system").first()
    if not shop:
        shop = Shop(
            name="ExiusCart Dropshipping",
            slug="exiuscart-dropshipping-system",
            owner_id=admin_user.id,
            currency="USD",
            is_active=True,
        )
        db.add(shop)
        db.flush()
    return shop


@router.post("/admin/shopping/products", status_code=201)
def admin_create_shopping_product(
    data: ShoppingProductCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_superuser),
):
    shop = _get_or_create_system_shop(db, current_admin)

    cat_id = None
    if data.category_name:
        cat_id = _get_or_create_category(db, shop.id, data.category_name).id

    product = Product(
        name=data.name,
        slug=_slugify_unique(data.name),
        description=data.description,
        price=data.price,
        cost_price=data.cost_price,
        sku=data.sku,
        image_url=data.image_url,
        video_url=data.video_url,
        source_url=data.source_url,
        quantity=0,
        category_id=cat_id,
        shop_id=shop.id,
        is_featured=data.is_featured,
        is_trending=data.is_trending,
        is_active=data.is_active,
    )
    db.add(product)
    db.commit()
    product = db.query(Product).options(
        joinedload(Product.shop), joinedload(Product.category)
    ).filter(Product.id == product.id).first()
    return _shopping_product_out(product)


@router.put("/admin/shopping/products/{product_id}")
def admin_update_shopping_product(
    product_id: int,
    data: ShoppingProductUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        if field == "category_name":
            if value:
                product.category_id = _get_or_create_category(db, product.shop_id, value).id
            else:
                product.category_id = None
        elif field in ("name", "description", "price", "cost_price", "sku",
                       "image_url", "video_url", "source_url",
                       "is_featured", "is_trending", "is_active"):
            setattr(product, field, value)
    db.commit()
    product = db.query(Product).options(
        joinedload(Product.shop), joinedload(Product.category)
    ).filter(Product.id == product_id).first()
    return _shopping_product_out(product)


@router.delete("/admin/shopping/products/{product_id}", status_code=204)
def admin_delete_shopping_product(
    product_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(product)
    db.commit()


@router.get("/admin/shopping/shops")
def admin_list_shops_for_product(
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    """Returns active shops for the product-add shop selector."""
    shops = db.query(Shop).filter(Shop.is_active == True).order_by(Shop.name).all()
    return [{"id": s.id, "name": s.name, "currency": s.currency} for s in shops]


@router.get("/admin/shopping/categories")
def admin_list_categories(
    shop_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    query = db.query(Category)
    if shop_id:
        query = query.filter(Category.shop_id == shop_id)
    cats = query.order_by(Category.name).all()
    return [{"id": c.id, "name": c.name, "slug": c.slug, "shop_id": c.shop_id} for c in cats]


# ── NexCode Nova — One-time Client Codes ─────────────────────────────────────

import uuid as _uuid
import secrets as _secrets


def _generate_nexcode() -> str:
    """NEXC-XXXX-XXXX-XXXX format, 16 chars of randomness."""
    part = lambda: _secrets.token_hex(2).upper()
    return f"NEXC-{part()}-{part()}-{part()}"


class NexCodeCreate(BaseModel):
    client_email: Optional[str] = None
    plan_type: str = "premium"
    duration_months: Optional[int] = None   # None = lifetime
    max_uses: int = 1
    max_shops: int = 1
    notes: Optional[str] = None
    code_expires_days: Optional[int] = None  # days until code itself expires


@router.get("/admin/nexcodes")
def list_nexcodes(
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    codes = db.query(PartnerLicense).filter(
        PartnerLicense.partner_name == "nexcodenova"
    ).order_by(PartnerLicense.created_at.desc()).all()

    return [
        {
            "id": c.id,
            "code": c.code,
            "client_email": c.allowed_email,
            "plan_type": c.plan_type,
            "duration_months": c.duration_months,
            "max_uses": c.max_uses,
            "used_count": c.used_count,
            "max_shops": c.max_shops,
            "is_active": c.is_active,
            "notes": c.notes,
            "code_expires_at": c.code_expires_at,
            "created_at": c.created_at,
            "is_used_up": c.used_count >= c.max_uses,
        }
        for c in codes
    ]


@router.post("/admin/nexcodes", status_code=201)
def create_nexcode(
    data: NexCodeCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    code_value = _generate_nexcode()
    # Ensure uniqueness (extremely unlikely collision but handle it)
    while db.query(PartnerLicense).filter(PartnerLicense.code == code_value).first():
        code_value = _generate_nexcode()

    expires_at = None
    if data.code_expires_days:
        expires_at = datetime.now(timezone.utc) + timedelta(days=data.code_expires_days)

    license = PartnerLicense(
        code=code_value,
        partner_name="nexcodenova",
        plan_type=data.plan_type,
        duration_months=data.duration_months,
        max_uses=data.max_uses,
        used_count=0,
        allowed_email=data.client_email or None,
        max_shops=data.max_shops,
        is_active=True,
        notes=data.notes,
        code_expires_at=expires_at,
    )
    db.add(license)
    db.commit()
    db.refresh(license)

    return {
        "id": license.id,
        "code": license.code,
        "client_email": license.allowed_email,
        "plan_type": license.plan_type,
        "duration_months": license.duration_months,
        "max_uses": license.max_uses,
        "used_count": license.used_count,
        "max_shops": license.max_shops,
        "is_active": license.is_active,
        "notes": license.notes,
        "code_expires_at": license.code_expires_at,
        "created_at": license.created_at,
        "is_used_up": False,
    }


@router.put("/admin/nexcodes/{code_id}/toggle")
def toggle_nexcode(
    code_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    license = db.query(PartnerLicense).filter(
        PartnerLicense.id == code_id,
        PartnerLicense.partner_name == "nexcodenova",
    ).first()
    if not license:
        raise HTTPException(status_code=404, detail="Code not found")
    license.is_active = not license.is_active
    db.commit()
    return {"id": license.id, "is_active": license.is_active}


# ── Admin Settings ────────────────────────────────────────────────────────────

def _get_or_create_settings(db: Session) -> AdminSettings:
    settings = db.query(AdminSettings).filter(AdminSettings.id == 1).first()
    if not settings:
        settings = AdminSettings(id=1)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def _settings_out(s: AdminSettings) -> dict:
    return {
        "platform_name": s.platform_name,
        "support_email": s.support_email,
        "contact_phone": s.contact_phone,
        "website_url": s.website_url,
        "platform_description": s.platform_description,
        "notify_new_store": s.notify_new_store,
        "notify_payment_received": s.notify_payment_received,
        "notify_payment_pending": s.notify_payment_pending,
        "notify_subscription_expiring": s.notify_subscription_expiring,
        "notify_support_tickets": s.notify_support_tickets,
        "alert_system_errors": s.alert_system_errors,
        "alert_high_traffic": s.alert_high_traffic,
        "alert_failed_logins": s.alert_failed_logins,
        "notification_email_primary": s.notification_email_primary,
        "notification_email_secondary": s.notification_email_secondary,
        "require_2fa_admins": s.require_2fa_admins,
        "require_2fa_store_owners": s.require_2fa_store_owners,
        "session_timeout_minutes": s.session_timeout_minutes,
        "max_active_sessions": s.max_active_sessions,
        "lemonsqueezy_api_key": ("*" * 12 + s.lemonsqueezy_api_key[-4:]) if s.lemonsqueezy_api_key and len(s.lemonsqueezy_api_key) > 4 else s.lemonsqueezy_api_key,
        "lemonsqueezy_store_id": s.lemonsqueezy_store_id,
        "lemonsqueezy_webhook_secret": ("*" * 12) if s.lemonsqueezy_webhook_secret else "",
        "bank_transfer_enabled": s.bank_transfer_enabled,
        "bank_name": s.bank_name,
        "account_name": s.account_name,
        "account_number": s.account_number,
        "iban": s.iban,
        "swift_code": s.swift_code,
        "branch": s.branch,
        "invoice_prefix": s.invoice_prefix,
        "vat_number": s.vat_number,
        "vat_rate_aed": s.vat_rate_aed,
        "vat_rate_usd": s.vat_rate_usd,
        "auto_generate_invoices": s.auto_generate_invoices,
    }


class SettingsUpdate(BaseModel):
    platform_name: Optional[str] = None
    support_email: Optional[str] = None
    contact_phone: Optional[str] = None
    website_url: Optional[str] = None
    platform_description: Optional[str] = None
    notify_new_store: Optional[bool] = None
    notify_payment_received: Optional[bool] = None
    notify_payment_pending: Optional[bool] = None
    notify_subscription_expiring: Optional[bool] = None
    notify_support_tickets: Optional[bool] = None
    alert_system_errors: Optional[bool] = None
    alert_high_traffic: Optional[bool] = None
    alert_failed_logins: Optional[bool] = None
    notification_email_primary: Optional[str] = None
    notification_email_secondary: Optional[str] = None
    require_2fa_admins: Optional[bool] = None
    require_2fa_store_owners: Optional[bool] = None
    session_timeout_minutes: Optional[int] = None
    max_active_sessions: Optional[int] = None
    lemonsqueezy_api_key: Optional[str] = None
    lemonsqueezy_store_id: Optional[str] = None
    lemonsqueezy_webhook_secret: Optional[str] = None
    bank_transfer_enabled: Optional[bool] = None
    bank_name: Optional[str] = None
    account_name: Optional[str] = None
    account_number: Optional[str] = None
    iban: Optional[str] = None
    swift_code: Optional[str] = None
    branch: Optional[str] = None
    invoice_prefix: Optional[str] = None
    vat_number: Optional[str] = None
    vat_rate_aed: Optional[float] = None
    vat_rate_usd: Optional[float] = None
    auto_generate_invoices: Optional[bool] = None


@router.get("/admin/settings")
def get_settings(
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    return _settings_out(_get_or_create_settings(db))


@router.put("/admin/settings")
def update_settings(
    data: SettingsUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    settings = _get_or_create_settings(db)
    for field, value in data.model_dump(exclude_unset=True).items():
        # Skip masked values (don't overwrite with asterisks)
        if value and isinstance(value, str) and set(value) == {"*"}:
            continue
        setattr(settings, field, value)
    db.commit()
    db.refresh(settings)
    return _settings_out(settings)


@router.delete("/admin/nexcodes/{code_id}", status_code=204)
def delete_nexcode(
    code_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    license = db.query(PartnerLicense).filter(
        PartnerLicense.id == code_id,
        PartnerLicense.partner_name == "nexcodenova",
    ).first()
    if not license:
        raise HTTPException(status_code=404, detail="Code not found")
    db.delete(license)
    db.commit()
