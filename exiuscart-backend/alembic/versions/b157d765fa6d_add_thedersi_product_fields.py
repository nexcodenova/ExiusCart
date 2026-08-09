"""add thedersi dynamic product-fields cache + per-product values

Revision ID: b157d765fa6d
Revises: f734611345fd
Create Date: 2026-08-09 00:00:00.000000

Replaces the old hardcoded fashion field list (Material/Pattern/etc, seeded
in partner.py) with a live fetch from TheDersi's own
GET /exiuscart/product-fields endpoint — same "sync from the channel,
don't hardcode it" pattern already used for channel categories.
field_defs_cache/field_defs_synced_at cache what TheDersi's API returned
(refetched when stale); channel_field_values holds what the seller actually
typed in for one product on one channel connection.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b157d765fa6d'
down_revision: Union[str, None] = 'f734611345fd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('channel_connections', sa.Column('field_defs_cache', sa.JSON(), nullable=True))
    op.add_column('channel_connections', sa.Column('field_defs_synced_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('product_channel_categories', sa.Column('channel_field_values', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('product_channel_categories', 'channel_field_values')
    op.drop_column('channel_connections', 'field_defs_synced_at')
    op.drop_column('channel_connections', 'field_defs_cache')
