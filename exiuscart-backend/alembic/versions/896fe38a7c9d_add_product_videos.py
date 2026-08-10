"""add product_videos table (YouTube/TikTok oEmbed links)

Revision ID: 896fe38a7c9d
Revises: b157d765fa6d
Create Date: 2026-08-10 00:00:00.000000

Seller-pasted video links, resolved server-side via that platform's oEmbed
endpoint (thumbnail/title/embed html) — up to 6 per product, mirrors
product_images. Separate from Product.video_url (untouched — still used by
the internal Prodora import pipeline) so nothing existing breaks.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '896fe38a7c9d'
down_revision: Union[str, None] = 'b157d765fa6d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'product_videos',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('product_id', sa.Integer(), sa.ForeignKey('products.id', ondelete='CASCADE'), nullable=False),
        sa.Column('url', sa.String(length=1000), nullable=False),
        sa.Column('platform', sa.String(length=20), nullable=False),
        sa.Column('thumbnail_url', sa.String(length=1000), nullable=True),
        sa.Column('title', sa.String(length=500), nullable=True),
        sa.Column('embed_html', sa.Text(), nullable=True),
        sa.Column('sort_order', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_product_videos_id', 'product_videos', ['id'])
    op.create_index('ix_product_videos_product_id', 'product_videos', ['product_id'])


def downgrade() -> None:
    op.drop_index('ix_product_videos_product_id', table_name='product_videos')
    op.drop_index('ix_product_videos_id', table_name='product_videos')
    op.drop_table('product_videos')
