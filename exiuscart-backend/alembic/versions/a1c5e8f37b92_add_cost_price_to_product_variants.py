"""add cost_price to product_variants

Revision ID: a1c5e8f37b92
Revises: d4a8f2c6b9e3
Create Date: 2026-08-27 11:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a1c5e8f37b92'
down_revision: Union[str, None] = 'd4a8f2c6b9e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('product_variants', sa.Column('cost_price', sa.Numeric(10, 2), nullable=True))


def downgrade() -> None:
    op.drop_column('product_variants', 'cost_price')
