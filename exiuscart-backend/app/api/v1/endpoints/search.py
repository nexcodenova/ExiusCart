"""Global search for the dashboard's top bar: products, orders and customers of
ONE shop, plus "recommended" suggestions built from that shop's own data (best
sellers, low stock, latest orders and customers). Nothing is invented: every
suggestion is a real row.

Any active team member may call this; what they get back is filtered by their
role (see shop_access: the "search" segment is open, the filtering is here)."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.core.database import get_db
from app.core.shop_access import get_active_membership, get_shop_for_member, role_allows
from app.models.customer import Customer
from app.models.order import Order
from app.models.product import Product
from app.models.user import User

router = APIRouter()

PER_SECTION = 5


def _like(term: str) -> str:
    """Escape LIKE wildcards so a search for '50%' matches '50%' and nothing else."""
    return "%" + term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"


def _allowed_sections(db: Session, shop, user: User) -> set:
    if shop.owner_id == user.id or user.is_superuser:
        return {"products", "orders", "customers"}
    m = get_active_membership(db, shop.id, user.id)
    perms = (m.role.permissions if m and m.role else []) or []
    return {a for a in ("products", "orders", "customers") if role_allows(perms, a, False)}


def _product(p: Product, reason: Optional[str] = None) -> dict:
    return {"id": p.id, "name": p.name, "sku": p.sku, "price": float(p.price) if p.price is not None else None,
            "stock": p.quantity, "image_url": p.image_url, "reason": reason}


def _order(o: Order, customer_name: Optional[str], reason: Optional[str] = None) -> dict:
    return {"id": o.id, "order_number": o.order_number, "total": float(o.total) if o.total is not None else None,
            "status": o.status, "customer_name": customer_name,
            "created_at": o.created_at.isoformat() if o.created_at else None, "reason": reason}


def _customer(c: Customer, reason: Optional[str] = None) -> dict:
    return {"id": c.id, "name": c.name, "email": c.email, "phone": c.phone, "reason": reason}


def _shop(db: Session, shop_id: int, user: User):
    shop = get_shop_for_member(db, shop_id, user)
    if not shop and user.is_superuser:
        from app.models.shop import Shop
        shop = db.query(Shop).filter(Shop.id == shop_id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


@router.get("/shops/{shop_id}/search")
def search(shop_id: int, q: str = "", db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    shop = _shop(db, shop_id, user)
    term = (q or "").strip()[:80]
    allowed = _allowed_sections(db, shop, user)
    out = {"query": term, "products": [], "orders": [], "customers": []}
    if len(term) < 2:
        return out
    like = _like(term)

    if "products" in allowed:
        rows = (
            db.query(Product)
            .filter(Product.shop_id == shop.id, or_(
                Product.name.ilike(like, escape="\\"), Product.sku.ilike(like, escape="\\"), Product.barcode.ilike(like, escape="\\")))
            .order_by(Product.units_sold.desc(), Product.id.desc()).limit(PER_SECTION).all()
        )
        out["products"] = [_product(p) for p in rows]

    if "customers" in allowed:
        rows = (
            db.query(Customer)
            .filter(Customer.shop_id == shop.id, or_(
                Customer.name.ilike(like, escape="\\"), Customer.email.ilike(like, escape="\\"), Customer.phone.ilike(like, escape="\\")))
            .order_by(Customer.id.desc()).limit(PER_SECTION).all()
        )
        out["customers"] = [_customer(c) for c in rows]

    if "orders" in allowed:
        rows = (
            db.query(Order, Customer.name)
            .outerjoin(Customer, Customer.id == Order.customer_id)
            .filter(Order.shop_id == shop.id, or_(
                Order.order_number.ilike(like, escape="\\"), Customer.name.ilike(like, escape="\\"),
                Customer.email.ilike(like, escape="\\"), Customer.phone.ilike(like, escape="\\")))
            .order_by(Order.id.desc()).limit(PER_SECTION).all()
        )
        out["orders"] = [_order(o, name) for o, name in rows]
    return out


@router.get("/shops/{shop_id}/search/suggestions")
def suggestions(shop_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """What to show when the search box is opened empty: real rows from this shop."""
    shop = _shop(db, shop_id, user)
    allowed = _allowed_sections(db, shop, user)
    out = {"best_sellers": [], "low_stock": [], "recent_orders": [], "recent_customers": []}

    if "products" in allowed:
        best = (db.query(Product).filter(Product.shop_id == shop.id, Product.units_sold > 0)
                .order_by(Product.units_sold.desc(), Product.id.desc()).limit(PER_SECTION).all())
        out["best_sellers"] = [_product(p, f"{p.units_sold} sold") for p in best]
        low = (db.query(Product).filter(Product.shop_id == shop.id, Product.is_active == True,  # noqa: E712
                                        Product.quantity > 0, Product.quantity <= func.coalesce(Product.low_stock_threshold, 5),
                                        Product.quantity < 100000)
               .order_by(Product.quantity.asc()).limit(3).all())
        out["low_stock"] = [_product(p, f"{p.quantity} left") for p in low]

    if "orders" in allowed:
        rows = (db.query(Order, Customer.name).outerjoin(Customer, Customer.id == Order.customer_id)
                .filter(Order.shop_id == shop.id).order_by(Order.id.desc()).limit(PER_SECTION).all())
        out["recent_orders"] = [_order(o, name) for o, name in rows]

    if "customers" in allowed:
        rows = db.query(Customer).filter(Customer.shop_id == shop.id).order_by(Customer.id.desc()).limit(3).all()
        out["recent_customers"] = [_customer(c) for c in rows]
    return out
