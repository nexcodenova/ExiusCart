"""add receipt_url to channel_order_meta

Revision ID: f9c2b7a3d8e1
Revises: e5a1c8f3b2d6
Create Date: 2026-08-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f9c2b7a3d8e1'
down_revision: Union[str, None] = 'e5a1c8f3b2d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('channel_order_meta', sa.Column('receipt_url', sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column('channel_order_meta', 'receipt_url')
