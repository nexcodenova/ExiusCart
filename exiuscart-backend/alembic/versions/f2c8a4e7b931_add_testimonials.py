"""add testimonials table, seed TheDersi's existing quote

Revision ID: f2c8a4e7b931
Revises: e5f7b1d3a924
Create Date: 2026-09-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f2c8a4e7b931'
down_revision: Union[str, None] = 'e5f7b1d3a924'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'testimonials',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('company_name', sa.String(length=200), nullable=False),
        sa.Column('subtitle', sa.String(length=300), nullable=True),
        sa.Column('quote_text', sa.Text(), nullable=False),
        sa.Column('rating', sa.Integer(), nullable=False, server_default='5'),
        sa.Column('reviewer_name', sa.String(length=200), nullable=True),
        sa.Column('submitter_email', sa.String(length=255), nullable=True),
        sa.Column('is_approved', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('source', sa.String(length=20), nullable=False, server_default='admin'),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_testimonials_id'), 'testimonials', ['id'], unique=False)

    # Carry over the one testimonial already hardcoded on the homepage —
    # same real text, now served through the real table instead of frozen
    # in the marketing site's own source code.
    op.execute("""
        INSERT INTO testimonials (company_name, subtitle, quote_text, rating, reviewer_name, is_approved, source, sort_order)
        VALUES (
            'TheDersi',
            'Sri Lankan Fashion Marketplace · Sri Lanka · #1 Fashion Platform',
            'TheDersi is Sri Lanka''s leading fashion marketplace. Our sellers rely on ExiusCart to manage their products, inventory, and orders — all in one place. It has made running a multi-seller marketplace seamless and efficient.',
            5,
            'TheDersi',
            true,
            'admin',
            0
        )
    """)


def downgrade() -> None:
    op.drop_index(op.f('ix_testimonials_id'), table_name='testimonials')
    op.drop_table('testimonials')
