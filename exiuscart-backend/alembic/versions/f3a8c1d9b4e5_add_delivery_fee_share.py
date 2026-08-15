"""add channel_order_meta.delivery_fee_share

Revision ID: f3a8c1d9b4e5
Revises: e7b2c4f18a3d
Create Date: 2026-08-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f3a8c1d9b4e5'
down_revision: Union[str, None] = 'e7b2c4f18a3d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('channel_order_meta', sa.Column('delivery_fee_share', sa.Numeric(10, 2), nullable=True))


def downgrade() -> None:
    op.drop_column('channel_order_meta', 'delivery_fee_share')
