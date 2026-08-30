"""add digital email template fields

Revision ID: f2a7c93e1b04
Revises: e91c4f8a2b57
Create Date: 2026-08-30 05:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f2a7c93e1b04'
down_revision: Union[str, None] = 'e91c4f8a2b57'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('products', sa.Column('digital_email_subject', sa.String(length=255), nullable=True))
    op.add_column('products', sa.Column('digital_email_message', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('products', 'digital_email_message')
    op.drop_column('products', 'digital_email_subject')
