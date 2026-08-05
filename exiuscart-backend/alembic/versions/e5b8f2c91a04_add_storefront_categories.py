"""add storefront_categories table

Revision ID: e5b8f2c91a04
Revises: d94f2a1b6c37
Create Date: 2026-08-06 00:00:00.000000

Customer-facing category list for channels with no category system of
their own (Shopify, Custom Website) — separate from the existing generic
`categories` table used for internal product organization.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e5b8f2c91a04'
down_revision: Union[str, None] = 'd94f2a1b6c37'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'storefront_categories',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('shop_id', sa.Integer(), sa.ForeignKey('shops.id'), nullable=False),
        sa.Column('channel_type', sa.String(length=20), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('slug', sa.String(length=255), nullable=False),
        sa.Column('icon_url', sa.String(length=500), nullable=True),
        sa.Column('sort_order', sa.Integer(), server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('shop_id', 'channel_type', 'slug', name='uq_storefront_cat_shop_channel_slug'),
    )
    op.create_index('ix_storefront_categories_id', 'storefront_categories', ['id'])


def downgrade() -> None:
    op.drop_index('ix_storefront_categories_id', table_name='storefront_categories')
    op.drop_table('storefront_categories')
