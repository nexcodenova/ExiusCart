"""add size_chart_url, channel_sync_logs table, seed fashion ShopFields

Revision ID: e7f21a9c3b45
Revises: d4a8f13c6e21
Create Date: 2026-07-22 04:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e7f21a9c3b45'
down_revision: Union[str, None] = 'd4a8f13c6e21'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# label, field_key, field_type, sort_order — kept as plain text fields for
# now (not dropdowns) since the "right" option list for Material/Pattern/etc
# is a real business decision, not something to invent here.
FASHION_FIELDS = [
    ("Material", "material", "text", 10),
    ("Pattern", "pattern", "text", 20),
    ("Occasion", "occasion", "text", 30),
    ("Style", "style", "text", 40),
    ("Sleeve Length", "sleeve_length", "text", 50),
    ("Fit", "fit", "text", 60),
    ("Fabric", "fabric", "text", 70),
    ("Country of Origin", "country_of_origin", "text", 80),
    ("Delivery Time", "delivery_time", "text", 90),
]

# Starter categories for every shop, so the category picker on Add Product
# is actually meaningful instead of always falling back to "General"/"Other".
# TheDersi shops get these too — TheDersi's own platform is fashion-only,
# but TheDersi sellers also get a Daraz connection (a general marketplace),
# so a TheDersi seller can easily sell electronics or perfume there too.
DEFAULT_CATEGORIES = [
    ("Fashion & Apparel", 10),
    ("Electronics", 20),
    ("Beauty & Personal Care", 30),
    ("Home & Living", 40),
    ("Other", 50),
]


def upgrade() -> None:
    op.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS size_chart_url VARCHAR(500);")

    op.execute("""
        CREATE TABLE IF NOT EXISTS channel_sync_logs (
            id SERIAL PRIMARY KEY,
            shop_id INTEGER NOT NULL REFERENCES shops(id),
            product_id INTEGER REFERENCES products(id),
            channel_type VARCHAR(50) NOT NULL,
            action VARCHAR(50) NOT NULL,
            success BOOLEAN NOT NULL,
            external_id VARCHAR(100),
            error_message TEXT,
            created_at TIMESTAMPTZ DEFAULT now()
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_channel_sync_logs_shop_id ON channel_sync_logs (shop_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_channel_sync_logs_created_at ON channel_sync_logs (created_at);")

    conn = op.get_bind()

    # Seed starter categories for every shop that doesn't already have one
    # by that name (idempotent, safe to re-run). Includes TheDersi shops —
    # see DEFAULT_CATEGORIES comment above for why.
    for name, sort_order in DEFAULT_CATEGORIES:
        conn.execute(sa.text("""
            INSERT INTO categories (shop_id, name, slug, sort_order, is_active, created_at)
            SELECT s.id, :name,
                   lower(replace(:name, ' ', '-')) || '-' || substr(md5(random()::text || s.id::text || :name), 1, 6),
                   :sort_order, true, now()
            FROM shops s
            WHERE NOT EXISTS (
                SELECT 1 FROM categories c WHERE c.shop_id = s.id AND c.name = :name
            )
        """), {"name": name, "sort_order": sort_order})

    # Fashion fields scope to each shop's "Fashion & Apparel" category so
    # non-fashion sellers (electronics, perfume, etc.) never see them —
    # TheDersi shops included, since their Daraz connection can list
    # anything, not just clothing.
    for label, field_key, field_type, sort_order in FASHION_FIELDS:
        conn.execute(sa.text("""
            INSERT INTO shop_fields (shop_id, category_id, label, field_key, field_type, options, is_required, sort_order, is_active, created_at)
            SELECT s.id,
                   (SELECT c.id FROM categories c WHERE c.shop_id = s.id AND c.name = 'Fashion & Apparel' LIMIT 1),
                   :label, :field_key, :field_type, NULL, false, :sort_order, true, now()
            FROM shops s
            WHERE NOT EXISTS (
                SELECT 1 FROM shop_fields sf WHERE sf.shop_id = s.id AND sf.field_key = :field_key
            )
        """), {"label": label, "field_key": field_key, "field_type": field_type, "sort_order": sort_order})


def downgrade() -> None:
    op.execute("DELETE FROM shop_fields WHERE field_key IN ({})".format(
        ",".join(f"'{fk}'" for _, fk, _, _ in FASHION_FIELDS)
    ))
    op.drop_table('channel_sync_logs')
    op.drop_column('products', 'size_chart_url')
