"""add product_reviews.channel_source

Revision ID: 5f2def98d782
Revises: 896fe38a7c9d
Create Date: 2026-08-11 00:00:00.000000

Tags each review with the sales channel its underlying order came from
(order.source at request time — "custom", "pos", "shopify", etc). Powers
filtering on the Reviews page and is the anchor point for channel-native
reviews (e.g. a future TheDersi review sync) landing in the same table.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '5f2def98d782'
down_revision: Union[str, None] = '896fe38a7c9d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('product_reviews', sa.Column('channel_source', sa.String(length=30), nullable=True))


def downgrade() -> None:
    op.drop_column('product_reviews', 'channel_source')
