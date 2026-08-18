"""
Wallet — a spendable cashback balance for Custom Website storefront
customers. Separate feature from the existing points+tier Loyalty program
(app/models/loyalty.py, endpoints in shops.py) — confirmed with the user
this is its own thing, not a merge. Seller sets their own cashback %;
ExiusCart credits it automatically when an order is paid and debits it
automatically when a customer spends it at checkout.
"""

import logging
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.models.customer import Customer
from app.models.order import Order
from app.models.wallet import WalletSettings, WalletAccount, WalletTransaction
from app.api.v1.deps import get_current_user, get_current_customer

logger = logging.getLogger(__name__)
router = APIRouter()


def _shop_or_404(shop_id: int, user: User, db: Session):
    from app.models.shop import Shop
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


def _get_or_create_account(shop_id: int, customer_id: int, db: Session) -> WalletAccount:
    account = db.query(WalletAccount).filter(
        WalletAccount.shop_id == shop_id, WalletAccount.customer_id == customer_id,
    ).first()
    if not account:
        # Wallet balance is real, spendable money — it must be denominated in
        # the shop's actual currency (base_currency), never the column default.
        # Without this every new account silently inherited the model's "LKR"
        # default regardless of what currency the shop actually uses.
        from app.models.shop import Shop
        shop = db.query(Shop).filter(Shop.id == shop_id).first()
        shop_currency = (shop.base_currency or shop.currency) if shop else "USD"
        account = WalletAccount(shop_id=shop_id, customer_id=customer_id, balance=Decimal("0"), currency=shop_currency)
        db.add(account)
        db.flush()
    return account


def _apply_transaction(account: WalletAccount, type_: str, amount: Decimal, description: str, order_id: Optional[int], db: Session):
    if type_ == "debit" and account.balance < amount:
        raise HTTPException(status_code=400, detail="Insufficient wallet balance.")
    account.balance = (account.balance + amount) if type_ == "credit" else (account.balance - amount)
    db.add(WalletTransaction(account_id=account.id, order_id=order_id, type=type_, amount=amount, description=description))


# ── Called internally from checkout.py — not exposed as endpoints ───────────

def credit_wallet_for_order(order: Order, db: Session):
    """Called from checkout.py's payment_webhook once an order is marked
    paid. Silently no-ops if Wallet isn't enabled or there's no customer
    to credit — a wallet issue must never block a real payment from being
    recorded, so this never raises."""
    if not order.customer_id:
        return
    settings = db.query(WalletSettings).filter(WalletSettings.shop_id == order.shop_id).first()
    if not settings or not settings.is_enabled or settings.cashback_percent <= 0:
        return
    amount = (Decimal(str(order.total)) * settings.cashback_percent / Decimal("100")).quantize(Decimal("0.01"))
    if amount <= 0:
        return
    account = _get_or_create_account(order.shop_id, order.customer_id, db)
    _apply_transaction(account, "credit", amount, f"Cashback — order {order.order_number}", order.id, db)
    db.commit()


def debit_wallet_for_redemption(shop_id: int, customer_id: int, requested_amount: Decimal, db: Session) -> Decimal:
    """Called from checkout.py's checkout() when a customer redeems wallet
    balance as a discount. Returns the amount actually debited, capped at
    the current balance — never more than what's really there."""
    account = db.query(WalletAccount).filter(
        WalletAccount.shop_id == shop_id, WalletAccount.customer_id == customer_id,
    ).first()
    if not account or account.balance <= 0 or requested_amount <= 0:
        return Decimal("0")
    redeem = min(requested_amount, account.balance)
    _apply_transaction(account, "debit", redeem, "Redeemed at checkout", None, db)
    return redeem


# ── Seller-facing settings ───────────────────────────────────────────────────

class WalletSettingsIn(BaseModel):
    is_enabled: bool
    cashback_percent: float


@router.get("/shops/{shop_id}/wallet/settings")
def get_wallet_settings(shop_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _shop_or_404(shop_id, current_user, db)
    settings = db.query(WalletSettings).filter(WalletSettings.shop_id == shop_id).first()
    if not settings:
        return {"is_enabled": False, "cashback_percent": 0.0}
    return {"is_enabled": settings.is_enabled, "cashback_percent": float(settings.cashback_percent)}


@router.put("/shops/{shop_id}/wallet/settings")
def set_wallet_settings(shop_id: int, data: WalletSettingsIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _shop_or_404(shop_id, current_user, db)
    if data.cashback_percent < 0 or data.cashback_percent > 100:
        raise HTTPException(status_code=422, detail="Cashback % must be between 0 and 100.")
    settings = db.query(WalletSettings).filter(WalletSettings.shop_id == shop_id).first()
    if not settings:
        settings = WalletSettings(shop_id=shop_id)
        db.add(settings)
    settings.is_enabled = data.is_enabled
    settings.cashback_percent = data.cashback_percent
    db.commit()
    return {"is_enabled": settings.is_enabled, "cashback_percent": float(settings.cashback_percent)}


# ── Seller-facing members/ledger view ───────────────────────────────────────

@router.get("/shops/{shop_id}/wallet/accounts")
def list_wallet_accounts(shop_id: int, search: Optional[str] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _shop_or_404(shop_id, current_user, db)
    accounts = db.query(WalletAccount).filter(WalletAccount.shop_id == shop_id).all()
    result = []
    for a in accounts:
        c = db.query(Customer).filter(Customer.id == a.customer_id).first()
        if not c:
            continue
        if search:
            s = search.lower()
            if s not in (c.name or "").lower() and s not in (c.email or "").lower():
                continue
        last_tx = db.query(WalletTransaction).filter(WalletTransaction.account_id == a.id).order_by(WalletTransaction.created_at.desc()).first()
        result.append({
            "id": a.id,
            "customer_id": c.id,
            "customer_name": c.name,
            "customer_email": c.email,
            "balance": float(a.balance),
            "currency": a.currency,
            "last_activity": last_tx.created_at.isoformat() if last_tx else None,
        })
    return result


@router.get("/shops/{shop_id}/wallet/accounts/{account_id}")
def get_wallet_account_detail(shop_id: int, account_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _shop_or_404(shop_id, current_user, db)
    account = db.query(WalletAccount).filter(WalletAccount.id == account_id, WalletAccount.shop_id == shop_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Wallet account not found")
    customer = db.query(Customer).filter(Customer.id == account.customer_id).first()
    txs = db.query(WalletTransaction).filter(WalletTransaction.account_id == account.id).order_by(WalletTransaction.created_at.desc()).all()
    return {
        "id": account.id,
        "customer_name": customer.name if customer else None,
        "customer_email": customer.email if customer else None,
        "balance": float(account.balance),
        "currency": account.currency,
        "transactions": [
            {
                "id": t.id, "type": t.type, "amount": float(t.amount), "description": t.description,
                "order_id": t.order_id, "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in txs
        ],
    }


class ManualAdjustIn(BaseModel):
    amount: float
    description: Optional[str] = None


@router.post("/shops/{shop_id}/wallet/accounts/{account_id}/credit")
def manual_credit(shop_id: int, account_id: int, data: ManualAdjustIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _shop_or_404(shop_id, current_user, db)
    account = db.query(WalletAccount).filter(WalletAccount.id == account_id, WalletAccount.shop_id == shop_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Wallet account not found")
    if data.amount <= 0:
        raise HTTPException(status_code=422, detail="Amount must be positive.")
    _apply_transaction(account, "credit", Decimal(str(data.amount)), data.description or "Manual credit", None, db)
    db.commit()
    return {"balance": float(account.balance)}


@router.post("/shops/{shop_id}/wallet/accounts/{account_id}/debit")
def manual_debit(shop_id: int, account_id: int, data: ManualAdjustIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _shop_or_404(shop_id, current_user, db)
    account = db.query(WalletAccount).filter(WalletAccount.id == account_id, WalletAccount.shop_id == shop_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Wallet account not found")
    if data.amount <= 0:
        raise HTTPException(status_code=422, detail="Amount must be positive.")
    _apply_transaction(account, "debit", Decimal(str(data.amount)), data.description or "Manual debit", None, db)
    db.commit()
    return {"balance": float(account.balance)}


# ── Customer-facing (storefront) ─────────────────────────────────────────────

@router.get("/public/store/{shop_slug}/wallet")
def public_wallet_balance(shop_slug: str, db: Session = Depends(get_db), customer: Customer = Depends(get_current_customer)):
    from app.models.shop import Shop
    shop = db.query(Shop).filter(Shop.slug == shop_slug, Shop.is_active == True).first()
    if not shop or customer.shop_id != shop.id:
        raise HTTPException(status_code=404, detail="Store not found")
    account = db.query(WalletAccount).filter(WalletAccount.shop_id == shop.id, WalletAccount.customer_id == customer.id).first()
    if not account:
        return {"balance": 0.0, "currency": shop.base_currency or shop.currency, "transactions": []}
    txs = db.query(WalletTransaction).filter(WalletTransaction.account_id == account.id).order_by(WalletTransaction.created_at.desc()).limit(50).all()
    return {
        "balance": float(account.balance),
        "currency": account.currency,
        "transactions": [
            {"type": t.type, "amount": float(t.amount), "description": t.description, "created_at": t.created_at.isoformat() if t.created_at else None}
            for t in txs
        ],
    }
