"""add affiliate product fields

Revision ID: a4d81f5c9e26
Revises: f2a7c93e1b04
Create Date: 2026-08-30 05:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a4d81f5c9e26'
down_revision: Union[str, None] = 'f2a7c93e1b04'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('products', sa.Column('affiliate_url', sa.String(length=1000), nullable=True))
    op.add_column('products', sa.Column('affiliate_cta_text', sa.String(length=60), nullable=True))


def downgrade() -> None:
    op.drop_column('products', 'affiliate_cta_text')
    op.drop_column('products', 'affiliate_url')
