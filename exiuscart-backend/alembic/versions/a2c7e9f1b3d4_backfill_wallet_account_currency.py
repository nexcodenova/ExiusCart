"""backfill wallet_accounts.currency from each shop's real currency

WalletAccount.currency defaulted to a hardcoded "LKR" at the model level,
and the account-creation code never overrode it with the shop's actual
currency. Every wallet account ever created — regardless of shop — was
silently mislabeled LKR. This backfills existing rows to match their
shop's real base_currency now that the creation bug is fixed.

Revision ID: a2c7e9f1b3d4
Revises: f3a8c1d9b4e5
Create Date: 2026-08-18

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'a2c7e9f1b3d4'
down_revision: Union[str, None] = 'f3a8c1d9b4e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        UPDATE wallet_accounts
        SET currency = COALESCE(shops.base_currency, shops.currency, 'USD')
        FROM shops
        WHERE wallet_accounts.shop_id = shops.id
          AND wallet_accounts.currency IS DISTINCT FROM COALESCE(shops.base_currency, shops.currency, 'USD')
    """)


def downgrade() -> None:
    # Original values weren't correct to begin with (always "LKR") — nothing
    # meaningful to revert to.
    pass
