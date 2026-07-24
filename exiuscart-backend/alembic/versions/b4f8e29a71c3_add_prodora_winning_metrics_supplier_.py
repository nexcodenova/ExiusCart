"""add prodora winning metrics, supplier info, ad links, specs/tags to products

Revision ID: b4f8e29a71c3
Revises: f1a2b3c4d5e6
Create Date: 2026-07-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'b4f8e29a71c3'
down_revision: Union[str, None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS winning_score INTEGER;")
    op.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS trend_percent NUMERIC(6,2);")
    op.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS competition_level VARCHAR(20);")
    op.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS saturation_level VARCHAR(20);")
    op.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS orders_count INTEGER;")
    op.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(255);")
    op.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_rating NUMERIC(3,2);")
    op.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS processing_time VARCHAR(50);")
    op.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS shipping_time VARCHAR(50);")
    op.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS warehouse_country VARCHAR(100);")
    op.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS ad_facebook_url VARCHAR(1000);")
    op.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS ad_tiktok_url VARCHAR(1000);")
    op.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS ad_instagram_url VARCHAR(1000);")
    op.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS ad_pinterest_url VARCHAR(1000);")
    op.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS specs_json TEXT;")
    op.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS tags VARCHAR(500);")


def downgrade() -> None:
    for col in [
        "winning_score", "trend_percent", "competition_level", "saturation_level",
        "orders_count", "supplier_name", "supplier_rating", "processing_time",
        "shipping_time", "warehouse_country", "ad_facebook_url", "ad_tiktok_url",
        "ad_instagram_url", "ad_pinterest_url", "specs_json", "tags",
    ]:
        op.execute(f"ALTER TABLE products DROP COLUMN IF EXISTS {col};")
