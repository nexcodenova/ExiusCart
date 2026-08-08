"""add captured_form_submissions table

Revision ID: 193a3e6aa1eb
Revises: 32ffda095de3
Create Date: 2026-08-07 00:00:00.000000

Captures submissions from a form the seller already built themselves
(tagged with data-exiuscart-capture) rather than one made through the
Signup Forms builder — a separate table since field names are whatever
the seller's own HTML uses, not a schema we defined.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '193a3e6aa1eb'
down_revision: Union[str, None] = '32ffda095de3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'captured_form_submissions',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('shop_id', sa.Integer(), sa.ForeignKey('shops.id'), nullable=False),
        sa.Column('source_url', sa.String(length=500), nullable=True),
        sa.Column('data', sa.JSON(), nullable=False),
        sa.Column('lead_id', sa.Integer(), sa.ForeignKey('shop_leads.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_captured_form_submissions_id', 'captured_form_submissions', ['id'])
    op.create_index('ix_captured_form_submissions_shop_id', 'captured_form_submissions', ['shop_id'])


def downgrade() -> None:
    op.drop_index('ix_captured_form_submissions_shop_id', table_name='captured_form_submissions')
    op.drop_index('ix_captured_form_submissions_id', table_name='captured_form_submissions')
    op.drop_table('captured_form_submissions')
