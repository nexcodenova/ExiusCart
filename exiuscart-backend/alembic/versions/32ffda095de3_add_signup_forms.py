"""add signup_forms + signup_form_submissions tables

Revision ID: 32ffda095de3
Revises: f7a3d05b8e12
Create Date: 2026-08-07 00:00:00.000000

Seller-built forms (newsletter/inquiry capture) shown via an embeddable
widget on Shopify/Custom Website storefronts, with a JSON field schema
(same JSON-column approach already used for shop_leads.score_breakdown)
instead of a fixed shape. Submissions store the full answer set and
optionally link to the shop_leads row created from them.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '32ffda095de3'
down_revision: Union[str, None] = 'f7a3d05b8e12'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'signup_forms',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('shop_id', sa.Integer(), sa.ForeignKey('shops.id'), nullable=False),
        sa.Column('channel_type', sa.String(length=20), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('fields', sa.JSON(), nullable=False),
        sa.Column('success_message', sa.String(length=300), nullable=True),
        sa.Column('discount_code', sa.String(length=50), nullable=True),
        sa.Column('delay_seconds', sa.Integer(), server_default='3'),
        sa.Column('is_active', sa.Boolean(), server_default=sa.true()),
        sa.Column('impressions', sa.Integer(), server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_signup_forms_id', 'signup_forms', ['id'])
    op.create_index('ix_signup_forms_shop_id', 'signup_forms', ['shop_id'])

    op.create_table(
        'signup_form_submissions',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('form_id', sa.Integer(), sa.ForeignKey('signup_forms.id', ondelete='CASCADE'), nullable=False),
        sa.Column('shop_id', sa.Integer(), sa.ForeignKey('shops.id'), nullable=False),
        sa.Column('data', sa.JSON(), nullable=False),
        sa.Column('lead_id', sa.Integer(), sa.ForeignKey('shop_leads.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_signup_form_submissions_id', 'signup_form_submissions', ['id'])
    op.create_index('ix_signup_form_submissions_form_id', 'signup_form_submissions', ['form_id'])
    op.create_index('ix_signup_form_submissions_shop_id', 'signup_form_submissions', ['shop_id'])


def downgrade() -> None:
    op.drop_index('ix_signup_form_submissions_shop_id', table_name='signup_form_submissions')
    op.drop_index('ix_signup_form_submissions_form_id', table_name='signup_form_submissions')
    op.drop_index('ix_signup_form_submissions_id', table_name='signup_form_submissions')
    op.drop_table('signup_form_submissions')
    op.drop_index('ix_signup_forms_shop_id', table_name='signup_forms')
    op.drop_index('ix_signup_forms_id', table_name='signup_forms')
    op.drop_table('signup_forms')
