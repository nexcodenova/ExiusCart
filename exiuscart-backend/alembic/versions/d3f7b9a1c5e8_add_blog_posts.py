"""add blog_posts table

Revision ID: d3f7b9a1c5e8
Revises: a8e2f4c7b1d9
Create Date: 2026-08-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd3f7b9a1c5e8'
down_revision: Union[str, None] = 'a8e2f4c7b1d9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'blog_posts',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('shop_id', sa.Integer(), sa.ForeignKey('shops.id'), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('slug', sa.String(length=255), nullable=False),
        sa.Column('excerpt', sa.String(length=500), nullable=True),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('cover_image_url', sa.String(length=500), nullable=True),
        sa.Column('status', sa.String(length=20), server_default='draft'),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('author_name', sa.String(length=255), nullable=True),
        sa.Column('tags', sa.String(length=500), nullable=True),
        sa.Column('cta_text', sa.String(length=100), nullable=True),
        sa.Column('cta_url', sa.String(length=500), nullable=True),
        sa.Column('view_count', sa.Integer(), server_default='0'),
        sa.Column('shopify_article_id', sa.String(length=100), nullable=True),
        sa.Column('shopify_blog_id', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    # Every public blog page load and every dashboard list filters by
    # shop_id first — same "every query needs this" reasoning as the
    # earlier products/orders/customers index migration.
    op.create_index('ix_blog_posts_shop_id_status', 'blog_posts', ['shop_id', 'status'])
    op.create_index('ix_blog_posts_shop_id_slug', 'blog_posts', ['shop_id', 'slug'])


def downgrade() -> None:
    op.drop_index('ix_blog_posts_shop_id_slug', table_name='blog_posts')
    op.drop_index('ix_blog_posts_shop_id_status', table_name='blog_posts')
    op.drop_table('blog_posts')
