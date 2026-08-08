"""add custom_product_field_settings table + products.custom_field_values

Revision ID: f734611345fd
Revises: d710f1c1621c
Create Date: 2026-08-08 00:00:00.000000

Seller-defined extra product fields for the Custom Website channel (e.g.
Quantity Tiers, Gift Wrap) — schema defined once per shop, values stored
per product. Not hardcoded by ExiusCart, not fetched from the seller's
own site.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f734611345fd'
down_revision: Union[str, None] = 'd710f1c1621c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'custom_product_field_settings',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('shop_id', sa.Integer(), sa.ForeignKey('shops.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('fields', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_custom_product_field_settings_id', 'custom_product_field_settings', ['id'])
    op.create_index('ix_custom_product_field_settings_shop_id', 'custom_product_field_settings', ['shop_id'])

    op.add_column('products', sa.Column('custom_field_values', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('products', 'custom_field_values')
    op.drop_index('ix_custom_product_field_settings_shop_id', table_name='custom_product_field_settings')
    op.drop_index('ix_custom_product_field_settings_id', table_name='custom_product_field_settings')
    op.drop_table('custom_product_field_settings')
