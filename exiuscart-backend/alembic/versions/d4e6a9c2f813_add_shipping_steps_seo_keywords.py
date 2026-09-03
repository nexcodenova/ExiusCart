"""add products.shipping_steps and products.seo_keywords

Revision ID: d4e6a9c2f813
Revises: c1d5f8a3b647
Create Date: 2026-09-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd4e6a9c2f813'
down_revision: Union[str, None] = 'c1d5f8a3b647'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('products', sa.Column('shipping_steps', sa.JSON(), nullable=True))
    op.add_column('products', sa.Column('seo_keywords', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('products', 'seo_keywords')
    op.drop_column('products', 'shipping_steps')
