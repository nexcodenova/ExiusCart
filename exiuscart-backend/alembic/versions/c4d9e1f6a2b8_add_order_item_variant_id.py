"""add order_items.variant_id

Custom Website checkout accepted product_id + quantity only — no way to
record which size/color the buyer actually picked. A storefront building
a real variant picker needs this recorded, or stock gets decremented from
the wrong place and fulfillment can't tell what to ship.

Revision ID: c4d9e1f6a2b8
Revises: b7e2f4a8c1d6
Create Date: 2026-08-20

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c4d9e1f6a2b8'
down_revision: Union[str, None] = 'b7e2f4a8c1d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('order_items', sa.Column('variant_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_order_items_variant_id', 'order_items', 'product_variants',
        ['variant_id'], ['id'],
    )


def downgrade() -> None:
    op.drop_constraint('fk_order_items_variant_id', 'order_items', type_='foreignkey')
    op.drop_column('order_items', 'variant_id')
