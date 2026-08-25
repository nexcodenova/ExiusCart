"""add seller_delivery_cost to channel_order_meta

Revision ID: d4a8f2c6b9e3
Revises: b3e7d1f9a4c6
Create Date: 2026-08-26

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd4a8f2c6b9e3'
down_revision: Union[str, None] = 'b3e7d1f9a4c6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('channel_order_meta', sa.Column('seller_delivery_cost', sa.Numeric(10, 2), nullable=True))


def downgrade() -> None:
    op.drop_column('channel_order_meta', 'seller_delivery_cost')
