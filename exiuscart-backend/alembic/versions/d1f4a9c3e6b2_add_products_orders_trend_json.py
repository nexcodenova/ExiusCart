"""add products.orders_trend_json

Revision ID: d1f4a9c3e6b2
Revises: a8434d29d2ef
Create Date: 2026-08-13 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'd1f4a9c3e6b2'
down_revision: Union[str, None] = 'a8434d29d2ef'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS orders_trend_json TEXT;")


def downgrade() -> None:
    op.execute("ALTER TABLE products DROP COLUMN IF EXISTS orders_trend_json;")
