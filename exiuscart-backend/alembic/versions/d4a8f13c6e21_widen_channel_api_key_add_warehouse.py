"""widen channel_api_key to text, add channel_warehouse_code

Revision ID: d4a8f13c6e21
Revises: c6e329f20980
Create Date: 2026-07-22 01:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd4a8f13c6e21'
down_revision: Union[str, None] = 'c6e329f20980'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE channel_connections ALTER COLUMN channel_api_key TYPE TEXT;")
    op.execute("ALTER TABLE channel_connections ADD COLUMN IF NOT EXISTS channel_warehouse_code VARCHAR(100);")


def downgrade() -> None:
    op.drop_column('channel_connections', 'channel_warehouse_code')
    op.execute("ALTER TABLE channel_connections ALTER COLUMN channel_api_key TYPE VARCHAR(500);")
