"""add bundle_selections to order_items

Revision ID: c1a5e8f21b34
Revises: b8909792fba9
Create Date: 2026-07-19 17:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c1a5e8f21b34'
down_revision: Union[str, None] = 'b8909792fba9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('order_items', sa.Column('bundle_selections', postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    op.drop_column('order_items', 'bundle_selections')
