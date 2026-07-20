"""add builder_fields to email_campaigns

Revision ID: f3d81a4b9e02
Revises: e93b1f7a2c56
Create Date: 2026-07-20 06:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f3d81a4b9e02'
down_revision: Union[str, None] = 'e93b1f7a2c56'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS builder_fields JSON;")


def downgrade() -> None:
    op.drop_column('email_campaigns', 'builder_fields')
