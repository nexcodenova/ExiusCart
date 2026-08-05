"""add storefront_categories.parent_id for main/sub/sub-sub tree

Revision ID: f7a3d05b8e12
Revises: e5b8f2c91a04
Create Date: 2026-08-06 00:00:00.000000

Self-referential parent_id — Main (null) -> Sub (parent=Main) -> Sub-sub
(parent=Sub). Same pattern as the existing generic Category model.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f7a3d05b8e12'
down_revision: Union[str, None] = 'e5b8f2c91a04'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('storefront_categories', sa.Column('parent_id', sa.Integer(), sa.ForeignKey('storefront_categories.id'), nullable=True))


def downgrade() -> None:
    op.drop_column('storefront_categories', 'parent_id')
