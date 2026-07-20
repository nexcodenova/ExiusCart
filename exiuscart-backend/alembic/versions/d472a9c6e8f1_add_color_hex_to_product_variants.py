"""add color_hex to product_variants

Revision ID: d472a9c6e8f1
Revises: c1a5e8f21b34
Create Date: 2026-07-19 18:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd472a9c6e8f1'
down_revision: Union[str, None] = 'c1a5e8f21b34'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('product_variants', sa.Column('color_hex', sa.String(length=7), nullable=True))


def downgrade() -> None:
    op.drop_column('product_variants', 'color_hex')
