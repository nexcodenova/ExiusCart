"""add prodora shipping cost, fulfillment rate, demand trend, top countries

Revision ID: c93a5f16d8e7
Revises: b4f8e29a71c3
Create Date: 2026-07-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'c93a5f16d8e7'
down_revision: Union[str, None] = 'b4f8e29a71c3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS fulfillment_rate NUMERIC(5,2);")
    op.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(10,2);")
    op.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS demand_trend_json TEXT;")
    op.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS top_countries_json TEXT;")


def downgrade() -> None:
    for col in ["fulfillment_rate", "shipping_cost", "demand_trend_json", "top_countries_json"]:
        op.execute(f"ALTER TABLE products DROP COLUMN IF EXISTS {col};")
