"""add channel_connections.seller_country

Revision ID: d94f2a1b6c37
Revises: b2e18c5a7f93
Create Date: 2026-08-04 00:00:00.000000

The seller's registered country on the channel (eBay in particular) —
stated explicitly at connect time, never inferred from the shop's general
profile country, since eBay rejects listings whose item location doesn't
match the seller account's own registered country.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd94f2a1b6c37'
down_revision: Union[str, None] = 'b2e18c5a7f93'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('channel_connections', sa.Column('seller_country', sa.String(length=2), nullable=True))


def downgrade() -> None:
    op.drop_column('channel_connections', 'seller_country')
