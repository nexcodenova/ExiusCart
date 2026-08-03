"""widen channel_category name columns to text

Revision ID: b2e18c5a7f93
Revises: a7c3e91f4d68
Create Date: 2026-08-03 00:00:00.000000

channel_categories.name and product_channel_categories'
channel_category_name/channel_sub_category_name were VARCHAR(255), sized
for TheDersi's flat category names ("Festival Wear"). eBay's category
names are full breadcrumb paths that can exceed 255 characters, which
failed the whole category-sync batch insert with
StringDataRightTruncation the first time a real eBay account synced its
~1000 categories.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b2e18c5a7f93'
down_revision: Union[str, None] = 'a7c3e91f4d68'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE channel_categories ALTER COLUMN name TYPE TEXT;")
    op.execute("ALTER TABLE product_channel_categories ALTER COLUMN channel_category_name TYPE TEXT;")
    op.execute("ALTER TABLE product_channel_categories ALTER COLUMN channel_sub_category_name TYPE TEXT;")


def downgrade() -> None:
    op.execute("ALTER TABLE channel_categories ALTER COLUMN name TYPE VARCHAR(255);")
    op.execute("ALTER TABLE product_channel_categories ALTER COLUMN channel_category_name TYPE VARCHAR(255);")
    op.execute("ALTER TABLE product_channel_categories ALTER COLUMN channel_sub_category_name TYPE VARCHAR(255);")
