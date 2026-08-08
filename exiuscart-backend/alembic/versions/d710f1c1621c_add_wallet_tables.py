"""add wallet_settings, wallet_accounts, wallet_transactions tables

Revision ID: d710f1c1621c
Revises: 347258321026
Create Date: 2026-08-08 00:00:00.000000

New Wallet feature — a spendable currency cashback balance, separate from
the existing points+tier Loyalty program. Ledger-based (wallet_transactions
is the source of truth, wallet_accounts.balance is a denormalized cache).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd710f1c1621c'
down_revision: Union[str, None] = '347258321026'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'wallet_settings',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('shop_id', sa.Integer(), sa.ForeignKey('shops.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('is_enabled', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('cashback_percent', sa.Numeric(5, 2), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_wallet_settings_id', 'wallet_settings', ['id'])
    op.create_index('ix_wallet_settings_shop_id', 'wallet_settings', ['shop_id'])

    op.create_table(
        'wallet_accounts',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('shop_id', sa.Integer(), sa.ForeignKey('shops.id', ondelete='CASCADE'), nullable=False),
        sa.Column('customer_id', sa.Integer(), sa.ForeignKey('customers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('balance', sa.Numeric(12, 2), nullable=False, server_default='0'),
        sa.Column('currency', sa.String(length=3), nullable=False, server_default='LKR'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_wallet_accounts_id', 'wallet_accounts', ['id'])
    op.create_index('ix_wallet_accounts_shop_id', 'wallet_accounts', ['shop_id'])
    op.create_index('ix_wallet_accounts_customer_id', 'wallet_accounts', ['customer_id'])

    op.create_table(
        'wallet_transactions',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('account_id', sa.Integer(), sa.ForeignKey('wallet_accounts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('order_id', sa.Integer(), sa.ForeignKey('orders.id'), nullable=True),
        sa.Column('type', sa.String(length=10), nullable=False),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('description', sa.String(length=300), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_wallet_transactions_id', 'wallet_transactions', ['id'])
    op.create_index('ix_wallet_transactions_account_id', 'wallet_transactions', ['account_id'])


def downgrade() -> None:
    op.drop_index('ix_wallet_transactions_account_id', table_name='wallet_transactions')
    op.drop_index('ix_wallet_transactions_id', table_name='wallet_transactions')
    op.drop_table('wallet_transactions')
    op.drop_index('ix_wallet_accounts_customer_id', table_name='wallet_accounts')
    op.drop_index('ix_wallet_accounts_shop_id', table_name='wallet_accounts')
    op.drop_index('ix_wallet_accounts_id', table_name='wallet_accounts')
    op.drop_table('wallet_accounts')
    op.drop_index('ix_wallet_settings_shop_id', table_name='wallet_settings')
    op.drop_index('ix_wallet_settings_id', table_name='wallet_settings')
    op.drop_table('wallet_settings')
