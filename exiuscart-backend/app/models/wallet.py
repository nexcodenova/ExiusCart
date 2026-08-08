from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

# Separate from the existing points+tier Loyalty program (app/models/loyalty.py)
# — confirmed with the user this is its own feature, not a merge. Wallet is
# a spendable currency balance (cashback), Loyalty is points/bronze-silver-gold.


class WalletSettings(Base):
    """Per-shop wallet configuration — cashback is seller-chosen, not a
    hardcoded percentage."""
    __tablename__ = "wallet_settings"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    is_enabled = Column(Boolean, nullable=False, default=False)
    cashback_percent = Column(Numeric(5, 2), nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class WalletAccount(Base):
    """One per customer per shop. `balance` is denormalized for fast
    reads, but is only ever changed alongside a WalletTransaction row in
    the same commit — the ledger is the source of truth, this is a cache."""
    __tablename__ = "wallet_accounts"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    balance = Column(Numeric(12, 2), nullable=False, default=0)
    currency = Column(String(3), nullable=False, default="LKR")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    transactions = relationship("WalletTransaction", back_populates="account", cascade="all, delete-orphan")


class WalletTransaction(Base):
    """A ledger, not a mutable number — every balance change has a row
    here, both for audit and so a seller/customer can see why a balance
    changed. Same discipline as LoyaltyTransaction."""
    __tablename__ = "wallet_transactions"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("wallet_accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    type = Column(String(10), nullable=False)  # credit | debit
    amount = Column(Numeric(12, 2), nullable=False)
    description = Column(String(300), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    account = relationship("WalletAccount", back_populates="transactions")
