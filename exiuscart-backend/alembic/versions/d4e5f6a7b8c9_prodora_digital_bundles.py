"""add prodora_digital_bundles and prodora_digital_purchases

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-09-08 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'prodora_digital_bundles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('cover_image_url', sa.Text(), nullable=True),
        sa.Column('editable_file_url', sa.Text(), nullable=True),
        sa.Column('pdf_file_url', sa.Text(), nullable=True),
        sa.Column('price', sa.Numeric(10, 2), nullable=False),
        sa.Column('suggested_resale_price', sa.Numeric(10, 2), nullable=True),
        sa.Column('resale_notes', sa.Text(), nullable=True),
        sa.Column('ad_facebook_url', sa.String(length=1000), nullable=True),
        sa.Column('ad_tiktok_url', sa.String(length=1000), nullable=True),
        sa.Column('ad_instagram_url', sa.String(length=1000), nullable=True),
        sa.Column('ad_pinterest_url', sa.String(length=1000), nullable=True),
        sa.Column('whop_checkout_url', sa.Text(), nullable=True),
        sa.Column('whop_product_id', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_prodora_digital_bundles_id'), 'prodora_digital_bundles', ['id'], unique=False)

    op.create_table(
        'prodora_digital_purchases',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('bundle_id', sa.Integer(), nullable=False),
        sa.Column('shop_id', sa.Integer(), nullable=False),
        sa.Column('whop_payment_id', sa.String(length=100), nullable=True),
        sa.Column('purchased_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['bundle_id'], ['prodora_digital_bundles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['shop_id'], ['shops.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('whop_payment_id'),
    )
    op.create_index(op.f('ix_prodora_digital_purchases_id'), 'prodora_digital_purchases', ['id'], unique=False)
    op.create_index(op.f('ix_prodora_digital_purchases_bundle_id'), 'prodora_digital_purchases', ['bundle_id'], unique=False)
    op.create_index(op.f('ix_prodora_digital_purchases_shop_id'), 'prodora_digital_purchases', ['shop_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_prodora_digital_purchases_shop_id'), table_name='prodora_digital_purchases')
    op.drop_index(op.f('ix_prodora_digital_purchases_bundle_id'), table_name='prodora_digital_purchases')
    op.drop_index(op.f('ix_prodora_digital_purchases_id'), table_name='prodora_digital_purchases')
    op.drop_table('prodora_digital_purchases')

    op.drop_index(op.f('ix_prodora_digital_bundles_id'), table_name='prodora_digital_bundles')
    op.drop_table('prodora_digital_bundles')
