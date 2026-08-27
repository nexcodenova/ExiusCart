"""add product_storefront_categories

Revision ID: c8f4a2e91d67
Revises: a1c5e8f37b92
Create Date: 2026-08-28 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c8f4a2e91d67'
down_revision: Union[str, None] = 'a1c5e8f37b92'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'product_storefront_categories',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('product_id', sa.Integer(), sa.ForeignKey('products.id'), nullable=False),
        sa.Column('channel_connection_id', sa.Integer(), sa.ForeignKey('channel_connections.id'), nullable=False),
        sa.Column('category_id', sa.String(length=100), nullable=False),
        sa.Column('category_name', sa.Text(), nullable=True),
        sa.UniqueConstraint('product_id', 'channel_connection_id', 'category_id', name='uq_product_conn_storefront_cat'),
    )


def downgrade() -> None:
    op.drop_table('product_storefront_categories')
