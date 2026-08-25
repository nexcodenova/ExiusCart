"""add payment_method to channel_order_meta

Revision ID: b3e7d1f9a4c6
Revises: f9c2b7a3d8e1
Create Date: 2026-08-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b3e7d1f9a4c6'
down_revision: Union[str, None] = 'f9c2b7a3d8e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('channel_order_meta', sa.Column('payment_method', sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column('channel_order_meta', 'payment_method')
