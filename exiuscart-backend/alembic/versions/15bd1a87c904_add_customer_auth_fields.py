"""add customers.password_hash and customers.source

Revision ID: 15bd1a87c904
Revises: 193a3e6aa1eb
Create Date: 2026-08-08 00:00:00.000000

Enables storefront self-signup for the Custom Website channel (customers
previously only existed via POS/manual/order-sync, never logged in
themselves). Both columns nullable — existing customers are unaffected.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '15bd1a87c904'
down_revision: Union[str, None] = '193a3e6aa1eb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('customers', sa.Column('password_hash', sa.String(length=255), nullable=True))
    op.add_column('customers', sa.Column('source', sa.String(length=30), nullable=True))


def downgrade() -> None:
    op.drop_column('customers', 'source')
    op.drop_column('customers', 'password_hash')
