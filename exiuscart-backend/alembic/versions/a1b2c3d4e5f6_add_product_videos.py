"""add product_ad_videos table (Higgsfield AI ad video generation)

Revision ID: a1b2c3d4e5f6
Revises: f2c8a4e7b931
Create Date: 2026-09-08 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'f2c8a4e7b931'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Named "product_ad_videos", not "product_videos" — that table name is
    # already taken by product_fields.py's seller-pasted YouTube/TikTok
    # embed-link feature, a real collision caught at import time.
    op.create_table(
        'product_ad_videos',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('shop_id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='queued'),
        sa.Column('model', sa.String(length=100), nullable=False),
        sa.Column('prompt', sa.Text(), nullable=True),
        sa.Column('source_image_url', sa.Text(), nullable=False),
        sa.Column('request_id', sa.String(length=100), nullable=True),
        sa.Column('video_url', sa.Text(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['shop_id'], ['shops.id']),
        sa.ForeignKeyConstraint(['product_id'], ['products.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_product_ad_videos_id'), 'product_ad_videos', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_product_ad_videos_id'), table_name='product_ad_videos')
    op.drop_table('product_ad_videos')
