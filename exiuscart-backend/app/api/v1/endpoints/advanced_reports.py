from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from datetime import datetime, timezone, timedelta, date

from app.core.database import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.order import Order, OrderItem
from app.models.expense import Expense
from app.models.supplier import PurchaseOrder, PurchaseOrderItem
from app.models.product import Product
from app.models.quotation import Quotation
from app.models.wholesale import WholesaleOrder

router = APIRouter()

# ── Helpers ────────────────────────────────────────────────────────────────────

def _parse_date(s: str) -> datetime:
    return datetime.strptime(s, "%Y-%m-%d").replace(tzinfo=timezone.utc)

def _months_range(from_dt: datetime, to_dt: datetime):
    months = []
    cur = from_dt.replace(day=1)
    while cur <= to_dt:
        nxt = (cur.replace(day=28) + timedelta(days=4)).replace(day=1)
        months.append((cur, min(nxt, to_dt)))
        cur = nxt
    return months

# ── P&L Statement ──────────────────────────────────────────────────────────────

@router.get("/shops/{shop_id}/reports/pl")
def profit_and_loss(
    shop_id: int,
    from_date: str,
    to_date: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from_dt = _parse_date(from_date)
    to_dt = _parse_date(to_date).replace(hour=23, minute=59, second=59)

    # Revenue: paid orders
    paid_orders = db.query(Order).filter(
        Order.shop_id == shop_id,
        Order.payment_status == "paid",
        Order.status != "cancelled",
        Order.created_at >= from_dt,
        Order.created_at <= to_dt,
    ).all()
    revenue = sum(float(o.total) for o in paid_orders)

    # Wholesale revenue
    ws_orders = db.query(WholesaleOrder).filter(
        WholesaleOrder.shop_id == shop_id,
        WholesaleOrder.status == "fulfilled",
        WholesaleOrder.created_at >= from_dt,
        WholesaleOrder.created_at <= to_dt,
    ).all()
    wholesale_revenue = sum(float(o.total) for o in ws_orders)
    total_revenue = revenue + wholesale_revenue

    # COGS: received purchase orders
    pos = db.query(PurchaseOrder).filter(
        PurchaseOrder.shop_id == shop_id,
        PurchaseOrder.status == "received",
        PurchaseOrder.received_at >= from_dt,
        PurchaseOrder.received_at <= to_dt,
    ).all()
    cogs = sum(float(po.total_amount) for po in pos)

    gross_profit = total_revenue - cogs
    gross_margin_pct = round((gross_profit / total_revenue * 100), 1) if total_revenue else 0

    # Operating expenses grouped by category
    expenses_raw = db.query(Expense).filter(
        Expense.shop_id == shop_id,
        Expense.date >= from_date,
        Expense.date <= to_date,
    ).all()
    expenses_by_cat: dict[str, float] = {}
    for e in expenses_raw:
        cat = e.category or "Other"
        expenses_by_cat[cat] = expenses_by_cat.get(cat, 0) + float(e.amount)
    total_expenses = sum(expenses_by_cat.values())

    net_profit = gross_profit - total_expenses
    net_margin_pct = round((net_profit / total_revenue * 100), 1) if total_revenue else 0

    # Monthly breakdown
    monthly = []
    for m_start, m_end in _months_range(from_dt, to_dt):
        m_rev = sum(
            float(o.total) for o in paid_orders
            if o.created_at and m_start <= o.created_at <= m_end
        ) + sum(
            float(o.total) for o in ws_orders
            if o.created_at and m_start <= o.created_at <= m_end
        )
        m_exp = sum(
            float(e.amount) for e in expenses_raw
            if e.date >= m_start.strftime("%Y-%m-%d") and e.date <= m_end.strftime("%Y-%m-%d")
        )
        m_cogs = sum(
            float(po.total_amount) for po in pos
            if po.received_at and m_start <= po.received_at <= m_end
        )
        m_gp = m_rev - m_cogs
        m_np = m_gp - m_exp
        monthly.append({
            "month": m_start.strftime("%b %Y"),
            "revenue": round(m_rev, 2),
            "cogs": round(m_cogs, 2),
            "gross_profit": round(m_gp, 2),
            "expenses": round(m_exp, 2),
            "net_profit": round(m_np, 2),
        })

    return {
        "period": {"from": from_date, "to": to_date},
        "revenue": {
            "retail": round(revenue, 2),
            "wholesale": round(wholesale_revenue, 2),
            "total": round(total_revenue, 2),
        },
        "cogs": round(cogs, 2),
        "gross_profit": round(gross_profit, 2),
        "gross_margin_pct": gross_margin_pct,
        "expenses_by_category": {k: round(v, 2) for k, v in sorted(expenses_by_cat.items(), key=lambda x: -x[1])},
        "total_expenses": round(total_expenses, 2),
        "net_profit": round(net_profit, 2),
        "net_margin_pct": net_margin_pct,
        "monthly": monthly,
        "order_count": len(paid_orders),
    }

# ── AR Aging ───────────────────────────────────────────────────────────────────

@router.get("/shops/{shop_id}/reports/ar-aging")
def ar_aging(
    shop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)

    open_quotes = db.query(Quotation).filter(
        Quotation.shop_id == shop_id,
        Quotation.status.in_(["pending", "sent"]),
        Quotation.client_accepted_at.is_(None),
    ).all()

    buckets: dict[str, list] = {"0_30": [], "31_60": [], "61_90": [], "90_plus": []}
    totals: dict[str, float] = {"0_30": 0, "31_60": 0, "61_90": 0, "90_plus": 0}

    for q in open_quotes:
        if not q.created_at:
            continue
        age = (now - q.created_at).days
        amt = float(q.total)
        record = {
            "id": q.id,
            "quote_number": q.quote_number,
            "customer_name": q.customer_name,
            "customer_email": q.customer_email,
            "amount": amt,
            "age_days": age,
            "created_at": q.created_at.isoformat(),
            "valid_until": str(q.valid_until),
        }
        if age <= 30:
            buckets["0_30"].append(record); totals["0_30"] += amt
        elif age <= 60:
            buckets["31_60"].append(record); totals["31_60"] += amt
        elif age <= 90:
            buckets["61_90"].append(record); totals["61_90"] += amt
        else:
            buckets["90_plus"].append(record); totals["90_plus"] += amt

    total_outstanding = sum(totals.values())
    return {
        "total_outstanding": round(total_outstanding, 2),
        "buckets": buckets,
        "totals": {k: round(v, 2) for k, v in totals.items()},
        "count": len(open_quotes),
    }

# ── Product Profitability ──────────────────────────────────────────────────────

@router.get("/shops/{shop_id}/reports/product-profitability")
def product_profitability(
    shop_id: int,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    if not from_date:
        from_date = (now - timedelta(days=365)).strftime("%Y-%m-%d")
    if not to_date:
        to_date = now.strftime("%Y-%m-%d")
    from_dt = _parse_date(from_date)
    to_dt = _parse_date(to_date).replace(hour=23, minute=59, second=59)

    paid_orders = db.query(Order).filter(
        Order.shop_id == shop_id,
        Order.payment_status == "paid",
        Order.status != "cancelled",
        Order.created_at >= from_dt,
        Order.created_at <= to_dt,
    ).all()

    prod_stats: dict[int, dict] = {}
    for order in paid_orders:
        for item in order.items:
            if not item.product_id:
                continue
            pid = item.product_id
            if pid not in prod_stats:
                prod_stats[pid] = {
                    "product_id": pid,
                    "name": item.product_name or "",
                    "revenue": 0.0,
                    "units_sold": 0,
                    "cost": 0.0,
                }
            prod_stats[pid]["revenue"] += float(item.total_price)
            prod_stats[pid]["units_sold"] += item.quantity

    # Attach cost_price from products
    products = db.query(Product).filter(Product.shop_id == shop_id).all()
    prod_cost_map = {p.id: float(p.cost_price or 0) for p in products}
    prod_name_map = {p.id: p.name for p in products}

    result = []
    for pid, stat in prod_stats.items():
        cost_per_unit = prod_cost_map.get(pid, 0)
        total_cost = cost_per_unit * stat["units_sold"]
        gross_profit = stat["revenue"] - total_cost
        margin_pct = round((gross_profit / stat["revenue"] * 100), 1) if stat["revenue"] else 0
        result.append({
            "product_id": pid,
            "name": prod_name_map.get(pid, stat["name"]),
            "revenue": round(stat["revenue"], 2),
            "units_sold": stat["units_sold"],
            "cogs": round(total_cost, 2),
            "gross_profit": round(gross_profit, 2),
            "margin_pct": margin_pct,
        })

    result.sort(key=lambda x: x["revenue"], reverse=True)
    return {"period": {"from": from_date, "to": to_date}, "products": result}

# ── Product Performance (for product list heat badges) ────────────────────────

@router.get("/shops/{shop_id}/reports/product-performance")
def product_performance(
    shop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    since_30 = now - timedelta(days=30)
    since_7 = now - timedelta(days=7)
    year_ago = now - timedelta(days=365)

    paid_orders = db.query(Order).filter(
        Order.shop_id == shop_id,
        Order.payment_status == "paid",
        Order.status != "cancelled",
        Order.created_at >= year_ago,
    ).all()

    perf: dict[int, dict] = {}
    for order in paid_orders:
        for item in order.items:
            if not item.product_id:
                continue
            pid = item.product_id
            if pid not in perf:
                perf[pid] = {"revenue": 0.0, "units_sold": 0, "revenue_30d": 0.0, "units_30d": 0, "last_sold_at": None}
            perf[pid]["revenue"] += float(item.total_price)
            perf[pid]["units_sold"] += item.quantity
            if order.created_at and order.created_at >= since_30:
                perf[pid]["revenue_30d"] += float(item.total_price)
                perf[pid]["units_30d"] += item.quantity
            if perf[pid]["last_sold_at"] is None or (order.created_at and order.created_at > perf[pid]["last_sold_at"]):
                perf[pid]["last_sold_at"] = order.created_at

    if not perf:
        return {}

    # Assign heat: top 25% revenue = hot, any sales in 30d = moving, else slow
    revenues = [v["revenue_30d"] for v in perf.values() if v["revenue_30d"] > 0]
    hot_threshold = sorted(revenues, reverse=True)[max(0, len(revenues) // 4 - 1)] if revenues else float("inf")

    result = {}
    for pid, stat in perf.items():
        last = stat["last_sold_at"]
        days_since_sale = (now - last).days if last else 9999
        if stat["revenue_30d"] >= hot_threshold and stat["revenue_30d"] > 0:
            heat = "hot"
        elif stat["units_30d"] > 0:
            heat = "moving"
        else:
            heat = "slow"

        products = db.query(Product).filter(Product.id == pid, Product.shop_id == shop_id).first()
        margin_pct = 0.0
        if products and products.cost_price and float(stat["revenue"]) > 0:
            units = stat["units_sold"]
            cost = float(products.cost_price) * units
            margin_pct = round(((float(stat["revenue"]) - cost) / float(stat["revenue"])) * 100, 1)

        result[str(pid)] = {
            "revenue": round(stat["revenue"], 2),
            "revenue_30d": round(stat["revenue_30d"], 2),
            "units_sold": stat["units_sold"],
            "units_30d": stat["units_30d"],
            "days_since_sale": days_since_sale,
            "heat": heat,
            "margin_pct": margin_pct,
            "last_sold_at": last.isoformat() if last else None,
        }
    return result
