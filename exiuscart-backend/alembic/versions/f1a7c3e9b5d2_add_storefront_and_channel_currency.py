"""add shops.storefront_currency and channel_connections.channel_currency

Neither Custom Website nor push channels (eBay/Shopify/WooCommerce) ever
converted a price before sending it out — they either had no currency
field at all, or accepted one and silently ignored it. These two columns
let a seller opt into real conversion: storefront_currency is what the
Custom Website API should convert prices into before responding;
channel_currency is what a specific connected channel's own store
actually uses. Both null by default — today's unconverted behavior is
unchanged until a seller explicitly sets one.

Revision ID: f1a7c3e9b5d2
Revises: c4d9e1f6a2b8
Create Date: 2026-08-20

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f1a7c3e9b5d2'
down_revision: Union[str, None] = 'c4d9e1f6a2b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('shops', sa.Column('storefront_currency', sa.String(length=10), nullable=True))
    op.add_column('channel_connections', sa.Column('channel_currency', sa.String(length=10), nullable=True))


def downgrade() -> None:
    op.drop_column('channel_connections', 'channel_currency')
    op.drop_column('shops', 'storefront_currency')
