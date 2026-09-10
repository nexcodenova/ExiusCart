"""storefront category: publish/visibility/featured/SEO/updated_at

Revision ID: a1b2c3d4e5f7
Revises: f6a7b8c9d0e1
Create Date: 2026-09-10

Adds the fields the Storefront Categories screen needs to be real:
Published/Draft, storefront visibility, Featured, SEO title/description,
and an updated_at timestamp. Also widens allowed channels to every
"your own store" platform (handled in the model, no schema change).
"""
from alembic import op
import sqlalchemy as sa


revision = "a1b2c3d4e5f7"
down_revision = "f6a7b8c9d0e1"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("storefront_categories", sa.Column("is_published", sa.Boolean(), server_default="true", nullable=False))
    op.add_column("storefront_categories", sa.Column("visibility", sa.String(length=20), server_default="nav_and_grid", nullable=False))
    op.add_column("storefront_categories", sa.Column("is_featured", sa.Boolean(), server_default="false", nullable=False))
    op.add_column("storefront_categories", sa.Column("seo_title", sa.String(length=80), nullable=True))
    op.add_column("storefront_categories", sa.Column("seo_description", sa.Text(), nullable=True))
    op.add_column("storefront_categories", sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True))


def downgrade():
    op.drop_column("storefront_categories", "updated_at")
    op.drop_column("storefront_categories", "seo_description")
    op.drop_column("storefront_categories", "seo_title")
    op.drop_column("storefront_categories", "is_featured")
    op.drop_column("storefront_categories", "visibility")
    op.drop_column("storefront_categories", "is_published")
