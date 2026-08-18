"""add missing shop_id indexes on orders/products/customers/order_items

None of the core multi-tenant tables had an index on shop_id — the one
column every single query in the app filters by first (dashboard stats,
reports, product lists, order lists). Invisible today with ~80 total
orders across the whole platform (full table scan is instant either
way), but this is the first thing that breaks as real seller volume
grows — every query becomes a full table scan across every shop's data,
not just the one being queried.

Revision ID: b7e2f4a8c1d6
Revises: a2c7e9f1b3d4
Create Date: 2026-08-18

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'b7e2f4a8c1d6'
down_revision: Union[str, None] = 'a2c7e9f1b3d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # orders — (shop_id, created_at) covers both "all of this shop's
    # orders" and "this shop's orders in a date range", which is every
    # dashboard/report query pattern in the app.
    op.create_index('ix_orders_shop_id_created_at', 'orders', ['shop_id', 'created_at'])
    op.create_index('ix_orders_shop_id_status', 'orders', ['shop_id', 'status'])

    # order_items — order_id for the join to orders, product_id for
    # per-product performance/revenue lookups.
    op.create_index('ix_order_items_order_id', 'order_items', ['order_id'])
    op.create_index('ix_order_items_product_id', 'order_items', ['product_id'])

    # products / customers — the primary filter on every list/count query.
    op.create_index('ix_products_shop_id', 'products', ['shop_id'])
    op.create_index('ix_customers_shop_id', 'customers', ['shop_id'])


def downgrade() -> None:
    op.drop_index('ix_customers_shop_id', table_name='customers')
    op.drop_index('ix_products_shop_id', table_name='products')
    op.drop_index('ix_order_items_product_id', table_name='order_items')
    op.drop_index('ix_order_items_order_id', table_name='order_items')
    op.drop_index('ix_orders_shop_id_status', table_name='orders')
    op.drop_index('ix_orders_shop_id_created_at', table_name='orders')
