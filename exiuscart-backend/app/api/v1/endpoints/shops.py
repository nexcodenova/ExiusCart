from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, status, Query, UploadFile
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date
from typing import List, Optional
from slugify import slugify
import uuid
from datetime import datetime, timezone, timedelta, date
from app.core.database import get_db
from app.core.thedersi import MONTHLY_ORDER_LIMITS
from app.models.user import User
from app.models.shop import Shop
from app.models.subscription import Subscription
from app.models.order import Order, OrderItem
from app.models.product import Product
from app.models.supplier import Supplier, PurchaseOrder, PurchaseOrderItem
from app.models.credit_note import CreditNote
from app.models.expense import Expense as ExpenseModel
from app.models.recurring_invoice import RecurringInvoice
from app.models.payroll import PayrollStaff, PayrollRun, PayrollItem
from app.models.loyalty import LoyaltyAccount, LoyaltyTransaction
from app.models.branch import Branch
from app.models.quotation import Quotation
from app.schemas.shop import ShopCreate, ShopResponse, ShopUpdate
from app.api.v1.deps import get_current_user
import math

# Plan catalogue (source of truth)
PLAN_CATALOGUE = {
    # ExiusCart direct plans
    "free_trial":      {"name": "Free Trial",  "price": 0,  "staff": 1},
    "starter":         {"name": "Starter",     "price": 45, "staff": 3},
    "premium":         {"name": "Premium",     "price": 99, "staff": 0},  # unlimited staff
    # TheDersi partner plans (billed through TheDersi, not ExiusCart)
    "thedersi_basic":  {"name": "Free Forever (TheDersi)", "price": 0, "staff": 1},
    "thedersi_pro":    {"name": "Pro (TheDersi)",          "price": 0, "staff": 3},  # starter features + unlimited orders
    # Legacy names — kept for backward compat
    "pro":             {"name": "Pro",         "price": 199, "staff": 2},
    "enterprise":      {"name": "Enterprise",  "price": 399, "staff": 5},
}

router = APIRouter()


def generate_slug(name: str) -> str:
    base_slug = slugify(name)
    return f"{base_slug}-{uuid.uuid4().hex[:6]}"


@router.get("/me", response_model=ShopResponse)
async def get_my_shop(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the first active shop for the current user (legacy compat)."""
    shop = db.query(Shop).filter(
        Shop.owner_id == current_user.id,
        Shop.is_active == True,
    ).order_by(Shop.id.asc()).first()
    if not shop:
        raise HTTPException(status_code=404, detail="No shop found")
    return shop


@router.post("/", response_model=ShopResponse, status_code=status.HTTP_201_CREATED)
async def create_shop(
    shop_data: ShopCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    new_shop = Shop(
        **shop_data.model_dump(),
        slug=generate_slug(shop_data.name),
        owner_id=current_user.id
    )
    db.add(new_shop)
    db.commit()
    db.refresh(new_shop)
    return new_shop


@router.get("/", response_model=List[ShopResponse])
async def get_my_shops(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    shops = db.query(Shop).filter(Shop.owner_id == current_user.id).all()
    return shops


@router.get("/{shop_id}", response_model=ShopResponse)
async def get_shop(
    shop_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    shop = db.query(Shop).filter(
        Shop.id == shop_id,
        Shop.owner_id == current_user.id
    ).first()

    if not shop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shop not found"
        )
    return shop


@router.put("/me", response_model=ShopResponse)
async def update_my_shop(
    shop_data: ShopUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the current user's primary shop (used by settings page)."""
    shop = db.query(Shop).filter(
        Shop.owner_id == current_user.id,
        Shop.is_active == True,
    ).order_by(Shop.id.asc()).first()
    if not shop:
        raise HTTPException(status_code=404, detail="No shop found")
    update_data = shop_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(shop, field, value)
    db.commit()
    db.refresh(shop)
    return shop


@router.put("/{shop_id}", response_model=ShopResponse)
async def update_shop(
    shop_id: int,
    shop_data: ShopUpdate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    shop = db.query(Shop).filter(
        Shop.id == shop_id,
        Shop.owner_id == current_user.id
    ).first()

    if not shop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shop not found"
        )

    update_data = shop_data.model_dump(exclude_unset=True)
    _thedersi_profile_fields = {"logo_url", "banner_url", "about_text", "social_instagram", "social_tiktok", "social_facebook", "brand_color"}
    profile_changed = bool(update_data.keys() & _thedersi_profile_fields)

    for field, value in update_data.items():
        setattr(shop, field, value)

    db.commit()
    db.refresh(shop)

    # Notify TheDersi if any storefront profile field changed
    if profile_changed:
        from app.models.channel import ChannelConnection
        from app.core.thedersi import notify_thedersi_profile_updated
        conn = db.query(ChannelConnection).filter(
            ChannelConnection.shop_id == shop_id,
            ChannelConnection.channel_type == "thedersi",
            ChannelConnection.is_active == True,
        ).first()
        if conn and conn.channel_seller_id:
            background_tasks.add_task(
                notify_thedersi_profile_updated,
                conn.channel_seller_id,
                shop.logo_url,
                shop.banner_url,
                shop.about_text,
                shop.social_instagram,
                shop.social_tiktok,
                shop.social_facebook,
                shop.brand_color,
            )

    return shop


_ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"}


@router.post("/{shop_id}/upload-logo")
async def upload_shop_logo(
    shop_id: int,
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    if file.content_type not in _ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, WebP, GIF, SVG allowed")
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File must be under 5 MB")
    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "jpg"
    from app.core.storage import upload_shop_image
    try:
        url = upload_shop_image(contents, shop_id, "logo", ext, content_type=file.content_type or "image/jpeg")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Upload failed: {exc}")
    shop.logo_url = url
    db.commit()
    _fire_thedersi_profile(shop_id, shop, background_tasks, db)
    return {"logo_url": url}


@router.post("/{shop_id}/upload-banner")
async def upload_shop_banner(
    shop_id: int,
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    if file.content_type not in _ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, WebP, GIF, SVG allowed")
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File must be under 5 MB")
    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "jpg"
    from app.core.storage import upload_shop_image
    try:
        url = upload_shop_image(contents, shop_id, "banner", ext, content_type=file.content_type or "image/jpeg")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Upload failed: {exc}")
    shop.banner_url = url
    db.commit()
    _fire_thedersi_profile(shop_id, shop, background_tasks, db)
    return {"banner_url": url}


def _fire_thedersi_profile(shop_id: int, shop: Shop, background_tasks: BackgroundTasks, db: Session) -> None:
    from app.models.channel import ChannelConnection
    from app.core.thedersi import notify_thedersi_profile_updated
    conn = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.channel_type == "thedersi",
        ChannelConnection.is_active == True,
    ).first()
    if conn and conn.channel_seller_id:
        background_tasks.add_task(
            notify_thedersi_profile_updated,
            conn.channel_seller_id,
            shop.logo_url,
            shop.banner_url,
            shop.about_text,
            shop.social_instagram,
            shop.social_tiktok,
            shop.social_facebook,
            shop.brand_color,
        )


@router.delete("/{shop_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_shop(
    shop_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    shop = db.query(Shop).filter(
        Shop.id == shop_id,
        Shop.owner_id == current_user.id
    ).first()

    if not shop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shop not found"
        )

    db.delete(shop)
    db.commit()


# ── Subscription endpoints ─────────────────────────────────────────────────────

@router.get("/{shop_id}/subscription")
def get_shop_subscription(
    shop_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(
        Shop.id == shop_id, Shop.owner_id == current_user.id
    ).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    # Priority: active > trial > pending_approval > any other
    sub = db.query(Subscription).filter(
        Subscription.shop_id == shop_id,
        Subscription.status.in_(["active", "trial", "pending_approval"]),
    ).order_by(Subscription.created_at.desc()).first()
    if not sub:
        sub = db.query(Subscription).filter(
            Subscription.shop_id == shop_id
        ).order_by(Subscription.created_at.desc()).first()

    plan_info = None
    if sub:
        cat = PLAN_CATALOGUE.get(sub.plan_type, {})
        now = datetime.now(timezone.utc)
        expires = sub.expires_at
        days_left = None
        if expires:
            exp_utc = expires if expires.tzinfo else expires.replace(tzinfo=timezone.utc)
            days_left = (exp_utc - now).days

        # Auto-expire trial subscriptions when their time is up
        if sub.status == "trial" and days_left is not None and days_left < 0:
            sub.status = "expired"
            db.commit()

        source = "thedersi" if sub.promo_code in ("partner_thedersi", "domain_thedersi") else "exiuscart"

        # Channel/online orders this month (POS excluded — always unlimited)
        order_limit = MONTHLY_ORDER_LIMITS.get(sub.plan_type)
        orders_used = None
        if order_limit is not None:
            now_utc = datetime.now(timezone.utc)
            month_start = now_utc.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            orders_used = db.query(Order).filter(
                Order.shop_id == shop_id,
                Order.created_at >= month_start,
                Order.source != "pos",
            ).count()

        plan_info = {
            "plan_type": sub.plan_type,
            "source": source,
            "name": cat.get("name", sub.plan_type.replace("_", " ").title()),
            "price": cat.get("price", float(sub.amount_paid or 0)),
            "status": sub.status,
            "is_trial": sub.plan_type == "free_trial" and sub.status == "trial",
            "is_pending_approval": sub.status == "pending_approval",
            "is_expired": sub.status == "expired",
            "nextBilling": expires.isoformat() if expires else None,
            "trialEndsAt": sub.trial_ends_at.isoformat() if sub.trial_ends_at else None,
            "staffIncluded": cat.get("staff", 1),
            "extraStaff": 0,
            "extraStaffCost": 0,
            "staffUsed": 1,
            "daysLeft": max(0, days_left) if days_left is not None else None,
            "orders_limit": order_limit,
            "orders_used": orders_used,
        }

    # History: all subscriptions for this shop as billing events
    all_subs = db.query(Subscription).filter(Subscription.shop_id == shop_id).order_by(
        Subscription.created_at.desc()
    ).all()
    history = []
    for s in all_subs:
        cat = PLAN_CATALOGUE.get(s.plan_type, {})
        history.append({
            "id": s.id,
            "date": s.created_at.isoformat(),
            "description": f"{cat.get('name', s.plan_type.capitalize())} Plan — {s.billing_type}",
            "amount": float(s.amount_paid or cat.get("price", 0)),
            "status": s.status,
        })

    return {"plan": plan_info, "history": history}


@router.post("/{shop_id}/subscription/upgrade")
def request_plan_upgrade(
    shop_id: int,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Shop owner submits an upgrade request — admin approves manually."""
    shop = db.query(Shop).filter(
        Shop.id == shop_id, Shop.owner_id == current_user.id
    ).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    plan_id = body.get("plan")
    if plan_id not in PLAN_CATALOGUE:
        raise HTTPException(status_code=400, detail="Invalid plan")

    cat = PLAN_CATALOGUE[plan_id]
    new_sub = Subscription(
        shop_id=shop_id,
        plan_type=plan_id,
        billing_type="monthly",
        status="pending_approval",
        amount_paid=cat["price"],
        currency="AED",
    )
    db.add(new_sub)
    db.commit()
    db.refresh(new_sub)
    return {"message": "Upgrade request submitted. Admin will activate it shortly.", "subscription_id": new_sub.id}


@router.post("/{shop_id}/subscription/checkout")
async def create_subscription_checkout(
    shop_id: int,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Creates a Lemon Squeezy checkout session for a paid plan and returns the
    checkout URL. The seller pays on Lemon Squeezy's hosted page; a webhook then
    confirms the payment and activates the plan automatically.
    """
    from app.core.lemonsqueezy import create_checkout, is_configured

    shop = db.query(Shop).filter(
        Shop.id == shop_id, Shop.owner_id == current_user.id
    ).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    plan_id = body.get("plan")
    billing_type = body.get("billing_type", "monthly")
    if plan_id not in ("starter", "premium"):
        raise HTTPException(status_code=400, detail="Lemon Squeezy checkout is only available for Starter and Premium plans.")
    if billing_type not in ("monthly", "yearly"):
        raise HTTPException(status_code=400, detail="billing_type must be 'monthly' or 'yearly'.")
    if not is_configured():
        raise HTTPException(status_code=503, detail="Online payment is not configured yet. Please contact support.")

    try:
        checkout_url = await create_checkout(
            shop_id=shop_id,
            plan_type=plan_id,
            billing_type=billing_type,
            customer_email=current_user.email,
            customer_name=current_user.full_name or shop.name,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    return {"checkout_url": checkout_url}


# ── Reports endpoints ──────────────────────────────────────────────────────────

@router.get("/{shop_id}/reports/sales")
def get_sales_report(
    shop_id: int,
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    query = db.query(
        cast(Order.created_at, Date).label("day"),
        func.sum(Order.total).label("sales"),
        func.count(Order.id).label("orders"),
    ).filter(Order.shop_id == shop_id, Order.status != "cancelled")

    if from_date:
        query = query.filter(Order.created_at >= from_date)
    if to_date:
        query = query.filter(Order.created_at <= to_date + " 23:59:59")

    rows = query.group_by(cast(Order.created_at, Date)).order_by(cast(Order.created_at, Date)).all()
    return [{"date": str(r.day), "sales": float(r.sales or 0), "orders": r.orders} for r in rows]


@router.get("/{shop_id}/reports/top-products")
def get_top_products(
    shop_id: int,
    limit: int = 5,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    rows = (
        db.query(
            Product.name,
            func.sum(OrderItem.quantity).label("qty_sold"),
            func.sum(OrderItem.total_price).label("revenue"),
        )
        .join(OrderItem, OrderItem.product_id == Product.id)
        .join(Order, Order.id == OrderItem.order_id)
        .filter(Product.shop_id == shop_id, Order.status != "cancelled")
        .group_by(Product.id, Product.name)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(limit)
        .all()
    )
    return [{"name": r.name, "qty_sold": r.qty_sold or 0, "revenue": float(r.revenue or 0)} for r in rows]


@router.get("/{shop_id}/reports/channel-revenue")
def get_channel_revenue(
    shop_id: int,
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    query = db.query(
        Order.source,
        func.sum(Order.total).label("revenue"),
        func.count(Order.id).label("orders"),
    ).filter(Order.shop_id == shop_id, Order.status != "cancelled")

    if from_date:
        query = query.filter(Order.created_at >= from_date)
    if to_date:
        query = query.filter(Order.created_at <= to_date + " 23:59:59")

    rows = query.group_by(Order.source).all()
    return [{"source": r.source or "unknown", "revenue": float(r.revenue or 0), "orders": r.orders} for r in rows]


@router.get("/{shop_id}/reports/financial-summary")
def get_financial_summary(
    shop_id: int,
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    def apply_dates(q):
        if from_date:
            q = q.filter(Order.created_at >= from_date)
        if to_date:
            q = q.filter(Order.created_at <= to_date + " 23:59:59")
        return q

    def scalar(q):
        return float(q.scalar() or 0)

    base = lambda: apply_dates(db.query(Order).filter(Order.shop_id == shop_id))

    pos_revenue   = scalar(apply_dates(db.query(func.sum(Order.total)).filter(Order.shop_id == shop_id, Order.source == "pos",  Order.status != "cancelled")))
    pos_orders    = apply_dates(db.query(func.count(Order.id)).filter(Order.shop_id == shop_id, Order.source == "pos",  Order.status != "cancelled")).scalar() or 0
    chan_revenue  = scalar(apply_dates(db.query(func.sum(Order.total)).filter(Order.shop_id == shop_id, Order.source != "pos",  Order.status != "cancelled")))
    chan_orders   = apply_dates(db.query(func.count(Order.id)).filter(Order.shop_id == shop_id, Order.source != "pos",  Order.status != "cancelled")).scalar() or 0
    refund_q              = apply_dates(db.query(func.sum(Order.total)).filter(Order.shop_id == shop_id, Order.status == "cancelled", Order.payment_status.in_(["paid", "refunded"])))
    refund_amount         = scalar(refund_q)
    pos_refund_amount     = scalar(apply_dates(db.query(func.sum(Order.total)).filter(Order.shop_id == shop_id, Order.status == "cancelled", Order.payment_status.in_(["paid", "refunded"]), Order.source == "pos")))
    channel_refund_amount = scalar(apply_dates(db.query(func.sum(Order.total)).filter(Order.shop_id == shop_id, Order.status == "cancelled", Order.payment_status.in_(["paid", "refunded"]), Order.source != "pos")))
    cancelled_count = apply_dates(db.query(func.count(Order.id)).filter(Order.shop_id == shop_id, Order.status == "cancelled")).scalar() or 0

    return {
        "pos_revenue": pos_revenue,
        "pos_orders": int(pos_orders),
        "channel_revenue": chan_revenue,
        "channel_orders": int(chan_orders),
        "refund_amount": refund_amount,
        "pos_refund_amount": pos_refund_amount,
        "channel_refund_amount": channel_refund_amount,
        "cancelled_orders": int(cancelled_count),
    }


@router.get("/{shop_id}/reports/vat")
def get_vat_report(
    shop_id: int,
    year: Optional[int] = None,
    quarter: Optional[int] = None,
    vat_rate: float = Query(5.0, description="VAT rate percent (default 5 for UAE)"),
    prices_include_vat: bool = Query(True, description="Whether recorded prices already include VAT"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    VAT tax report — UAE 5% default, configurable for any country.
    Returns output VAT (collected on sales), input VAT (paid on purchases via cost price),
    and net VAT payable, grouped by month inside the requested period.
    """
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    now = datetime.now(timezone.utc)
    target_year = year or now.year
    rate = vat_rate / 100.0

    # Build month boundaries
    if quarter and quarter in (1, 2, 3, 4):
        start_month = (quarter - 1) * 3 + 1
        months = [start_month, start_month + 1, start_month + 2]
    else:
        months = list(range(1, 13))

    monthly_rows = []
    total_output = 0.0
    total_input = 0.0

    for m in months:
        try:
            period_start = datetime(target_year, m, 1, tzinfo=timezone.utc)
            # last day of month
            if m == 12:
                period_end = datetime(target_year + 1, 1, 1, tzinfo=timezone.utc)
            else:
                period_end = datetime(target_year, m + 1, 1, tzinfo=timezone.utc)
        except ValueError:
            continue

        # Output VAT: from sales (orders)
        sales_total = db.query(func.sum(Order.total)).filter(
            Order.shop_id == shop_id,
            Order.status != "cancelled",
            Order.created_at >= period_start,
            Order.created_at < period_end,
        ).scalar() or 0

        if prices_include_vat:
            output_vat = float(sales_total) * rate / (1 + rate)
            sales_excl_vat = float(sales_total) / (1 + rate)
        else:
            output_vat = float(sales_total) * rate
            sales_excl_vat = float(sales_total)

        # Input VAT: estimated from cost price of items sold
        cost_total = db.query(
            func.sum(Product.cost_price * OrderItem.quantity)
        ).join(
            OrderItem, OrderItem.product_id == Product.id
        ).join(
            Order, Order.id == OrderItem.order_id
        ).filter(
            Product.shop_id == shop_id,
            Order.status != "cancelled",
            Order.created_at >= period_start,
            Order.created_at < period_end,
        ).scalar() or 0

        input_vat = float(cost_total) * rate
        net_payable = output_vat - input_vat

        total_output += output_vat
        total_input += input_vat

        monthly_rows.append({
            "month": f"{target_year}-{m:02d}",
            "sales_total": round(float(sales_total), 2),
            "sales_excl_vat": round(sales_excl_vat, 2),
            "output_vat": round(output_vat, 2),
            "purchase_cost": round(float(cost_total), 2),
            "input_vat": round(input_vat, 2),
            "net_vat_payable": round(net_payable, 2),
        })

    return {
        "year": target_year,
        "quarter": quarter,
        "vat_rate": vat_rate,
        "currency": shop.currency or "AED",
        "tax_number": shop.tax_number,
        "total_output_vat": round(total_output, 2),
        "total_input_vat": round(total_input, 2),
        "total_net_payable": round(total_output - total_input, 2),
        "monthly": monthly_rows,
    }


# ── Inventory endpoints ────────────────────────────────────────────────────────

@router.get("/{shop_id}/inventory/low-stock")
def get_low_stock(
    shop_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    products = (
        db.query(Product)
        .filter(
            Product.shop_id == shop_id,
            Product.is_active == True,
            Product.quantity <= Product.low_stock_threshold,
        )
        .order_by(Product.quantity.asc())
        .all()
    )
    return [
        {
            "id": p.id,
            "name": p.name,
            "sku": p.sku,
            "quantity": p.quantity,
            "low_stock_threshold": p.low_stock_threshold,
            "is_out_of_stock": p.quantity == 0,
        }
        for p in products
    ]


@router.post("/{shop_id}/inventory/adjust")
def adjust_inventory(
    shop_id: int,
    body: dict,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    product_id = body.get("product_id")
    quantity = body.get("quantity", 0)

    product = db.query(Product).filter(Product.id == product_id, Product.shop_id == shop_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    product.quantity = max(0, product.quantity + quantity)

    # Keep variant quantities in sync so the edit modal stays accurate
    from app.models.product_variant import ProductVariant
    variants = db.query(ProductVariant).filter(ProductVariant.product_id == product_id).all()
    if variants:
        if len(variants) == 1:
            variants[0].quantity = product.quantity
        else:
            old_total = sum(v.quantity for v in variants)
            if old_total > 0:
                new_qtys = [round(v.quantity / old_total * product.quantity) for v in variants]
                diff = product.quantity - sum(new_qtys)
                new_qtys[-1] += diff
                for v, q in zip(variants, new_qtys):
                    v.quantity = max(0, q)

    db.commit()

    from app.api.v1.endpoints.channels import trigger_stock_sync
    trigger_stock_sync(product_id, shop_id, background_tasks)

    # Alert shop owner if product is now below low stock threshold
    if quantity < 0 and product.quantity <= product.low_stock_threshold:
        from app.core.email import send_low_stock_alert_email
        from app.models.user import User as UserModel
        owner = db.query(UserModel).filter(UserModel.id == shop.owner_id).first()
        if owner and owner.email:
            background_tasks.add_task(
                send_low_stock_alert_email,
                to_email=owner.email,
                shop_name=shop.name,
                low_stock_items=[{
                    "name": product.name,
                    "sku": product.sku or "",
                    "quantity": product.quantity,
                    "threshold": product.low_stock_threshold,
                }],
            )

    return {"id": product.id, "name": product.name, "quantity": product.quantity}


# ── Dashboard stats endpoint ───────────────────────────────────────────────────

@router.get("/{shop_id}/stats")
def get_dashboard_stats(
    shop_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    from app.models.customer import Customer
    from app.models.order import Order as Ord, OrderItem as OrdItem
    import decimal

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    # Today's sales
    today_sales = db.query(func.sum(Ord.total)).filter(
        Ord.shop_id == shop_id,
        Ord.status != "cancelled",
        Ord.created_at >= today_start,
    ).scalar() or 0

    # Today's orders
    today_orders = db.query(func.count(Ord.id)).filter(
        Ord.shop_id == shop_id,
        Ord.created_at >= today_start,
    ).scalar() or 0

    # Yesterday's sales for comparison
    yesterday_start = today_start - timedelta(days=1)
    yesterday_sales = db.query(func.sum(Ord.total)).filter(
        Ord.shop_id == shop_id,
        Ord.status != "cancelled",
        Ord.created_at >= yesterday_start,
        Ord.created_at < today_start,
    ).scalar() or 0

    sales_change = 0.0
    if float(yesterday_sales) > 0:
        sales_change = round(((float(today_sales) - float(yesterday_sales)) / float(yesterday_sales)) * 100, 1)

    # Total products & customers
    products_count = db.query(func.count(Product.id)).filter(
        Product.shop_id == shop_id, Product.is_active == True
    ).scalar() or 0
    customers_count = db.query(func.count(Customer.id)).filter(Customer.shop_id == shop_id).scalar() or 0

    # Low stock alerts
    low_stock = db.query(Product).filter(
        Product.shop_id == shop_id,
        Product.is_active == True,
        Product.quantity <= Product.low_stock_threshold,
    ).order_by(Product.quantity.asc()).limit(10).all()

    # Recent orders
    recent_orders = db.query(Ord).filter(Ord.shop_id == shop_id).order_by(
        Ord.created_at.desc()
    ).limit(5).all()

    # Order status breakdown (all time)
    from sqlalchemy import extract
    status_rows = db.query(Ord.status, func.count(Ord.id)).filter(
        Ord.shop_id == shop_id
    ).group_by(Ord.status).all()
    order_status_breakdown = {r[0]: r[1] for r in status_rows}

    # Sales by channel (last 30 days)
    thirty_ago = datetime.now(timezone.utc) - timedelta(days=30)
    channel_rows = db.query(
        Ord.source,
        func.sum(Ord.total).label("sales"),
        func.count(Ord.id).label("orders"),
    ).filter(
        Ord.shop_id == shop_id,
        Ord.status != "cancelled",
        Ord.created_at >= thirty_ago,
    ).group_by(Ord.source).all()
    channel_breakdown = [
        {"source": r[0] or "pos", "sales": float(r[1] or 0), "orders": int(r[2])}
        for r in channel_rows
    ]

    # Hourly order activity (last 24 hours)
    day_ago = datetime.now(timezone.utc) - timedelta(hours=24)
    hourly_rows = db.query(
        extract("hour", Ord.created_at).label("hour"),
        func.count(Ord.id).label("cnt"),
        func.sum(Ord.total).label("sales"),
    ).filter(
        Ord.shop_id == shop_id,
        Ord.created_at >= day_ago,
    ).group_by(extract("hour", Ord.created_at)).order_by(extract("hour", Ord.created_at)).all()
    hourly_orders = [
        {"hour": int(r.hour), "orders": int(r.cnt), "sales": float(r.sales or 0)}
        for r in hourly_rows
    ]

    # Top 5 products by revenue (last 30 days)
    from app.models.order import OrderItem as OrdItemModel
    top_products_rows = db.query(
        OrdItemModel.product_name,
        func.sum(OrdItemModel.total_price).label("revenue"),
        func.sum(OrdItemModel.quantity).label("qty"),
    ).join(Ord, Ord.id == OrdItemModel.order_id).filter(
        Ord.shop_id == shop_id,
        Ord.status != "cancelled",
        Ord.created_at >= thirty_ago,
    ).group_by(OrdItemModel.product_name).order_by(
        func.sum(OrdItemModel.total_price).desc()
    ).limit(5).all()
    top_products = [
        {"name": r[0] or "Unknown", "revenue": float(r[1] or 0), "qty": int(r[2] or 0)}
        for r in top_products_rows
    ]

    # KPI: avg order value (last 30 days, non-cancelled)
    aov_row = db.query(func.avg(Ord.total)).filter(
        Ord.shop_id == shop_id,
        Ord.status != "cancelled",
        Ord.created_at >= thirty_ago,
    ).scalar()
    avg_order_value = float(aov_row or 0)

    # KPI: fulfillment rate = delivered / (all non-cancelled) last 30 days
    total_non_cancelled = db.query(func.count(Ord.id)).filter(
        Ord.shop_id == shop_id,
        Ord.status != "cancelled",
        Ord.created_at >= thirty_ago,
    ).scalar() or 0
    delivered_count = db.query(func.count(Ord.id)).filter(
        Ord.shop_id == shop_id,
        Ord.status == "delivered",
        Ord.created_at >= thirty_ago,
    ).scalar() or 0
    fulfillment_rate = round((delivered_count / total_non_cancelled * 100), 1) if total_non_cancelled > 0 else 0

    # KPI: cancellation rate
    cancelled_count = db.query(func.count(Ord.id)).filter(
        Ord.shop_id == shop_id,
        Ord.status == "cancelled",
        Ord.created_at >= thirty_ago,
    ).scalar() or 0
    total_all = total_non_cancelled + cancelled_count
    cancellation_rate = round((cancelled_count / total_all * 100), 1) if total_all > 0 else 0

    # KPI: revenue this month vs last month
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_month_start = (month_start - timedelta(days=1)).replace(day=1)
    this_month_rev = float(db.query(func.sum(Ord.total)).filter(
        Ord.shop_id == shop_id, Ord.status != "cancelled", Ord.created_at >= month_start,
    ).scalar() or 0)
    last_month_rev = float(db.query(func.sum(Ord.total)).filter(
        Ord.shop_id == shop_id, Ord.status != "cancelled",
        Ord.created_at >= last_month_start, Ord.created_at < month_start,
    ).scalar() or 0)
    revenue_mom = round(((this_month_rev - last_month_rev) / last_month_rev * 100), 1) if last_month_rev > 0 else 0

    # KPI: new customers this month
    from app.models.customer import Customer as Cust
    new_customers_month = db.query(func.count(Cust.id)).filter(
        Cust.shop_id == shop_id,
        Cust.created_at >= month_start,
    ).scalar() or 0

    # Day-of-week breakdown (last 30 days)
    dow_rows = db.query(
        extract("dow", Ord.created_at).label("dow"),
        func.count(Ord.id).label("cnt"),
        func.sum(Ord.total).label("sales"),
    ).filter(
        Ord.shop_id == shop_id,
        Ord.created_at >= thirty_ago,
    ).group_by(extract("dow", Ord.created_at)).order_by(extract("dow", Ord.created_at)).all()
    dow_names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    dow_map = {int(r.dow): {"orders": int(r.cnt), "sales": float(r.sales or 0)} for r in dow_rows}
    daily_breakdown = [{"day": dow_names[i], "orders": dow_map.get(i, {}).get("orders", 0), "sales": dow_map.get(i, {}).get("sales", 0)} for i in range(7)]

    # ── Advanced stats (wrapped so a bug here never crashes the whole endpoint) ──
    adv: dict = {
        "allTimeRevenue": 0.0, "allTimeOrders": 0, "memberSince": "N/A",
        "thisWeekRevenue": 0.0, "thisWeekOrders": 0,
        "thisYearRevenue": 0.0, "thisYearOrders": 0,
        "todayAvgOrder": 0.0, "monthlyRevenue12m": [],
        "repeatCustomerRate": 0.0, "inventoryValue": 0.0,
        "outOfStockCount": 0, "topCustomers": [],
    }
    try:
        adv["allTimeRevenue"] = float(db.query(func.sum(Ord.total)).filter(
            Ord.shop_id == shop_id, Ord.status != "cancelled").scalar() or 0)
        adv["allTimeOrders"] = db.query(func.count(Ord.id)).filter(
            Ord.shop_id == shop_id, Ord.status != "cancelled").scalar() or 0
        adv["memberSince"] = shop.created_at.strftime("%b %Y") if shop.created_at else "N/A"

        week_start = today_start - timedelta(days=today_start.weekday())
        adv["thisWeekRevenue"] = float(db.query(func.sum(Ord.total)).filter(
            Ord.shop_id == shop_id, Ord.status != "cancelled", Ord.created_at >= week_start).scalar() or 0)
        adv["thisWeekOrders"] = db.query(func.count(Ord.id)).filter(
            Ord.shop_id == shop_id, Ord.status != "cancelled", Ord.created_at >= week_start).scalar() or 0

        year_start = today_start.replace(month=1, day=1)
        adv["thisYearRevenue"] = float(db.query(func.sum(Ord.total)).filter(
            Ord.shop_id == shop_id, Ord.status != "cancelled", Ord.created_at >= year_start).scalar() or 0)
        adv["thisYearOrders"] = db.query(func.count(Ord.id)).filter(
            Ord.shop_id == shop_id, Ord.status != "cancelled", Ord.created_at >= year_start).scalar() or 0

        adv["todayAvgOrder"] = float(db.query(func.avg(Ord.total)).filter(
            Ord.shop_id == shop_id, Ord.status != "cancelled", Ord.created_at >= today_start).scalar() or 0)

        # 12-month monthly breakdown
        monthly_revenue_12m = []
        now_utc = datetime.now(timezone.utc)
        for i in range(11, -1, -1):
            ref = now_utc.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            for _ in range(i):
                ref = (ref - timedelta(days=1)).replace(day=1)
            m_end = (ref + timedelta(days=32)).replace(day=1)
            m_rev = float(db.query(func.sum(Ord.total)).filter(
                Ord.shop_id == shop_id, Ord.status != "cancelled",
                Ord.created_at >= ref, Ord.created_at < m_end).scalar() or 0)
            m_orders = db.query(func.count(Ord.id)).filter(
                Ord.shop_id == shop_id, Ord.status != "cancelled",
                Ord.created_at >= ref, Ord.created_at < m_end).scalar() or 0
            monthly_revenue_12m.append({"month": ref.strftime("%b '%y"), "revenue": round(m_rev, 2), "orders": m_orders, "growth": 0})
        for idx in range(1, len(monthly_revenue_12m)):
            prev = monthly_revenue_12m[idx - 1]["revenue"]
            cur = monthly_revenue_12m[idx]["revenue"]
            monthly_revenue_12m[idx]["growth"] = round(((cur - prev) / prev * 100), 1) if prev > 0 else 0
        adv["monthlyRevenue12m"] = monthly_revenue_12m

        # Repeat customer rate
        repeat_sub = (
            db.query(Ord.customer_id, func.count(Ord.id).label("cnt"))
            .filter(Ord.shop_id == shop_id, Ord.status != "cancelled", Ord.customer_id.isnot(None))
            .group_by(Ord.customer_id).subquery()
        )
        total_c = db.query(func.count()).select_from(repeat_sub).scalar() or 0
        repeat_c = db.query(func.count()).select_from(repeat_sub).filter(repeat_sub.c.cnt >= 2).scalar() or 0
        adv["repeatCustomerRate"] = round((repeat_c / total_c * 100), 1) if total_c > 0 else 0

        inv_val = db.query(func.sum(Product.quantity * Product.cost_price)).filter(
            Product.shop_id == shop_id, Product.is_active == True,
            Product.cost_price.isnot(None), Product.cost_price > 0).scalar()
        adv["inventoryValue"] = float(inv_val or 0)

        adv["outOfStockCount"] = db.query(func.count(Product.id)).filter(
            Product.shop_id == shop_id, Product.is_active == True, Product.quantity <= 0).scalar() or 0

        from app.models.customer import Customer as Cust
        top_cust_rows = (
            db.query(Cust.id, Cust.name, func.count(Ord.id).label("orders"), func.sum(Ord.total).label("revenue"))
            .join(Ord, Ord.customer_id == Cust.id)
            .filter(Ord.shop_id == shop_id, Ord.status != "cancelled", Ord.created_at >= month_start)
            .group_by(Cust.id, Cust.name).order_by(func.sum(Ord.total).desc()).limit(5).all()
        )
        adv["topCustomers"] = [{"id": r[0], "name": r[1] or "Unknown", "orders": int(r[2]), "revenue": float(r[3] or 0)} for r in top_cust_rows]
    except Exception as _adv_err:
        logger.error(f"[dashboard advanced stats] {_adv_err}")

    return {
        "sales": float(today_sales),
        "salesChange": sales_change,
        "orders": today_orders,
        "ordersChange": 0,
        "products": products_count,
        "customers": customers_count,
        "cash": 0,
        "card": 0,
        "lowStockAlerts": [
            {"name": p.name, "stock": p.quantity, "min": p.low_stock_threshold}
            for p in low_stock
        ],
        "whatsappOrders": [],
        "recentOrders": [
            {
                "id": str(o.id),
                "customer": (o.customer.name if o.customer else "Customer"),
                "amount": str(o.total),
                "status": o.status,
                "time": o.created_at.isoformat(),
            }
            for o in recent_orders
        ],
        "orderStatusBreakdown": order_status_breakdown,
        "channelBreakdown": channel_breakdown,
        "hourlyOrders": hourly_orders,
        "topProducts": top_products,
        "avgOrderValue": avg_order_value,
        "fulfillmentRate": fulfillment_rate,
        "cancellationRate": cancellation_rate,
        "thisMonthRevenue": this_month_rev,
        "lastMonthRevenue": last_month_rev,
        "revenueMoM": revenue_mom,
        "newCustomersMonth": new_customers_month,
        "dailyBreakdown": daily_breakdown,
        **adv,
    }


# ── Supplier endpoints ─────────────────────────────────────────────────────────

@router.get("/{shop_id}/suppliers")
def list_suppliers(
    shop_id: int,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    q = db.query(Supplier).filter(Supplier.shop_id == shop_id, Supplier.is_active == True)
    if search:
        q = q.filter(Supplier.name.ilike(f"%{search}%"))
    return q.order_by(Supplier.name).all()


@router.post("/{shop_id}/suppliers", status_code=201)
def create_supplier(
    shop_id: int,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    supplier = Supplier(
        shop_id=shop_id,
        name=body.get("name", "").strip(),
        contact_name=body.get("contact_name") or None,
        phone=body.get("phone") or None,
        email=body.get("email") or None,
        address=body.get("address") or None,
        notes=body.get("notes") or None,
    )
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return {
        "id": supplier.id, "name": supplier.name,
        "contact_name": supplier.contact_name, "phone": supplier.phone,
        "email": supplier.email, "address": supplier.address,
    }


@router.put("/{shop_id}/suppliers/{supplier_id}")
def update_supplier(
    shop_id: int,
    supplier_id: int,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id, Supplier.shop_id == shop_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    for field in ("name", "contact_name", "phone", "email", "address", "notes"):
        if field in body:
            setattr(supplier, field, body[field] or None)
    db.commit()
    return {"id": supplier.id, "name": supplier.name}


@router.delete("/{shop_id}/suppliers/{supplier_id}", status_code=204)
def delete_supplier(
    shop_id: int,
    supplier_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id, Supplier.shop_id == shop_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    supplier.is_active = False
    db.commit()


# ── Purchase Order endpoints ───────────────────────────────────────────────────

def _next_po_number(db: Session, shop_id: int) -> str:
    count = db.query(func.count(PurchaseOrder.id)).filter(PurchaseOrder.shop_id == shop_id).scalar() or 0
    return f"PO-{shop_id:03d}-{count + 1:04d}"


def _po_out(po: PurchaseOrder) -> dict:
    return {
        "id": po.id,
        "po_number": po.po_number,
        "supplier": po.supplier.name if po.supplier else "Unknown",
        "supplier_id": po.supplier_id,
        "items": len(po.items),
        "total": float(po.total_amount or 0),
        "status": po.status,
        "notes": po.notes,
        "date": po.created_at.isoformat(),
        "received_at": po.received_at.isoformat() if po.received_at else None,
        "line_items": [
            {
                "id": item.id,
                "product_id": item.product_id,
                "product_name": item.product_name,
                "quantity_ordered": item.quantity_ordered,
                "quantity_received": item.quantity_received,
                "unit_cost": float(item.unit_cost),
                "total_cost": float(item.total_cost),
            }
            for item in po.items
        ],
    }


@router.get("/{shop_id}/purchases")
def list_purchases(
    shop_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    from sqlalchemy.orm import joinedload
    pos = (
        db.query(PurchaseOrder)
        .options(joinedload(PurchaseOrder.supplier), joinedload(PurchaseOrder.items))
        .filter(PurchaseOrder.shop_id == shop_id)
        .order_by(PurchaseOrder.created_at.desc())
        .all()
    )
    return [_po_out(po) for po in pos]


@router.post("/{shop_id}/purchases", status_code=201)
def create_purchase(
    shop_id: int,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    po = PurchaseOrder(
        shop_id=shop_id,
        supplier_id=body.get("supplier_id") or None,
        po_number=_next_po_number(db, shop_id),
        notes=body.get("notes") or None,
        status="pending",
    )
    db.add(po)
    db.flush()

    total = 0.0
    for row in body.get("items", []):
        qty = int(row.get("quantity_ordered", 1))
        cost = float(row.get("unit_cost", 0))
        product_id = row.get("product_id") or None
        product_name = row.get("product_name", "")
        if product_id:
            p = db.query(Product).filter(Product.id == product_id).first()
            if p:
                product_name = p.name
        item = PurchaseOrderItem(
            purchase_order_id=po.id,
            product_id=product_id,
            product_name=product_name,
            quantity_ordered=qty,
            quantity_received=0,
            unit_cost=cost,
            total_cost=qty * cost,
        )
        db.add(item)
        total += qty * cost

    po.total_amount = total
    db.commit()
    db.refresh(po)
    return _po_out(po)


@router.put("/{shop_id}/purchases/{po_id}/receive")
def mark_purchase_received(
    shop_id: int,
    po_id: int,
    body: dict,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark all or specific items as received — updates product inventory."""
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    from sqlalchemy.orm import joinedload
    po = db.query(PurchaseOrder).options(joinedload(PurchaseOrder.items), joinedload(PurchaseOrder.supplier)).filter(
        PurchaseOrder.id == po_id, PurchaseOrder.shop_id == shop_id
    ).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    received_qtys: dict = body.get("received_qtys", {})  # item_id -> qty

    restocked_product_ids: set = set()
    for item in po.items:
        qty = int(received_qtys.get(str(item.id), item.quantity_ordered))
        item.quantity_received = qty
        if item.product_id:
            product = db.query(Product).filter(Product.id == item.product_id).first()
            if product:
                product.quantity = product.quantity + qty
                if item.unit_cost:
                    product.cost_price = item.unit_cost
                restocked_product_ids.add(product.id)

    po.status = "received"
    po.received_at = datetime.now(timezone.utc)

    # Auto-create expense entry for this stock purchase
    from app.models.expense import Expense
    total_cost = sum(float(item.unit_cost or 0) * int(item.quantity_received or 0) for item in po.items)
    if total_cost > 0:
        supplier_name = po.supplier.name if po.supplier else "Unknown Supplier"
        db.add(Expense(
            shop_id=shop_id,
            category="Supplies / Product",
            description=f"{po.po_number} – {supplier_name}",
            amount=total_cost,
            date=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            payment_method="cash",
        ))

    db.commit()

    # Keep the marketplace stock count in sync after restocking (guard skips POS-only products)
    from app.api.v1.endpoints.channels import trigger_stock_sync
    for pid in restocked_product_ids:
        trigger_stock_sync(pid, shop_id, background_tasks)

    return _po_out(po)


# ── Credit Notes ───────────────────────────────────────────────────────────────

def _next_cn_number(db: Session, shop_id: int) -> str:
    count = db.query(func.count(CreditNote.id)).filter(CreditNote.shop_id == shop_id).scalar() or 0
    year = datetime.now(timezone.utc).year
    return f"CN-{year}-{count + 1:04d}"


def _cn_out(cn: CreditNote) -> dict:
    return {
        "id": cn.id,
        "cn_number": cn.cn_number,
        "order_id": cn.order_id,
        "order_number": cn.order.order_number if cn.order else None,
        "reason": cn.reason,
        "amount": float(cn.amount),
        "status": cn.status,
        "notes": cn.notes,
        "created_at": cn.created_at.isoformat() if cn.created_at else None,
    }


@router.get("/{shop_id}/credit-notes")
def list_credit_notes(
    shop_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    from sqlalchemy.orm import joinedload
    rows = (
        db.query(CreditNote)
        .options(joinedload(CreditNote.order))
        .filter(CreditNote.shop_id == shop_id)
        .order_by(CreditNote.id.desc())
        .all()
    )
    return [_cn_out(cn) for cn in rows]


@router.post("/{shop_id}/credit-notes", status_code=201)
def create_credit_note(
    shop_id: int,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    order_id = body.get("order_id") or None
    if order_id:
        order = db.query(Order).filter(Order.id == order_id, Order.shop_id == shop_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

    cn = CreditNote(
        cn_number=_next_cn_number(db, shop_id),
        shop_id=shop_id,
        order_id=order_id,
        reason=body.get("reason", "").strip(),
        amount=float(body.get("amount", 0)),
        notes=body.get("notes") or None,
        status="issued",
    )
    db.add(cn)
    db.commit()
    db.refresh(cn)
    from sqlalchemy.orm import joinedload
    cn = db.query(CreditNote).options(joinedload(CreditNote.order)).filter(CreditNote.id == cn.id).first()
    return _cn_out(cn)


@router.patch("/{shop_id}/credit-notes/{cn_id}/void", status_code=200)
def void_credit_note(
    shop_id: int,
    cn_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    cn = db.query(CreditNote).filter(CreditNote.id == cn_id, CreditNote.shop_id == shop_id).first()
    if not cn:
        raise HTTPException(status_code=404, detail="Credit note not found")
    cn.status = "voided"
    db.commit()
    return {"status": "voided"}


# ── Cash Flow Statement ────────────────────────────────────────────────────────

@router.get("/{shop_id}/reports/cash-flow")
def get_cash_flow(
    shop_id: int,
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    # Date range defaults to current month
    today = datetime.now(timezone.utc).date()
    try:
        d_from = date.fromisoformat(from_date) if from_date else today.replace(day=1)
        d_to   = date.fromisoformat(to_date)   if to_date   else today
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")

    # ── Operating Inflows: paid/completed orders ──────────────────────────────
    inflow_q = (
        db.query(func.sum(Order.total))
        .filter(
            Order.shop_id == shop_id,
            Order.payment_status.in_(["paid", "completed"]),
            cast(Order.created_at, Date) >= d_from,
            cast(Order.created_at, Date) <= d_to,
        )
        .scalar() or 0
    )
    total_inflows = float(inflow_q)

    # ── Operating Outflows: expenses ─────────────────────────────────────────
    expense_q = (
        db.query(func.sum(ExpenseModel.amount))
        .filter(
            ExpenseModel.shop_id == shop_id,
            ExpenseModel.date >= d_from.isoformat(),
            ExpenseModel.date <= d_to.isoformat(),
        )
        .scalar() or 0
    )
    total_expenses = float(expense_q)

    # ── Outflows: purchases received in period ────────────────────────────────
    purchase_q = (
        db.query(func.sum(PurchaseOrder.total_amount))
        .filter(
            PurchaseOrder.shop_id == shop_id,
            PurchaseOrder.status == "received",
            cast(PurchaseOrder.received_at, Date) >= d_from,
            cast(PurchaseOrder.received_at, Date) <= d_to,
        )
        .scalar() or 0
    )
    total_purchases = float(purchase_q)

    # ── Refunds (outflows) ────────────────────────────────────────────────────
    refund_q = (
        db.query(func.sum(Order.total))
        .filter(
            Order.shop_id == shop_id,
            Order.status == "cancelled",
            Order.payment_status.in_(["paid", "refunded"]),
            cast(Order.created_at, Date) >= d_from,
            cast(Order.created_at, Date) <= d_to,
        )
        .scalar() or 0
    )
    total_refunds = float(refund_q)

    total_outflows = total_expenses + total_purchases + total_refunds
    net_cash_flow  = total_inflows - total_outflows

    # ── Daily breakdown for chart ─────────────────────────────────────────────
    from sqlalchemy import text as sql_text
    days = (d_to - d_from).days + 1
    daily = []
    for i in range(days):
        day = d_from + timedelta(days=i)
        day_str = day.isoformat()

        day_in = float(
            db.query(func.sum(Order.total))
            .filter(
                Order.shop_id == shop_id,
                Order.payment_status.in_(["paid", "completed"]),
                cast(Order.created_at, Date) == day,
            ).scalar() or 0
        )
        day_out = float(
            db.query(func.sum(ExpenseModel.amount))
            .filter(
                ExpenseModel.shop_id == shop_id,
                ExpenseModel.date == day_str,
            ).scalar() or 0
        )
        daily.append({"date": day_str, "inflows": day_in, "outflows": day_out, "net": day_in - day_out})

    return {
        "from": d_from.isoformat(),
        "to": d_to.isoformat(),
        "total_inflows": total_inflows,
        "total_outflows": total_outflows,
        "total_expenses": total_expenses,
        "total_purchases": total_purchases,
        "total_refunds": total_refunds,
        "net_cash_flow": net_cash_flow,
        "daily": daily,
    }


# ── Recurring Invoices ─────────────────────────────────────────────────────────

def _next_ri_number(db: Session, shop_id: int) -> str:
    count = db.query(func.count(RecurringInvoice.id)).filter(RecurringInvoice.shop_id == shop_id).scalar() or 0
    year = datetime.now(timezone.utc).year
    return f"RI-{year}-{count + 1:04d}"


def _ri_out(ri: RecurringInvoice) -> dict:
    return {
        "id": ri.id,
        "customer_name": ri.customer_name,
        "customer_email": ri.customer_email,
        "customer_phone": ri.customer_phone,
        "items": ri.items,
        "subtotal": float(ri.subtotal),
        "discount": float(ri.discount),
        "tax": float(ri.tax),
        "total": float(ri.total),
        "notes": ri.notes,
        "frequency": ri.frequency,
        "next_send_date": ri.next_send_date.isoformat() if ri.next_send_date else None,
        "last_sent_at": ri.last_sent_at.isoformat() if ri.last_sent_at else None,
        "send_count": ri.send_count,
        "is_active": ri.is_active,
        "created_at": ri.created_at.isoformat() if ri.created_at else None,
    }


def _next_date_for_frequency(freq: str, from_date: date) -> date:
    if freq == "weekly":
        return from_date + timedelta(days=7)
    elif freq == "monthly":
        m = from_date.month + 1
        y = from_date.year + (m - 1) // 12
        m = (m - 1) % 12 + 1
        return from_date.replace(year=y, month=m)
    elif freq == "quarterly":
        m = from_date.month + 3
        y = from_date.year + (m - 1) // 12
        m = (m - 1) % 12 + 1
        return from_date.replace(year=y, month=m)
    else:  # yearly
        return from_date.replace(year=from_date.year + 1)


@router.get("/{shop_id}/recurring-invoices")
def list_recurring_invoices(
    shop_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    rows = db.query(RecurringInvoice).filter(RecurringInvoice.shop_id == shop_id).order_by(RecurringInvoice.id.desc()).all()
    return [_ri_out(r) for r in rows]


@router.post("/{shop_id}/recurring-invoices", status_code=201)
def create_recurring_invoice(
    shop_id: int,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    freq = body.get("frequency", "monthly")
    try:
        start = date.fromisoformat(body.get("start_date", date.today().isoformat()))
    except ValueError:
        start = date.today()

    ri = RecurringInvoice(
        shop_id=shop_id,
        customer_name=body.get("customer_name", ""),
        customer_email=body.get("customer_email") or None,
        customer_phone=body.get("customer_phone") or None,
        items=body.get("items", []),
        subtotal=float(body.get("subtotal", 0)),
        discount=float(body.get("discount", 0)),
        tax=float(body.get("tax", 0)),
        total=float(body.get("total", 0)),
        notes=body.get("notes") or None,
        frequency=freq,
        next_send_date=start,
        is_active=True,
    )
    db.add(ri)
    db.commit()
    db.refresh(ri)
    return _ri_out(ri)


@router.patch("/{shop_id}/recurring-invoices/{ri_id}")
def update_recurring_invoice(
    shop_id: int,
    ri_id: int,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    ri = db.query(RecurringInvoice).filter(RecurringInvoice.id == ri_id, RecurringInvoice.shop_id == shop_id).first()
    if not ri:
        raise HTTPException(status_code=404, detail="Not found")
    for field in ("customer_name", "customer_email", "customer_phone", "items",
                  "subtotal", "discount", "tax", "total", "notes", "frequency", "is_active"):
        if field in body:
            setattr(ri, field, body[field])
    db.commit()
    return _ri_out(ri)


@router.delete("/{shop_id}/recurring-invoices/{ri_id}", status_code=204)
def delete_recurring_invoice(
    shop_id: int,
    ri_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    ri = db.query(RecurringInvoice).filter(RecurringInvoice.id == ri_id, RecurringInvoice.shop_id == shop_id).first()
    if not ri:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(ri)
    db.commit()


@router.post("/{shop_id}/recurring-invoices/{ri_id}/send-now")
def send_recurring_invoice_now(
    shop_id: int,
    ri_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    ri = db.query(RecurringInvoice).filter(RecurringInvoice.id == ri_id, RecurringInvoice.shop_id == shop_id).first()
    if not ri:
        raise HTTPException(status_code=404, detail="Not found")
    if not ri.customer_email:
        raise HTTPException(status_code=400, detail="No customer email on this recurring invoice")

    from app.core.email import send_recurring_invoice_email
    inv_num = _next_ri_number(db, shop_id)
    send_recurring_invoice_email(
        to_email=ri.customer_email,
        customer_name=ri.customer_name,
        shop_name=shop.name,
        shop_logo_url=shop.logo_url,
        invoice_number=inv_num,
        items=ri.items,
        subtotal=float(ri.subtotal),
        discount=float(ri.discount),
        tax=float(ri.tax),
        total=float(ri.total),
        notes=ri.notes,
        currency=shop.currency or "USD",
    )
    ri.last_sent_at = datetime.now(timezone.utc)
    ri.send_count = (ri.send_count or 0) + 1
    ri.next_send_date = _next_date_for_frequency(ri.frequency, date.today())
    db.commit()
    return {"sent": True, "next_send_date": ri.next_send_date.isoformat()}


# ── P&L Statement ──────────────────────────────────────────────────────────────

@router.get("/{shop_id}/reports/pl")
def get_pl_statement(
    shop_id: int,
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    today = datetime.now(timezone.utc).date()
    try:
        d_from = date.fromisoformat(from_date) if from_date else today.replace(day=1)
        d_to   = date.fromisoformat(to_date)   if to_date   else today
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")

    # Revenue: paid orders in range
    revenue = float(
        db.query(func.sum(Order.total))
        .filter(
            Order.shop_id == shop_id,
            Order.payment_status == "paid",
            cast(Order.created_at, Date) >= d_from,
            cast(Order.created_at, Date) <= d_to,
        )
        .scalar() or 0
    )

    # Cost of goods: purchase orders received in range
    try:
        from app.models.supplier import PurchaseOrder as _PO
        cogs = float(
            db.query(func.sum(_PO.total_amount))
            .filter(
                _PO.shop_id == shop_id,
                _PO.status == "received",
                cast(_PO.received_at, Date) >= d_from,
                cast(_PO.received_at, Date) <= d_to,
            )
            .scalar() or 0
        )
    except Exception:
        cogs = 0.0

    gross_profit = revenue - cogs

    # Expenses by category
    expense_rows = (
        db.query(ExpenseModel.category, func.sum(ExpenseModel.amount).label("total"))
        .filter(
            ExpenseModel.shop_id == shop_id,
            ExpenseModel.date >= d_from.isoformat(),
            ExpenseModel.date <= d_to.isoformat(),
        )
        .group_by(ExpenseModel.category)
        .all()
    )
    expenses = [{"category": r.category, "total": float(r.total)} for r in expense_rows]
    total_expenses = sum(e["total"] for e in expenses)

    operating_profit = gross_profit - total_expenses

    # Tax paid
    tax_paid = float(
        db.query(func.sum(Order.tax_amount))
        .filter(
            Order.shop_id == shop_id,
            Order.payment_status == "paid",
            cast(Order.created_at, Date) >= d_from,
            cast(Order.created_at, Date) <= d_to,
        )
        .scalar() or 0
    )

    net_profit = operating_profit - tax_paid

    return {
        "from_date": d_from.isoformat(),
        "to_date": d_to.isoformat(),
        "currency": shop.currency or "AED",
        "revenue": revenue,
        "cost_of_goods": cogs,
        "gross_profit": gross_profit,
        "expenses": expenses,
        "total_expenses": total_expenses,
        "operating_profit": operating_profit,
        "tax_paid": tax_paid,
        "net_profit": net_profit,
    }


# ── Balance Sheet ──────────────────────────────────────────────────────────────

@router.get("/{shop_id}/reports/balance-sheet")
def get_balance_sheet(
    shop_id: int,
    as_of: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    today = datetime.now(timezone.utc).date()
    try:
        d_as_of = date.fromisoformat(as_of) if as_of else today
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")

    # Assets
    cash = float(
        db.query(func.sum(Order.total))
        .filter(
            Order.shop_id == shop_id,
            Order.payment_status == "paid",
            cast(Order.created_at, Date) <= d_as_of,
        )
        .scalar() or 0
    )

    accounts_receivable = float(
        db.query(func.sum(Quotation.total))
        .filter(
            Quotation.shop_id == shop_id,
            Quotation.status == "pending",
            cast(Quotation.created_at, Date) <= d_as_of,
        )
        .scalar() or 0
    )

    # Inventory value: quantity * price for active products
    products = (
        db.query(Product)
        .filter(Product.shop_id == shop_id, Product.is_active == True)
        .all()
    )
    inventory_value = sum(
        float(p.quantity or 0) * float(p.price or 0) for p in products
    )

    total_assets = cash + accounts_receivable + inventory_value

    # Liabilities
    try:
        from app.models.supplier import PurchaseOrder as _PO
        accounts_payable = float(
            db.query(func.sum(_PO.total_amount))
            .filter(
                _PO.shop_id == shop_id,
                _PO.status.notin_(["received", "cancelled"]),
                cast(_PO.created_at, Date) <= d_as_of,
            )
            .scalar() or 0
        )
    except Exception:
        accounts_payable = 0.0

    vat_payable = 0.0
    if shop.vat_enabled:
        vat_payable = float(
            db.query(func.sum(Order.tax_amount))
            .filter(
                Order.shop_id == shop_id,
                Order.payment_status == "paid",
                cast(Order.created_at, Date) <= d_as_of,
            )
            .scalar() or 0
        )

    total_liabilities = accounts_payable + vat_payable

    retained_earnings = total_assets - total_liabilities

    return {
        "as_of": d_as_of.isoformat(),
        "currency": shop.currency or "AED",
        "assets": {
            "cash": cash,
            "accounts_receivable": accounts_receivable,
            "inventory_value": inventory_value,
            "total_assets": total_assets,
        },
        "liabilities": {
            "accounts_payable": accounts_payable,
            "vat_payable": vat_payable,
            "total_liabilities": total_liabilities,
        },
        "equity": {
            "retained_earnings": retained_earnings,
        },
    }


# ── Payroll ────────────────────────────────────────────────────────────────────

def _staff_out(s: PayrollStaff) -> dict:
    return {
        "id": s.id,
        "shop_id": s.shop_id,
        "name": s.name,
        "role": s.role,
        "email": s.email,
        "phone": s.phone,
        "salary": float(s.salary),
        "currency": s.currency,
        "join_date": s.join_date.isoformat() if s.join_date else None,
        "is_active": s.is_active,
        "notes": s.notes,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


def _payroll_item_out(item: PayrollItem) -> dict:
    return {
        "id": item.id,
        "run_id": item.run_id,
        "staff_id": item.staff_id,
        "staff_name": item.staff_name,
        "role": item.role,
        "base_salary": float(item.base_salary),
        "bonus": float(item.bonus),
        "deduction": float(item.deduction),
        "net_pay": float(item.net_pay),
    }


def _run_out(run: PayrollRun, include_items: bool = False) -> dict:
    data = {
        "id": run.id,
        "shop_id": run.shop_id,
        "month": run.month,
        "year": run.year,
        "status": run.status,
        "total_amount": float(run.total_amount),
        "currency": run.currency,
        "notes": run.notes,
        "paid_at": run.paid_at.isoformat() if run.paid_at else None,
        "created_at": run.created_at.isoformat() if run.created_at else None,
    }
    if include_items:
        data["items"] = [_payroll_item_out(i) for i in run.items]
    return data


@router.get("/{shop_id}/payroll/staff")
def list_payroll_staff(
    shop_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    staff = (
        db.query(PayrollStaff)
        .filter(PayrollStaff.shop_id == shop_id, PayrollStaff.is_active == True)
        .order_by(PayrollStaff.id.asc())
        .all()
    )
    return [_staff_out(s) for s in staff]


@router.post("/{shop_id}/payroll/staff", status_code=201)
def create_payroll_staff(
    shop_id: int,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    join_date = None
    if body.get("join_date"):
        try:
            join_date = date.fromisoformat(body["join_date"])
        except ValueError:
            pass

    s = PayrollStaff(
        shop_id=shop_id,
        name=body.get("name", ""),
        role=body.get("role") or None,
        email=body.get("email") or None,
        phone=body.get("phone") or None,
        salary=float(body.get("salary", 0)),
        currency=body.get("currency", shop.currency or "AED"),
        join_date=join_date,
        is_active=True,
        notes=body.get("notes") or None,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return _staff_out(s)


@router.patch("/{shop_id}/payroll/staff/{staff_id}")
def update_payroll_staff(
    shop_id: int,
    staff_id: int,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    s = db.query(PayrollStaff).filter(PayrollStaff.id == staff_id, PayrollStaff.shop_id == shop_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Staff member not found")
    for field in ("name", "role", "email", "phone", "salary", "currency", "is_active", "notes"):
        if field in body:
            setattr(s, field, body[field])
    if "join_date" in body and body["join_date"]:
        try:
            s.join_date = date.fromisoformat(body["join_date"])
        except ValueError:
            pass
    db.commit()
    return _staff_out(s)


@router.delete("/{shop_id}/payroll/staff/{staff_id}", status_code=200)
def delete_payroll_staff(
    shop_id: int,
    staff_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    s = db.query(PayrollStaff).filter(PayrollStaff.id == staff_id, PayrollStaff.shop_id == shop_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Staff member not found")
    s.is_active = False
    db.commit()
    return {"status": "deactivated"}


@router.get("/{shop_id}/payroll/runs")
def list_payroll_runs(
    shop_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    runs = (
        db.query(PayrollRun)
        .filter(PayrollRun.shop_id == shop_id)
        .order_by(PayrollRun.year.desc(), PayrollRun.month.desc())
        .all()
    )
    return [_run_out(r) for r in runs]


@router.post("/{shop_id}/payroll/runs", status_code=201)
def create_payroll_run(
    shop_id: int,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    month = int(body.get("month", datetime.now(timezone.utc).month))
    year = int(body.get("year", datetime.now(timezone.utc).year))

    run = PayrollRun(
        shop_id=shop_id,
        month=month,
        year=year,
        status="draft",
        total_amount=0,
        currency=body.get("currency", shop.currency or "AED"),
        notes=body.get("notes") or None,
    )
    db.add(run)
    db.flush()

    items_data = body.get("items", [])
    total = 0.0
    for item_body in items_data:
        sid = item_body.get("staff_id")
        staff = db.query(PayrollStaff).filter(PayrollStaff.id == sid, PayrollStaff.shop_id == shop_id).first() if sid else None
        staff_name = (staff.name if staff else item_body.get("staff_name", "")) or ""
        role = (staff.role if staff else item_body.get("role")) or None
        base_salary = float(staff.salary if staff else item_body.get("base_salary", 0))
        bonus = float(item_body.get("bonus", 0))
        deduction = float(item_body.get("deduction", 0))
        net_pay = base_salary + bonus - deduction
        total += net_pay

        pi = PayrollItem(
            run_id=run.id,
            staff_id=sid,
            staff_name=staff_name,
            role=role,
            base_salary=base_salary,
            bonus=bonus,
            deduction=deduction,
            net_pay=net_pay,
        )
        db.add(pi)

    run.total_amount = total
    db.commit()
    db.refresh(run)
    return _run_out(run, include_items=True)


@router.get("/{shop_id}/payroll/runs/{run_id}")
def get_payroll_run(
    shop_id: int,
    run_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    run = db.query(PayrollRun).filter(PayrollRun.id == run_id, PayrollRun.shop_id == shop_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Payroll run not found")
    return _run_out(run, include_items=True)


@router.patch("/{shop_id}/payroll/runs/{run_id}/pay")
def pay_payroll_run(
    shop_id: int,
    run_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    run = db.query(PayrollRun).filter(PayrollRun.id == run_id, PayrollRun.shop_id == shop_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Payroll run not found")
    if run.status == "paid":
        raise HTTPException(status_code=400, detail="Payroll run already paid")
    run.status = "paid"
    run.paid_at = datetime.now(timezone.utc)
    db.commit()
    return _run_out(run, include_items=True)


# ── Loyalty ────────────────────────────────────────────────────────────────────

def _calc_tier(points: int) -> str:
    if points >= 5000:
        return "gold"
    elif points >= 1000:
        return "silver"
    return "bronze"


def _loyalty_account_out(acct: LoyaltyAccount, include_transactions: bool = False) -> dict:
    data = {
        "id": acct.id,
        "shop_id": acct.shop_id,
        "customer_name": acct.customer_name,
        "phone": acct.phone,
        "email": acct.email,
        "points": acct.points,
        "tier": acct.tier,
        "total_spent": float(acct.total_spent),
        "is_active": acct.is_active,
        "created_at": acct.created_at.isoformat() if acct.created_at else None,
    }
    if include_transactions:
        txs = sorted(acct.transactions, key=lambda t: t.id, reverse=True)[:20]
        data["transactions"] = [
            {
                "id": t.id,
                "type": t.type,
                "points": t.points,
                "description": t.description,
                "order_id": t.order_id,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in txs
        ]
    return data


@router.get("/{shop_id}/loyalty/settings")
def get_loyalty_settings(
    shop_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return {
        "loyalty_enabled": shop.loyalty_enabled,
        "loyalty_points_per_currency": float(shop.loyalty_points_per_currency or 1.0),
        "loyalty_redemption_rate": float(shop.loyalty_redemption_rate or 0.01),
        "tiers": [
            {"name": "bronze", "min_points": 0, "max_points": 999},
            {"name": "silver", "min_points": 1000, "max_points": 4999},
            {"name": "gold", "min_points": 5000, "max_points": None},
        ],
    }


@router.patch("/{shop_id}/loyalty/settings")
def update_loyalty_settings(
    shop_id: int,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    for field in ("loyalty_enabled", "loyalty_points_per_currency", "loyalty_redemption_rate"):
        if field in body:
            setattr(shop, field, body[field])
    db.commit()
    return {
        "loyalty_enabled": shop.loyalty_enabled,
        "loyalty_points_per_currency": float(shop.loyalty_points_per_currency or 1.0),
        "loyalty_redemption_rate": float(shop.loyalty_redemption_rate or 0.01),
    }


@router.get("/{shop_id}/loyalty/accounts")
def list_loyalty_accounts(
    shop_id: int,
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    q = db.query(LoyaltyAccount).filter(
        LoyaltyAccount.shop_id == shop_id,
        LoyaltyAccount.is_active == True,
    )
    if search:
        like = f"%{search}%"
        q = q.filter(
            (LoyaltyAccount.customer_name.ilike(like)) |
            (LoyaltyAccount.phone.ilike(like)) |
            (LoyaltyAccount.email.ilike(like))
        )
    accounts = q.order_by(LoyaltyAccount.points.desc()).all()
    return [_loyalty_account_out(a) for a in accounts]


@router.post("/{shop_id}/loyalty/accounts", status_code=201)
def create_loyalty_account(
    shop_id: int,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    acct = LoyaltyAccount(
        shop_id=shop_id,
        customer_name=body.get("customer_name", ""),
        phone=body.get("phone") or None,
        email=body.get("email") or None,
        points=0,
        tier="bronze",
        total_spent=0,
        is_active=True,
    )
    db.add(acct)
    db.commit()
    db.refresh(acct)
    return _loyalty_account_out(acct)


@router.get("/{shop_id}/loyalty/accounts/{account_id}")
def get_loyalty_account(
    shop_id: int,
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    acct = db.query(LoyaltyAccount).filter(
        LoyaltyAccount.id == account_id,
        LoyaltyAccount.shop_id == shop_id,
    ).first()
    if not acct:
        raise HTTPException(status_code=404, detail="Loyalty account not found")
    return _loyalty_account_out(acct, include_transactions=True)


@router.post("/{shop_id}/loyalty/accounts/{account_id}/earn")
def loyalty_earn(
    shop_id: int,
    account_id: int,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    acct = db.query(LoyaltyAccount).filter(
        LoyaltyAccount.id == account_id,
        LoyaltyAccount.shop_id == shop_id,
    ).first()
    if not acct:
        raise HTTPException(status_code=404, detail="Loyalty account not found")

    amount = float(body.get("amount", 0))
    ppc = float(shop.loyalty_points_per_currency or 1.0)
    earned = math.floor(amount * ppc)

    acct.points = (acct.points or 0) + earned
    acct.total_spent = float(acct.total_spent or 0) + amount
    acct.tier = _calc_tier(acct.points)

    tx = LoyaltyTransaction(
        account_id=acct.id,
        type="earn",
        points=earned,
        description=body.get("description") or f"Earned {earned} points",
        order_id=body.get("order_id") or None,
    )
    db.add(tx)
    db.commit()
    db.refresh(acct)
    return {
        "points_earned": earned,
        "total_points": acct.points,
        "tier": acct.tier,
    }


@router.post("/{shop_id}/loyalty/accounts/{account_id}/redeem")
def loyalty_redeem(
    shop_id: int,
    account_id: int,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    acct = db.query(LoyaltyAccount).filter(
        LoyaltyAccount.id == account_id,
        LoyaltyAccount.shop_id == shop_id,
    ).first()
    if not acct:
        raise HTTPException(status_code=404, detail="Loyalty account not found")

    points_to_redeem = int(body.get("points", 0))
    if points_to_redeem <= 0:
        raise HTTPException(status_code=400, detail="Points must be positive")
    if (acct.points or 0) < points_to_redeem:
        raise HTTPException(status_code=400, detail="Insufficient points")

    rr = float(shop.loyalty_redemption_rate or 0.01)
    currency_value = round(points_to_redeem * rr, 2)

    acct.points = (acct.points or 0) - points_to_redeem
    acct.tier = _calc_tier(acct.points)

    tx = LoyaltyTransaction(
        account_id=acct.id,
        type="redeem",
        points=-points_to_redeem,
        description=body.get("description") or f"Redeemed {points_to_redeem} points",
        order_id=None,
    )
    db.add(tx)
    db.commit()
    db.refresh(acct)
    return {
        "points_redeemed": points_to_redeem,
        "currency_value": currency_value,
        "currency": shop.currency or "AED",
        "total_points": acct.points,
        "tier": acct.tier,
    }


@router.post("/{shop_id}/loyalty/accounts/lookup")
def lookup_loyalty_account(
    shop_id: int,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    phone = body.get("phone", "").strip()
    if not phone:
        raise HTTPException(status_code=400, detail="Phone number required")
    acct = db.query(LoyaltyAccount).filter(
        LoyaltyAccount.shop_id == shop_id,
        LoyaltyAccount.phone == phone,
        LoyaltyAccount.is_active == True,
    ).first()
    if not acct:
        raise HTTPException(status_code=404, detail="No loyalty account found for this phone number")
    return _loyalty_account_out(acct, include_transactions=True)


# ── Branches ───────────────────────────────────────────────────────────────────

def _branch_out(b: Branch) -> dict:
    return {
        "id": b.id,
        "shop_id": b.shop_id,
        "name": b.name,
        "address": b.address,
        "phone": b.phone,
        "manager_name": b.manager_name,
        "manager_email": b.manager_email,
        "is_active": b.is_active,
        "is_main": b.is_main,
        "notes": b.notes,
        "created_at": b.created_at.isoformat() if b.created_at else None,
    }


@router.get("/{shop_id}/branches")
def list_branches(
    shop_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    branches = (
        db.query(Branch)
        .filter(Branch.shop_id == shop_id)
        .order_by(Branch.is_main.desc(), Branch.id.asc())
        .all()
    )
    return [_branch_out(b) for b in branches]


@router.post("/{shop_id}/branches", status_code=201)
def create_branch(
    shop_id: int,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    b = Branch(
        shop_id=shop_id,
        name=body.get("name", ""),
        address=body.get("address") or None,
        phone=body.get("phone") or None,
        manager_name=body.get("manager_name") or None,
        manager_email=body.get("manager_email") or None,
        is_active=bool(body.get("is_active", True)),
        is_main=bool(body.get("is_main", False)),
        notes=body.get("notes") or None,
    )
    db.add(b)
    db.commit()
    db.refresh(b)
    return _branch_out(b)


@router.patch("/{shop_id}/branches/{bid}")
def update_branch(
    shop_id: int,
    bid: int,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    b = db.query(Branch).filter(Branch.id == bid, Branch.shop_id == shop_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Branch not found")
    for field in ("name", "address", "phone", "manager_name", "manager_email", "is_active", "notes"):
        if field in body:
            setattr(b, field, body[field])
    db.commit()
    return _branch_out(b)


@router.delete("/{shop_id}/branches/{bid}", status_code=200)
def delete_branch(
    shop_id: int,
    bid: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    b = db.query(Branch).filter(Branch.id == bid, Branch.shop_id == shop_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Branch not found")
    if b.is_main:
        raise HTTPException(status_code=400, detail="Cannot delete the main branch")
    db.delete(b)
    db.commit()
    return {"status": "deleted"}


@router.patch("/{shop_id}/branches/{bid}/set-main")
def set_main_branch(
    shop_id: int,
    bid: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    b = db.query(Branch).filter(Branch.id == bid, Branch.shop_id == shop_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Branch not found")
    # Clear existing main flag
    db.query(Branch).filter(Branch.shop_id == shop_id, Branch.is_main == True).update({"is_main": False})
    b.is_main = True
    db.commit()
    return _branch_out(b)
