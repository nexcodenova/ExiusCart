"""add email_templates table

Revision ID: e93b1f7a2c56
Revises: d472a9c6e8f1
Create Date: 2026-07-20 06:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e93b1f7a2c56'
down_revision: Union[str, None] = 'd472a9c6e8f1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'email_templates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('shop_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('heading', sa.String(length=300), nullable=True),
        sa.Column('subtitle', sa.Text(), nullable=True),
        sa.Column('hero_image_url', sa.String(length=1000), nullable=True),
        sa.Column('button_text', sa.String(length=100), nullable=True),
        sa.Column('button_color', sa.String(length=7), nullable=True),
        sa.Column('button_shape', sa.String(length=20), nullable=True),
        sa.Column('font_key', sa.String(length=30), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['shop_id'], ['shops.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_email_templates_id'), 'email_templates', ['id'], unique=False)
    op.create_index(op.f('ix_email_templates_shop_id'), 'email_templates', ['shop_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_email_templates_shop_id'), table_name='email_templates')
    op.drop_index(op.f('ix_email_templates_id'), table_name='email_templates')
    op.drop_table('email_templates')
