"""add digital product fields + digital_deliveries table

Revision ID: e5a1c8f3b2d6
Revises: d3f7b9a1c5e8
Create Date: 2026-08-25

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e5a1c8f3b2d6'
down_revision: Union[str, None] = 'd3f7b9a1c5e8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('products', sa.Column('product_type', sa.String(length=20), nullable=False, server_default='physical'))
    op.add_column('products', sa.Column('digital_file_url', sa.String(length=1000), nullable=True))
    op.add_column('products', sa.Column('digital_file_name', sa.String(length=255), nullable=True))

    op.create_table(
        'digital_deliveries',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('shop_id', sa.Integer(), sa.ForeignKey('shops.id'), nullable=False),
        sa.Column('order_id', sa.Integer(), sa.ForeignKey('orders.id'), nullable=False),
        sa.Column('order_item_id', sa.Integer(), sa.ForeignKey('order_items.id'), nullable=True),
        sa.Column('product_id', sa.Integer(), sa.ForeignKey('products.id'), nullable=True),
        sa.Column('download_token', sa.String(length=64), nullable=False),
        sa.Column('access_code', sa.String(length=16), nullable=False),
        sa.Column('delivered_to_email', sa.String(length=255), nullable=True),
        sa.Column('view_count', sa.Integer(), server_default='0'),
        sa.Column('last_accessed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_digital_deliveries_download_token', 'digital_deliveries', ['download_token'], unique=True)
    op.create_index('ix_digital_deliveries_order_id', 'digital_deliveries', ['order_id'])


def downgrade() -> None:
    op.drop_index('ix_digital_deliveries_order_id', table_name='digital_deliveries')
    op.drop_index('ix_digital_deliveries_download_token', table_name='digital_deliveries')
    op.drop_table('digital_deliveries')
    op.drop_column('products', 'digital_file_name')
    op.drop_column('products', 'digital_file_url')
    op.drop_column('products', 'product_type')
