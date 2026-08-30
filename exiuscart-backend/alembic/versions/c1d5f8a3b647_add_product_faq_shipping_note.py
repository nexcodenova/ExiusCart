"""add products.faq and products.shipping_note

Revision ID: c1d5f8a3b647
Revises: b6e934d7f812
Create Date: 2026-08-30 07:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c1d5f8a3b647'
down_revision: Union[str, None] = 'b6e934d7f812'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('products', sa.Column('faq', sa.JSON(), nullable=True))
    op.add_column('products', sa.Column('shipping_note', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('products', 'shipping_note')
    op.drop_column('products', 'faq')
