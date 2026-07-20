"""add external_item_id to channel_product_status

Revision ID: a7c92e14f680
Revises: f3d81a4b9e02
Create Date: 2026-07-20 19:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a7c92e14f680'
down_revision: Union[str, None] = 'f3d81a4b9e02'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE channel_product_status ADD COLUMN IF NOT EXISTS external_item_id VARCHAR(100);")


def downgrade() -> None:
    op.drop_column('channel_product_status', 'external_item_id')
