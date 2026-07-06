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
from app.schemas.shop import ShopCreate, ShopResponse, ShopUpdate
from app.api.v1.deps import get_current_user

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
    profile_changed = bool(update_data.keys() & {"logo_url", "banner_url"})

    for field, value in update_data.items():
        setattr(shop, field, value)

    db.commit()
    db.refresh(shop)

    # Notify TheDersi if logo or banner changed and shop has an active TheDersi connection
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
        background_tasks.add_task(notify_thedersi_profile_updated, conn.channel_seller_id, shop.logo_url, shop.banner_url)


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
        status="pending",
        amount_paid=cat["price"],
        currency="AED",
    )
    db.add(new_sub)
    db.commit()
    db.refresh(new_sub)
    return {"message": "Upgrade request submitted. Admin will activate it shortly.", "subscription_id": new_sub.id}


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
            {
                "name": p.name,
                "stock": p.quantity,
                "min": p.low_stock_threshold,
            }
            for p in low_stock
        ],
        "whatsappOrders": [],
        "recentOrders": [
            {
                "id": str(o.id),
                "customer": "Customer",
                "amount": str(o.total),
                "status": o.status,
                "time": o.created_at.isoformat(),
            }
            for o in recent_orders
        ],
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
