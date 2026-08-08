"""add channel_connections payment gateway fields

Revision ID: 347258321026
Revises: 15bd1a87c904
Create Date: 2026-08-08 00:00:00.000000

Gateway-agnostic on purpose — payment_gateway names which one is active
(e.g. "payhere"), the other two hold whatever that gateway calls its
credentials. Custom Website channel only.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '347258321026'
down_revision: Union[str, None] = '15bd1a87c904'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('channel_connections', sa.Column('payment_gateway', sa.String(length=30), nullable=True))
    op.add_column('channel_connections', sa.Column('gateway_merchant_id', sa.String(length=100), nullable=True))
    op.add_column('channel_connections', sa.Column('gateway_merchant_secret', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('channel_connections', 'gateway_merchant_secret')
    op.drop_column('channel_connections', 'gateway_merchant_id')
    op.drop_column('channel_connections', 'payment_gateway')
