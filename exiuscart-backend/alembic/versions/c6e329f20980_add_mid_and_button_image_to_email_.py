"""add mid_image_url and button_image_url to email_templates

Revision ID: c6e329f20980
Revises: a7c92e14f680
Create Date: 2026-07-20 20:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c6e329f20980'
down_revision: Union[str, None] = 'a7c92e14f680'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS mid_image_url VARCHAR(1000);")
    op.execute("ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS button_image_url VARCHAR(1000);")


def downgrade() -> None:
    op.drop_column('email_templates', 'button_image_url')
    op.drop_column('email_templates', 'mid_image_url')
