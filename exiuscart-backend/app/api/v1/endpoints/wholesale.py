from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import Optional
from datetime import date, datetime, timezone, timedelta
import secrets

from app.core.database import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.shop import Shop
from app.models.subscription import Subscription
from app.models.wholesale import WholesaleProduct, WholesaleBuyer, WholesaleOrder
from app.models.quotation import Quotation
from pydantic import BaseModel

router = APIRouter()

# ── Schemas ────────────────────────────────────────────────────────────────────

class WholesaleProductIn(BaseModel):
    name: str
    description: Optional[str] = None
    sku: Optional[str] = None
    wholesale_price: float
    retail_price: Optional[float] = None
    moq: int = 1
    stock: Optional[int] = None
    unit: str = "pcs"
    show_in_pos: bool = False
    show_in_thedersi: bool = False
    show_in_storefront: bool = False
    is_active: bool = True

class WholesaleBuyerIn(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None

class WholesaleOrderStatusIn(BaseModel):
    status: str

class BuyerOrderItem(BaseModel):
    product_id: int
    name: str
    sku: Optional[str] = None
    qty: int
    unit_price: float
    unit: str = "pcs"

class BuyerOrderIn(BaseModel):
    buyer_name: str
    buyer_email: Optional[str] = None
    buyer_phone: Optional[str] = None
    buyer_company: Optional[str] = None
    notes: Optional[str] = None
    items: list[BuyerOrderItem]

# ── Helpers ────────────────────────────────────────────────────────────────────

def _require_premium(shop_id: int, db: Session):
    sub = db.query(Subscription).filter(
        Subscription.shop_id == shop_id,
        Subscription.status == "active"
    ).order_by(Subscription.id.desc()).first()
    if not sub or sub.plan_type != "premium":
        raise HTTPException(status_code=403, detail="Wholesale requires a Premium plan.")

def _get_shop(current_user: User, db: Session) -> Shop:
    shop = db.query(Shop).filter(Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found.")
    return shop

def _next_order_number(shop_id: int, db: Session) -> str:
    year = datetime.now(timezone.utc).year
    count = db.query(func.count(WholesaleOrder.id)).filter(
        WholesaleOrder.shop_id == shop_id
    ).scalar() or 0
    return f"WO-{year}-{shop_id:03d}-{count + 1:04d}"

def _product_dict(p: WholesaleProduct) -> dict:
    return {
        "id": p.id, "name": p.name, "description": p.description,
        "sku": p.sku, "wholesale_price": float(p.wholesale_price),
        "retail_price": float(p.retail_price) if p.retail_price else None,
        "moq": p.moq, "stock": p.stock, "unit": p.unit,
        "show_in_pos": p.show_in_pos, "show_in_thedersi": p.show_in_thedersi,
        "show_in_storefront": p.show_in_storefront, "is_active": p.is_active,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }

def _buyer_dict(b: WholesaleBuyer, shop_id: int) -> dict:
    return {
        "id": b.id, "name": b.name, "email": b.email, "phone": b.phone,
        "company": b.company, "address": b.address, "notes": b.notes,
        "token": b.token, "is_active": b.is_active,
        "total_orders": b.total_orders, "total_spent": float(b.total_spent),
        "catalogue_url": f"/wholesale/{b.token}",
        "created_at": b.created_at.isoformat() if b.created_at else None,
    }

def _order_dict(o: WholesaleOrder) -> dict:
    return {
        "id": o.id, "order_number": o.order_number, "status": o.status,
        "items": o.items, "subtotal": float(o.subtotal),
        "discount": float(o.discount), "total": float(o.total),
        "notes": o.notes, "quotation_id": o.quotation_id,
        "buyer": {
            "id": o.buyer.id, "name": o.buyer.name, "email": o.buyer.email,
            "phone": o.buyer.phone, "company": o.buyer.company,
        } if o.buyer else None,
        "created_at": o.created_at.isoformat() if o.created_at else None,
        "updated_at": o.updated_at.isoformat() if o.updated_at else None,
    }

# ── Products ───────────────────────────────────────────────────────────────────

@router.get("/shops/{shop_id}/wholesale/products")
def list_wholesale_products(
    shop_id: int, is_active: Optional[bool] = None,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    _require_premium(shop_id, db)
    q = db.query(WholesaleProduct).filter(WholesaleProduct.shop_id == shop_id)
    if is_active is not None:
        q = q.filter(WholesaleProduct.is_active == is_active)
    return [_product_dict(p) for p in q.order_by(WholesaleProduct.id.desc()).all()]


@router.post("/shops/{shop_id}/wholesale/products")
def create_wholesale_product(
    shop_id: int, data: WholesaleProductIn,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    _require_premium(shop_id, db)
    p = WholesaleProduct(shop_id=shop_id, **data.model_dump())
    db.add(p); db.commit(); db.refresh(p)
    return _product_dict(p)


@router.put("/shops/{shop_id}/wholesale/products/{pid}")
def update_wholesale_product(
    shop_id: int, pid: int, data: WholesaleProductIn,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    _require_premium(shop_id, db)
    p = db.query(WholesaleProduct).filter(
        WholesaleProduct.id == pid, WholesaleProduct.shop_id == shop_id
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found.")
    for k, v in data.model_dump().items():
        setattr(p, k, v)
    db.commit(); db.refresh(p)
    return _product_dict(p)


@router.delete("/shops/{shop_id}/wholesale/products/{pid}")
def delete_wholesale_product(
    shop_id: int, pid: int,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    _require_premium(shop_id, db)
    p = db.query(WholesaleProduct).filter(
        WholesaleProduct.id == pid, WholesaleProduct.shop_id == shop_id
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found.")
    db.delete(p); db.commit()
    return {"ok": True}

# ── Buyers ─────────────────────────────────────────────────────────────────────

@router.get("/shops/{shop_id}/wholesale/buyers")
def list_buyers(
    shop_id: int,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    _require_premium(shop_id, db)
    buyers = db.query(WholesaleBuyer).filter(
        WholesaleBuyer.shop_id == shop_id
    ).order_by(WholesaleBuyer.total_spent.desc()).all()
    return [_buyer_dict(b, shop_id) for b in buyers]


@router.post("/shops/{shop_id}/wholesale/buyers")
def create_buyer(
    shop_id: int, data: WholesaleBuyerIn,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    _require_premium(shop_id, db)
    token = secrets.token_urlsafe(32)
    b = WholesaleBuyer(shop_id=shop_id, token=token, **data.model_dump())
    db.add(b); db.commit(); db.refresh(b)
    return _buyer_dict(b, shop_id)


@router.put("/shops/{shop_id}/wholesale/buyers/{bid}")
def update_buyer(
    shop_id: int, bid: int, data: WholesaleBuyerIn,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    _require_premium(shop_id, db)
    b = db.query(WholesaleBuyer).filter(
        WholesaleBuyer.id == bid, WholesaleBuyer.shop_id == shop_id
    ).first()
    if not b:
        raise HTTPException(status_code=404, detail="Buyer not found.")
    for k, v in data.model_dump().items():
        setattr(b, k, v)
    db.commit(); db.refresh(b)
    return _buyer_dict(b, shop_id)


@router.post("/shops/{shop_id}/wholesale/buyers/{bid}/toggle")
def toggle_buyer(
    shop_id: int, bid: int,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    _require_premium(shop_id, db)
    b = db.query(WholesaleBuyer).filter(
        WholesaleBuyer.id == bid, WholesaleBuyer.shop_id == shop_id
    ).first()
    if not b:
        raise HTTPException(status_code=404, detail="Buyer not found.")
    b.is_active = not b.is_active
    db.commit()
    return {"is_active": b.is_active}


@router.delete("/shops/{shop_id}/wholesale/buyers/{bid}")
def delete_buyer(
    shop_id: int, bid: int,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    _require_premium(shop_id, db)
    b = db.query(WholesaleBuyer).filter(
        WholesaleBuyer.id == bid, WholesaleBuyer.shop_id == shop_id
    ).first()
    if not b:
        raise HTTPException(status_code=404, detail="Buyer not found.")
    db.delete(b); db.commit()
    return {"ok": True}

# ── Orders ─────────────────────────────────────────────────────────────────────

@router.get("/shops/{shop_id}/wholesale/orders")
def list_orders(
    shop_id: int, status: Optional[str] = None,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    _require_premium(shop_id, db)
    q = db.query(WholesaleOrder).filter(WholesaleOrder.shop_id == shop_id)
    if status:
        q = q.filter(WholesaleOrder.status == status)
    return [_order_dict(o) for o in q.order_by(WholesaleOrder.created_at.desc()).all()]


@router.put("/shops/{shop_id}/wholesale/orders/{oid}/status")
def update_order_status(
    shop_id: int, oid: int, data: WholesaleOrderStatusIn,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    _require_premium(shop_id, db)
    o = db.query(WholesaleOrder).filter(
        WholesaleOrder.id == oid, WholesaleOrder.shop_id == shop_id
    ).first()
    if not o:
        raise HTTPException(status_code=404, detail="Order not found.")
    old_status = o.status
    o.status = data.status

    if data.status == "fulfilled" and old_status != "fulfilled":
        buyer = o.buyer
        if buyer:
            buyer.total_orders = (buyer.total_orders or 0) + 1
            buyer.total_spent = float(buyer.total_spent or 0) + float(o.total)
            # Deduct stock per item
            for item in (o.items or []):
                pid = item.get("product_id")
                qty = item.get("qty", 0)
                if pid:
                    prod = db.query(WholesaleProduct).filter(
                        WholesaleProduct.id == pid,
                        WholesaleProduct.shop_id == shop_id
                    ).first()
                    if prod and prod.stock is not None:
                        prod.stock = max(0, prod.stock - qty)

    db.commit()
    return _order_dict(o)

# ── Stats / Reports ────────────────────────────────────────────────────────────

@router.get("/shops/{shop_id}/wholesale/stats")
def wholesale_stats(
    shop_id: int,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    _require_premium(shop_id, db)
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    all_orders = db.query(WholesaleOrder).filter(
        WholesaleOrder.shop_id == shop_id,
        WholesaleOrder.status != "cancelled"
    ).all()

    total_revenue = sum(float(o.total) for o in all_orders if o.status == "fulfilled")
    this_month_revenue = sum(
        float(o.total) for o in all_orders
        if o.status == "fulfilled" and o.created_at and o.created_at >= month_start
    )
    pending_count = sum(1 for o in all_orders if o.status == "pending")
    confirmed_count = sum(1 for o in all_orders if o.status == "confirmed")
    fulfilled_count = sum(1 for o in all_orders if o.status == "fulfilled")
    total_order_count = len(all_orders)
    avg_order_value = (total_revenue / fulfilled_count) if fulfilled_count else 0

    active_buyers = db.query(func.count(WholesaleBuyer.id)).filter(
        WholesaleBuyer.shop_id == shop_id, WholesaleBuyer.is_active == True
    ).scalar() or 0

    total_products = db.query(func.count(WholesaleProduct.id)).filter(
        WholesaleProduct.shop_id == shop_id, WholesaleProduct.is_active == True
    ).scalar() or 0

    # Monthly revenue — last 6 months
    monthly = []
    for i in range(5, -1, -1):
        m_start = (now.replace(day=1) - timedelta(days=i * 28)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if i == 0:
            m_end = now
        else:
            next_m = (m_start.replace(day=28) + timedelta(days=4)).replace(day=1)
            m_end = next_m
        rev = sum(
            float(o.total) for o in all_orders
            if o.status == "fulfilled" and o.created_at
            and m_start <= o.created_at < m_end
        )
        monthly.append({"month": m_start.strftime("%b %Y"), "revenue": rev})

    # Top buyers
    buyer_rev: dict[int, dict] = {}
    for o in all_orders:
        if o.status == "fulfilled" and o.buyer:
            bid = o.buyer.id
            if bid not in buyer_rev:
                buyer_rev[bid] = {"id": bid, "name": o.buyer.name, "company": o.buyer.company, "revenue": 0, "orders": 0}
            buyer_rev[bid]["revenue"] += float(o.total)
            buyer_rev[bid]["orders"] += 1
    top_buyers = sorted(buyer_rev.values(), key=lambda x: x["revenue"], reverse=True)[:5]

    # Top products
    prod_rev: dict[int, dict] = {}
    for o in all_orders:
        if o.status == "fulfilled":
            for item in (o.items or []):
                pid = item.get("product_id")
                if pid:
                    if pid not in prod_rev:
                        prod_rev[pid] = {"id": pid, "name": item.get("name", ""), "revenue": 0, "qty_sold": 0}
                    prod_rev[pid]["revenue"] += float(item.get("total", 0))
                    prod_rev[pid]["qty_sold"] += item.get("qty", 0)
    top_products = sorted(prod_rev.values(), key=lambda x: x["revenue"], reverse=True)[:5]

    return {
        "total_revenue": total_revenue,
        "this_month_revenue": this_month_revenue,
        "total_orders": total_order_count,
        "pending_orders": pending_count,
        "confirmed_orders": confirmed_count,
        "fulfilled_orders": fulfilled_count,
        "active_buyers": active_buyers,
        "total_products": total_products,
        "avg_order_value": avg_order_value,
        "monthly_revenue": monthly,
        "top_buyers": top_buyers,
        "top_products": top_products,
    }

# ── Public Buyer Portal ────────────────────────────────────────────────────────

@router.get("/wholesale/catalogue/{token}")
def get_buyer_catalogue(token: str, db: Session = Depends(get_db)):
    buyer = db.query(WholesaleBuyer).filter(
        WholesaleBuyer.token == token, WholesaleBuyer.is_active == True
    ).first()
    if not buyer:
        raise HTTPException(status_code=404, detail="Catalogue not found or link is inactive.")

    shop = db.query(Shop).filter(Shop.id == buyer.shop_id).first()
    products = db.query(WholesaleProduct).filter(
        WholesaleProduct.shop_id == buyer.shop_id,
        WholesaleProduct.is_active == True
    ).order_by(WholesaleProduct.id).all()

    return {
        "buyer": {"id": buyer.id, "name": buyer.name, "company": buyer.company},
        "shop": {
            "name": shop.name if shop else "",
            "logo_url": shop.logo_url if shop else None,
            "currency": shop.currency if shop else "LKR",
            "phone": shop.phone if shop else None,
            "email": shop.email if shop else None,
        },
        "products": [_product_dict(p) for p in products],
    }


@router.post("/wholesale/catalogue/{token}/order")
def submit_buyer_order(token: str, data: BuyerOrderIn, db: Session = Depends(get_db)):
    buyer = db.query(WholesaleBuyer).filter(
        WholesaleBuyer.token == token, WholesaleBuyer.is_active == True
    ).first()
    if not buyer:
        raise HTTPException(status_code=404, detail="Catalogue link not found or inactive.")

    shop_id = buyer.shop_id
    items = []
    subtotal = 0.0
    for item in data.items:
        total = round(item.qty * item.unit_price, 2)
        subtotal += total
        items.append({
            "product_id": item.product_id, "name": item.name,
            "sku": item.sku, "qty": item.qty, "unit": item.unit,
            "unit_price": item.unit_price, "total": total,
        })

    order_number = _next_order_number(shop_id, db)
    order = WholesaleOrder(
        shop_id=shop_id, buyer_id=buyer.id,
        order_number=order_number, items=items,
        subtotal=round(subtotal, 2), discount=0,
        total=round(subtotal, 2),
        notes=data.notes, status="pending",
    )
    db.add(order)
    db.flush()

    # Auto-create a Quotation for the seller
    shop = db.query(Shop).filter(Shop.id == shop_id).first()
    valid_until = (datetime.now(timezone.utc) + timedelta(days=30)).date()
    year = datetime.now(timezone.utc).year
    count = db.query(func.count(Quotation.id)).filter(Quotation.shop_id == shop_id).scalar() or 0
    quote_number = f"WQ-{year}-{shop_id:03d}-{count + 1:04d}"
    import secrets as _s
    quote_token = _s.token_urlsafe(32)

    quote_items = [
        {
            "type": "item", "product_id": i["product_id"], "name": i["name"],
            "sku": i.get("sku"), "qty": i["qty"], "unit": i.get("unit", "pcs"),
            "unit_price": i["unit_price"], "total": i["total"],
            "quantity_available": None, "is_optional": False,
        }
        for i in items
    ]

    quotation = Quotation(
        shop_id=shop_id, quote_number=quote_number,
        customer_name=buyer.name,
        customer_email=buyer.email,
        customer_phone=buyer.phone,
        items=quote_items,
        subtotal=round(subtotal, 2), discount=0, tax=0,
        total=round(subtotal, 2),
        notes=f"Wholesale order from {buyer.company or buyer.name}. Order #{order_number}.",
        valid_until=valid_until,
        status="pending",
        client_token=quote_token,
    )
    db.add(quotation)
    db.flush()
    order.quotation_id = quotation.id
    db.commit()

    return {
        "order_number": order_number,
        "total": round(subtotal, 2),
        "quotation_id": quotation.id,
        "message": "Your order request has been sent. The seller will contact you shortly.",
    }
