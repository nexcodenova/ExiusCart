"""baseline - adopt alembic on existing production schema

Revision ID: 34d9f3dc74de
Revises: 
Create Date: 2026-07-18 16:12:44.064298

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '34d9f3dc74de'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Intentionally empty. Production already has this exact schema —
    # built up over time via Base.metadata.create_all() + the old
    # hand-written migrations list in main.py. This revision is a marker:
    # `alembic stamp` records production as "already here" without running
    # any DDL. All real schema changes from now on get their own migration.
    pass


def downgrade() -> None:
    pass
