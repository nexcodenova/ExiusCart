"""add social_account_connections and social_posts

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-09-08 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'social_account_connections',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('shop_id', sa.Integer(), nullable=False),
        sa.Column('platform', sa.String(length=20), nullable=False),
        sa.Column('account_id', sa.String(length=100), nullable=False),
        sa.Column('account_name', sa.String(length=255), nullable=True),
        sa.Column('page_id', sa.String(length=100), nullable=True),
        sa.Column('access_token', sa.Text(), nullable=True),
        sa.Column('refresh_token', sa.Text(), nullable=True),
        sa.Column('token_expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('pending_user_token', sa.Text(), nullable=True),
        sa.Column('oauth_state', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('connected_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['shop_id'], ['shops.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('shop_id', 'platform', 'account_id', name='uq_social_account_shop_platform_account'),
    )
    op.create_index(op.f('ix_social_account_connections_id'), 'social_account_connections', ['id'], unique=False)
    op.create_index(op.f('ix_social_account_connections_shop_id'), 'social_account_connections', ['shop_id'], unique=False)
    op.create_index(op.f('ix_social_account_connections_oauth_state'), 'social_account_connections', ['oauth_state'], unique=False)

    op.create_table(
        'social_posts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('shop_id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=True),
        sa.Column('platforms', sa.Text(), nullable=False),
        sa.Column('caption', sa.Text(), nullable=True),
        sa.Column('media_url', sa.Text(), nullable=False),
        sa.Column('media_type', sa.String(length=10), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='scheduled'),
        sa.Column('scheduled_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('results_json', sa.Text(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['shop_id'], ['shops.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_social_posts_id'), 'social_posts', ['id'], unique=False)
    op.create_index(op.f('ix_social_posts_shop_id'), 'social_posts', ['shop_id'], unique=False)
    op.create_index(op.f('ix_social_posts_product_id'), 'social_posts', ['product_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_social_posts_product_id'), table_name='social_posts')
    op.drop_index(op.f('ix_social_posts_shop_id'), table_name='social_posts')
    op.drop_index(op.f('ix_social_posts_id'), table_name='social_posts')
    op.drop_table('social_posts')

    op.drop_index(op.f('ix_social_account_connections_oauth_state'), table_name='social_account_connections')
    op.drop_index(op.f('ix_social_account_connections_shop_id'), table_name='social_account_connections')
    op.drop_index(op.f('ix_social_account_connections_id'), table_name='social_account_connections')
    op.drop_table('social_account_connections')
