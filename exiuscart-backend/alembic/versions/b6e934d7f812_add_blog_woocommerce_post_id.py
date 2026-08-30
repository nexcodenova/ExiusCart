"""add blog_posts.woocommerce_post_id

Revision ID: b6e934d7f812
Revises: a4d81f5c9e26
Create Date: 2026-08-30 06:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b6e934d7f812'
down_revision: Union[str, None] = 'a4d81f5c9e26'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('blog_posts', sa.Column('woocommerce_post_id', sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column('blog_posts', 'woocommerce_post_id')
