"""add deactivation_reason to users

Revision ID: f1a2b3c4d5e6
Revises: e7f21a9c3b45
Create Date: 2026-07-23 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = 'e7f21a9c3b45'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivation_reason VARCHAR(30);")


def downgrade() -> None:
    op.drop_column('users', 'deactivation_reason')
