"""add products.view_count and products.units_sold

Revision ID: a8434d29d2ef
Revises: 5f2def98d782
Create Date: 2026-08-11 00:00:00.000000

Real, earned social-proof counters for products with no reviews yet — never
fabricated. view_count increments on every real product-detail page load
(public_store_product_detail); units_sold increments wherever stock already
decrements on a real sale across checkout/channels/orders/reservations.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a8434d29d2ef'
down_revision: Union[str, None] = '5f2def98d782'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('products', sa.Column('view_count', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('products', sa.Column('units_sold', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    op.drop_column('products', 'units_sold')
    op.drop_column('products', 'view_count')
