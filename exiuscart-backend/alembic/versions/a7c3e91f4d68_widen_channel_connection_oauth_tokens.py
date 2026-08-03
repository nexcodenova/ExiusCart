"""widen channel_connections access_token/refresh_token to text

Revision ID: a7c3e91f4d68
Revises: 9a488b70d90b
Create Date: 2026-08-03 00:00:00.000000

eBay's real production OAuth tokens (with the inventory/account/fulfillment/
finances scopes ExiusCart requests) run several thousand characters —
VARCHAR(1000) was sized for a rough guess, not eBay's actual token length,
and every real eBay connect attempt was failing on save with
StringDataRightTruncation. Sandbox tokens happened to fit under 1000 chars,
which is why this wasn't caught until a real production account connected.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a7c3e91f4d68'
down_revision: Union[str, None] = '9a488b70d90b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE channel_connections ALTER COLUMN access_token TYPE TEXT;")
    op.execute("ALTER TABLE channel_connections ALTER COLUMN refresh_token TYPE TEXT;")


def downgrade() -> None:
    op.execute("ALTER TABLE channel_connections ALTER COLUMN access_token TYPE VARCHAR(1000);")
    op.execute("ALTER TABLE channel_connections ALTER COLUMN refresh_token TYPE VARCHAR(1000);")
