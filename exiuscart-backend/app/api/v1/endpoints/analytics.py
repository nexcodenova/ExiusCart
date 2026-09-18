"""
Analytics — 6 real aggregation dashboards (Overview, Products, Channels,
Customers, Marketing, Fulfillment) backing the sidebar's Analytics group,
which was previously six 16-line "Coming soon" placeholder pages.

Growth/Scale only (matches Product Studio/AI Commerce/MCP's existing
sidebar-level PREMIUM_GROUPS lock). TheDersi: Free Forever/Lite get
nothing here; Pro is bumped up via is_thedersi_pro_shop() (same mechanism
product_fields.py uses to give Pro Growth-level image/description limits);
Official already resolves to a real "scale" plan_type and needs no special
case. Launch keeps what it already has (Sales/Profit tabs inside
advanced_reports.py) — this module doesn't touch that.
"""
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.thedersi import is_thedersi_pro_shop
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.shop import Shop
from app.models.subscription import Subscription
from app.models.product import Product
from app.models.order import Order, OrderItem
from app.models.customer import Customer
from app.models.channel import ChannelConnection
from app.models.channel_order_meta import ChannelOrderMeta
from app.models.dropship import DropshipOrder
from app.models.marketing import ShopLead, EmailCampaign, SMSCampaign, DripFlowEnrollment
from app.models.whatsapp_marketing import WhatsAppCampaign

router = APIRouter()


def _shop_or_404(shop_id: int, user: User, db: Session) -> Shop:
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


def _require_analytics_plan(shop_id: int, db: Session):
    sub = db.query(Subscription).filter(Subscription.shop_id == shop_id).order_by(Subscription.id.desc()).first()
    plan = sub.plan_type if sub else "free_trial"
    if plan in ("growth", "scale"):
        return
    if is_thedersi_pro_shop(shop_id, db):
        return
    raise HTTPException(status_code=403, detail={
        "error": "upgrade_required",
        "plan": plan,
        "message": "Advanced Analytics is available on Growth and Scale.",
    })


def _month_bounds(months_back: int) -> tuple[datetime, datetime]:
    now = datetime.now(timezone.utc)
    this_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    start = this_month_start
    for _ in range(months_back):
        start = (start - timedelta(days=1)).replace(day=1)
    return start, now


def _month_label(dt: datetime) -> str:
    return dt.strftime("%b %y")


# ── Overview ─────────────────────────────────────────────────────────────────

@router.get("/shops/{shop_id}/analytics/overview")
def analytics_overview(shop_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _shop_or_404(shop_id, current_user, db)
    _require_analytics_plan(shop_id, db)

    now = datetime.now(timezone.utc)
    thirty_ago = now - timedelta(days=30)
    prev_thirty_start = now - timedelta(days=60)

    def _revenue_and_orders(start, end):
        row = db.query(
            func.coalesce(func.sum(Order.total), 0), func.count(Order.id),
        ).filter(
            Order.shop_id == shop_id, Order.status != "cancelled",
            Order.created_at >= start, Order.created_at < end,
        ).first()
        return float(row[0] or 0), int(row[1] or 0)

    revenue_30d, orders_30d = _revenue_and_orders(thirty_ago, now)
    revenue_prev_30d, orders_prev_30d = _revenue_and_orders(prev_thirty_start, thirty_ago)
    revenue_change = round(((revenue_30d - revenue_prev_30d) / revenue_prev_30d) * 100, 1) if revenue_prev_30d > 0 else 0.0
    orders_change = round(((orders_30d - orders_prev_30d) / orders_prev_30d) * 100, 1) if orders_prev_30d > 0 else 0.0

    total_customers = db.query(func.count(Customer.id)).filter(Customer.shop_id == shop_id).scalar() or 0
    avg_order_value = round(revenue_30d / orders_30d, 2) if orders_30d else 0.0

    # 6-month revenue/orders trend
    trend = []
    for i in range(5, -1, -1):
        m_start, m_end = _month_bounds(i)[0], (_month_bounds(i - 1)[0] if i > 0 else now)
        rev, ords = _revenue_and_orders(m_start, m_end)
        trend.append({"month": _month_label(m_start), "Revenue": rev, "Orders": ords})

    channel_rows = db.query(
        Order.source, func.coalesce(func.sum(Order.total), 0), func.count(Order.id),
    ).filter(
        Order.shop_id == shop_id, Order.status != "cancelled", Order.created_at >= thirty_ago,
    ).group_by(Order.source).all()
    by_channel = [{"channel": (r[0] or "pos").title(), "revenue": float(r[1] or 0), "orders": int(r[2])} for r in channel_rows]

    fulfillment_rows = db.query(Order.fulfillment_status, func.count(Order.id)).filter(
        Order.shop_id == shop_id, Order.created_at >= thirty_ago,
    ).group_by(Order.fulfillment_status).all()
    fulfillment_snapshot = {(r[0] or "unfulfilled"): int(r[1]) for r in fulfillment_rows}

    return {
        "kpis": {
            "revenue_30d": revenue_30d, "revenue_change_pct": revenue_change,
            "orders_30d": orders_30d, "orders_change_pct": orders_change,
            "avg_order_value": avg_order_value, "total_customers": int(total_customers),
        },
        "revenue_trend": trend,
        "by_channel": by_channel,
        "fulfillment_snapshot": fulfillment_snapshot,
    }


# ── Products ─────────────────────────────────────────────────────────────────

@router.get("/shops/{shop_id}/analytics/products")
def analytics_products(shop_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _shop_or_404(shop_id, current_user, db)
    _require_analytics_plan(shop_id, db)

    thirty_ago = datetime.now(timezone.utc) - timedelta(days=30)

    best_seller_rows = db.query(
        OrderItem.product_id, OrderItem.product_name,
        func.sum(OrderItem.quantity).label("units"),
        func.sum(OrderItem.total_price).label("revenue"),
    ).join(Order, Order.id == OrderItem.order_id).filter(
        Order.shop_id == shop_id, Order.status != "cancelled", Order.created_at >= thirty_ago,
    ).group_by(OrderItem.product_id, OrderItem.product_name).order_by(func.sum(OrderItem.total_price).desc()).limit(10).all()

    product_ids = [r[0] for r in best_seller_rows if r[0]]
    products_by_id = {p.id: p for p in db.query(Product).filter(Product.id.in_(product_ids)).all()} if product_ids else {}

    best_sellers = []
    total_revenue = 0.0
    total_cost = 0.0
    for pid, name, units, revenue in best_seller_rows:
        revenue = float(revenue or 0)
        product = products_by_id.get(pid)
        cost_price = float(product.cost_price) if product and product.cost_price else None
        margin_pct = round((1 - (cost_price / (revenue / units))) * 100, 1) if (cost_price and units) else None
        best_sellers.append({
            "name": name or "Unknown", "units_sold": int(units or 0), "revenue": revenue, "margin_pct": margin_pct,
        })
        total_revenue += revenue
        if cost_price:
            total_cost += cost_price * float(units or 0)

    # View-to-sale conversion: products with real traffic but few/no sales
    low_performers_rows = db.query(Product).filter(
        Product.shop_id == shop_id, Product.is_active == True, Product.view_count >= 10,
    ).order_by((Product.units_sold / func.nullif(Product.view_count, 0)).asc()).limit(10).all()
    low_performers = [
        {
            "name": p.name, "views": p.view_count, "units_sold": p.units_sold,
            "conversion_pct": round((p.units_sold / p.view_count) * 100, 2) if p.view_count else 0.0,
        }
        for p in low_performers_rows
    ]

    return {
        "best_sellers": best_sellers,
        "low_performers": low_performers,
        "margin_summary": {
            "revenue_30d": round(total_revenue, 2),
            "estimated_cost_30d": round(total_cost, 2),
            "estimated_margin_pct": round((1 - total_cost / total_revenue) * 100, 1) if total_revenue else 0.0,
        },
    }


# ── Channels ─────────────────────────────────────────────────────────────────

@router.get("/shops/{shop_id}/analytics/channels")
def analytics_channels(shop_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _shop_or_404(shop_id, current_user, db)
    _require_analytics_plan(shop_id, db)

    ninety_ago = datetime.now(timezone.utc) - timedelta(days=90)
    prev_ninety_start = datetime.now(timezone.utc) - timedelta(days=180)

    def _by_channel(start, end):
        rows = db.query(
            Order.source, func.coalesce(func.sum(Order.total), 0), func.count(Order.id),
        ).filter(
            Order.shop_id == shop_id, Order.status != "cancelled",
            Order.created_at >= start, Order.created_at < end,
        ).group_by(Order.source).all()
        return {(r[0] or "pos"): {"revenue": float(r[1] or 0), "orders": int(r[2])} for r in rows}

    current = _by_channel(ninety_ago, datetime.now(timezone.utc))
    previous = _by_channel(prev_ninety_start, ninety_ago)
    total_revenue = sum(v["revenue"] for v in current.values()) or 1.0

    connected_types = {c.channel_type for c in db.query(ChannelConnection.channel_type).filter(
        ChannelConnection.shop_id == shop_id, ChannelConnection.is_active == True,
    ).all()}

    channels = []
    for source, data in current.items():
        prev = previous.get(source, {"revenue": 0.0, "orders": 0})
        growth = round(((data["revenue"] - prev["revenue"]) / prev["revenue"]) * 100, 1) if prev["revenue"] > 0 else None
        commission_row = db.query(func.coalesce(func.sum(ChannelOrderMeta.commission_amount), 0)).join(
            Order, Order.id == ChannelOrderMeta.order_id,
        ).filter(Order.shop_id == shop_id, ChannelOrderMeta.channel_type == source, Order.created_at >= ninety_ago).scalar()
        channels.append({
            "channel": source.title(),
            "connected": source in connected_types or source == "pos",
            "revenue": data["revenue"],
            "orders": data["orders"],
            "avg_order_value": round(data["revenue"] / data["orders"], 2) if data["orders"] else 0.0,
            "share_pct": round((data["revenue"] / total_revenue) * 100, 1),
            "growth_pct": growth,
            "commission_paid_90d": float(commission_row or 0),
        })
    channels.sort(key=lambda c: c["revenue"], reverse=True)

    return {"channels": channels, "total_revenue_90d": round(total_revenue, 2)}


# ── Customers ────────────────────────────────────────────────────────────────

@router.get("/shops/{shop_id}/analytics/customers")
def analytics_customers(shop_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _shop_or_404(shop_id, current_user, db)
    _require_analytics_plan(shop_id, db)

    ninety_ago = datetime.now(timezone.utc) - timedelta(days=90)

    order_counts = db.query(
        Order.customer_id, func.count(Order.id).label("order_count"), func.sum(Order.total).label("ltv"),
    ).filter(
        Order.shop_id == shop_id, Order.status != "cancelled", Order.customer_id.isnot(None),
    ).group_by(Order.customer_id).all()

    total_with_orders = len(order_counts)
    returning = sum(1 for r in order_counts if r.order_count > 1)
    repeat_rate = round((returning / total_with_orders) * 100, 1) if total_with_orders else 0.0
    avg_ltv = round(sum(float(r.ltv or 0) for r in order_counts) / total_with_orders, 2) if total_with_orders else 0.0

    customer_ids = [r.customer_id for r in sorted(order_counts, key=lambda r: float(r.ltv or 0), reverse=True)[:10]]
    customers_by_id = {c.id: c for c in db.query(Customer).filter(Customer.id.in_(customer_ids)).all()} if customer_ids else {}
    ltv_by_id = {r.customer_id: float(r.ltv or 0) for r in order_counts}
    orders_by_id = {r.customer_id: r.order_count for r in order_counts}
    top_customers = [
        {
            "name": customers_by_id[cid].name if cid in customers_by_id else "Unknown",
            "orders": orders_by_id.get(cid, 0), "ltv": ltv_by_id.get(cid, 0.0),
        }
        for cid in customer_ids
    ]

    new_customers_90d = db.query(func.count(Customer.id)).filter(
        Customer.shop_id == shop_id, Customer.created_at >= ninety_ago,
    ).scalar() or 0

    source_rows = db.query(Customer.source, func.count(Customer.id)).filter(
        Customer.shop_id == shop_id,
    ).group_by(Customer.source).all()
    by_source = [{"source": (r[0] or "direct").title(), "count": int(r[1])} for r in source_rows]

    growth_trend = []
    for i in range(5, -1, -1):
        m_start, m_end = _month_bounds(i)[0], (_month_bounds(i - 1)[0] if i > 0 else datetime.now(timezone.utc))
        cnt = db.query(func.count(Customer.id)).filter(
            Customer.shop_id == shop_id, Customer.created_at >= m_start, Customer.created_at < m_end,
        ).scalar() or 0
        growth_trend.append({"month": _month_label(m_start), "New customers": int(cnt)})

    return {
        "summary": {
            "total_customers_with_orders": total_with_orders, "returning_customers": returning,
            "repeat_purchase_rate_pct": repeat_rate, "avg_ltv": avg_ltv, "new_customers_90d": int(new_customers_90d),
        },
        "top_customers": top_customers,
        "by_source": by_source,
        "growth_trend": growth_trend,
    }


# ── Marketing ────────────────────────────────────────────────────────────────

@router.get("/shops/{shop_id}/analytics/marketing")
def analytics_marketing(shop_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _shop_or_404(shop_id, current_user, db)
    _require_analytics_plan(shop_id, db)

    lead_source_rows = db.query(ShopLead.source, func.count(ShopLead.id)).filter(
        ShopLead.shop_id == shop_id,
    ).group_by(ShopLead.source).all()
    leads_by_source = [{"source": (r[0] or "manual").title(), "count": int(r[1])} for r in lead_source_rows]

    email = db.query(
        func.coalesce(func.sum(EmailCampaign.recipients_count), 0),
        func.coalesce(func.sum(EmailCampaign.opened_count), 0),
        func.coalesce(func.sum(EmailCampaign.clicked_count), 0),
    ).filter(EmailCampaign.shop_id == shop_id, EmailCampaign.status == "sent").first()

    sms = db.query(
        func.coalesce(func.sum(SMSCampaign.recipients_count), 0),
        func.coalesce(func.sum(SMSCampaign.delivered_count), 0),
    ).filter(SMSCampaign.shop_id == shop_id, SMSCampaign.status == "sent").first()

    whatsapp = db.query(
        func.coalesce(func.sum(WhatsAppCampaign.total_recipients), 0),
        func.coalesce(func.sum(WhatsAppCampaign.sent_count), 0),
    ).filter(WhatsAppCampaign.shop_id == shop_id, WhatsAppCampaign.status == "sent").first()

    flow_rows = db.query(DripFlowEnrollment.status, func.count(DripFlowEnrollment.id)).filter(
        DripFlowEnrollment.shop_id == shop_id,
    ).group_by(DripFlowEnrollment.status).all()
    flow_status = {r[0]: int(r[1]) for r in flow_rows}
    total_enrollments = sum(flow_status.values())
    completed = flow_status.get("completed", 0)
    conversion_pct = round((completed / total_enrollments) * 100, 1) if total_enrollments else 0.0

    return {
        "leads_by_source": leads_by_source,
        "channel_performance": {
            "email": {"sent": int(email[0]), "opened": int(email[1]), "clicked": int(email[2]),
                      "open_rate_pct": round((email[1] / email[0]) * 100, 1) if email[0] else 0.0},
            "sms": {"sent": int(sms[0]), "delivered": int(sms[1]),
                    "delivery_rate_pct": round((sms[1] / sms[0]) * 100, 1) if sms[0] else 0.0},
            "whatsapp": {"sent": int(whatsapp[0]), "delivered": int(whatsapp[1]),
                         "delivery_rate_pct": round((whatsapp[1] / whatsapp[0]) * 100, 1) if whatsapp[0] else 0.0},
        },
        "drip_flows": {"status_breakdown": flow_status, "conversion_pct": conversion_pct},
    }


# ── Fulfillment ──────────────────────────────────────────────────────────────

@router.get("/shops/{shop_id}/analytics/fulfillment")
def analytics_fulfillment(shop_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _shop_or_404(shop_id, current_user, db)
    _require_analytics_plan(shop_id, db)

    thirty_ago = datetime.now(timezone.utc) - timedelta(days=30)

    status_rows = db.query(Order.fulfillment_status, func.count(Order.id)).filter(
        Order.shop_id == shop_id, Order.created_at >= thirty_ago,
    ).group_by(Order.fulfillment_status).all()
    status_breakdown = {(r[0] or "unfulfilled"): int(r[1]) for r in status_rows}

    avg_hours_row = db.query(
        func.avg(func.extract("epoch", Order.shipped_at - Order.created_at) / 3600.0),
    ).filter(
        Order.shop_id == shop_id, Order.shipped_at.isnot(None), Order.created_at >= thirty_ago,
    ).scalar()
    avg_fulfillment_hours = round(float(avg_hours_row), 1) if avg_hours_row else None

    supplier_rows = db.query(
        DropshipOrder.supplier_type, DropshipOrder.status, func.count(DropshipOrder.id),
    ).filter(DropshipOrder.shop_id == shop_id, DropshipOrder.created_at >= thirty_ago).group_by(
        DropshipOrder.supplier_type, DropshipOrder.status,
    ).all()
    supplier_performance: dict[str, dict[str, int]] = {}
    for supplier_type, status, count in supplier_rows:
        supplier_performance.setdefault(supplier_type, {})[status or "pending"] = int(count)

    return {
        "status_breakdown_30d": status_breakdown,
        "avg_fulfillment_hours": avg_fulfillment_hours,
        "supplier_performance_30d": [
            {"supplier": supplier.upper(), "statuses": statuses, "total": sum(statuses.values())}
            for supplier, statuses in supplier_performance.items()
        ],
    }
