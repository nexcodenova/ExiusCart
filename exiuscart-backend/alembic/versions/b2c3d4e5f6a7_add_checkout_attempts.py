"""add checkout_attempts table (Abandoned Cart Drip Flow trigger)

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-09-08 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'checkout_attempts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('shop_id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('cart_snapshot', sa.JSON(), nullable=False),
        sa.Column('handled', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('order_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['shop_id'], ['shops.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_checkout_attempts_id'), 'checkout_attempts', ['id'], unique=False)
    op.create_index(op.f('ix_checkout_attempts_shop_id'), 'checkout_attempts', ['shop_id'], unique=False)
    op.create_index(op.f('ix_checkout_attempts_email'), 'checkout_attempts', ['email'], unique=False)
    op.create_index(op.f('ix_checkout_attempts_created_at'), 'checkout_attempts', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_checkout_attempts_created_at'), table_name='checkout_attempts')
    op.drop_index(op.f('ix_checkout_attempts_email'), table_name='checkout_attempts')
    op.drop_index(op.f('ix_checkout_attempts_shop_id'), table_name='checkout_attempts')
    op.drop_index(op.f('ix_checkout_attempts_id'), table_name='checkout_attempts')
    op.drop_table('checkout_attempts')
