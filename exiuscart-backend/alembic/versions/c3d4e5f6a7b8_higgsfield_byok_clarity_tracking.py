"""Higgsfield BYOK connection, storefront event tracking, Clarity fields on shops

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-09-08 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'higgsfield_connections',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('shop_id', sa.Integer(), nullable=False),
        sa.Column('api_key_id_enc', sa.Text(), nullable=False),
        sa.Column('api_key_secret_enc', sa.Text(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['shop_id'], ['shops.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('shop_id'),
    )
    op.create_index(op.f('ix_higgsfield_connections_id'), 'higgsfield_connections', ['id'], unique=False)
    op.create_index(op.f('ix_higgsfield_connections_shop_id'), 'higgsfield_connections', ['shop_id'], unique=False)

    op.create_table(
        'storefront_events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('shop_id', sa.Integer(), nullable=False),
        sa.Column('event_type', sa.String(length=20), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=True),
        sa.Column('query', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['shop_id'], ['shops.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_storefront_events_id'), 'storefront_events', ['id'], unique=False)
    op.create_index(op.f('ix_storefront_events_shop_id'), 'storefront_events', ['shop_id'], unique=False)
    op.create_index(op.f('ix_storefront_events_event_type'), 'storefront_events', ['event_type'], unique=False)
    op.create_index(op.f('ix_storefront_events_created_at'), 'storefront_events', ['created_at'], unique=False)

    op.add_column('shops', sa.Column('clarity_project_id', sa.String(length=100), nullable=True))
    op.add_column('shops', sa.Column('clarity_api_token_enc', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('shops', 'clarity_api_token_enc')
    op.drop_column('shops', 'clarity_project_id')

    op.drop_index(op.f('ix_storefront_events_created_at'), table_name='storefront_events')
    op.drop_index(op.f('ix_storefront_events_event_type'), table_name='storefront_events')
    op.drop_index(op.f('ix_storefront_events_shop_id'), table_name='storefront_events')
    op.drop_index(op.f('ix_storefront_events_id'), table_name='storefront_events')
    op.drop_table('storefront_events')

    op.drop_index(op.f('ix_higgsfield_connections_shop_id'), table_name='higgsfield_connections')
    op.drop_index(op.f('ix_higgsfield_connections_id'), table_name='higgsfield_connections')
    op.drop_table('higgsfield_connections')
