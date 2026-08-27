"""widen dropship_product_links.supplier_product_url

Revision ID: d29b6c4e83a1
Revises: c8f4a2e91d67
Create Date: 2026-08-28 09:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd29b6c4e83a1'
down_revision: Union[str, None] = 'c8f4a2e91d67'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('dropship_product_links', 'supplier_product_url', type_=sa.Text(), existing_type=sa.String(length=1000))


def downgrade() -> None:
    op.alter_column('dropship_product_links', 'supplier_product_url', type_=sa.String(length=1000), existing_type=sa.Text())
