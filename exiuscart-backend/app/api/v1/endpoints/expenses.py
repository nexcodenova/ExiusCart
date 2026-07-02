"""Expense tracking endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.models.shop import Shop
from app.models.expense import Expense
from app.api.v1.deps import get_current_user

router = APIRouter()


def _shop(shop_id: int, user: User, db: Session) -> Shop:
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


def _fmt(e: Expense) -> dict:
    return {
        "id": str(e.id),
        "category": e.category,
        "description": e.description or "",
        "amount": float(e.amount),
        "date": e.date,
        "paymentMethod": e.payment_method,
        "created_at": e.created_at.isoformat() if e.created_at else None,
    }


@router.get("/shops/{shop_id}/expenses")
def list_expenses(shop_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    rows = db.query(Expense).filter(Expense.shop_id == shop_id).order_by(Expense.date.desc(), Expense.id.desc()).all()
    return [_fmt(e) for e in rows]


@router.post("/shops/{shop_id}/expenses", status_code=201)
def create_expense(shop_id: int, body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    e = Expense(
        shop_id=shop_id,
        category=body.get("category", "Other"),
        description=body.get("description") or None,
        amount=body.get("amount", 0),
        date=body.get("date", ""),
        payment_method=body.get("paymentMethod", "cash"),
    )
    db.add(e)
    db.commit()
    db.refresh(e)
    return _fmt(e)


@router.delete("/shops/{shop_id}/expenses/{expense_id}", status_code=204)
def delete_expense(shop_id: int, expense_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _shop(shop_id, current_user, db)
    e = db.query(Expense).filter(Expense.id == expense_id, Expense.shop_id == shop_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Expense not found")
    db.delete(e)
    db.commit()
