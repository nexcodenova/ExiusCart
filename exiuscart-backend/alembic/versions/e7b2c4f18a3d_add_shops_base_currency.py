"""add shops.base_currency

Revision ID: e7b2c4f18a3d
Revises: d1f4a9c3e6b2
Create Date: 2026-08-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'e7b2c4f18a3d'
down_revision: Union[str, None] = 'd1f4a9c3e6b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE shops ADD COLUMN IF NOT EXISTS base_currency VARCHAR(10);")
    # Existing shops: whatever they've already entered is in their current
    # display currency — that becomes their fixed base, so nothing they've
    # already priced silently changes value the moment this ships.
    op.execute("UPDATE shops SET base_currency = currency WHERE base_currency IS NULL;")


def downgrade() -> None:
    op.execute("ALTER TABLE shops DROP COLUMN IF EXISTS base_currency;")
