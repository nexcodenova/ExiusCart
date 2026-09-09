"""add whatsapp_connections, whatsapp_templates, whatsapp_campaigns, whatsapp_message_logs

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-09-09 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'whatsapp_connections',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('shop_id', sa.Integer(), nullable=False),
        sa.Column('waba_id', sa.String(length=100), nullable=False),
        sa.Column('phone_number_id', sa.String(length=100), nullable=False),
        sa.Column('display_phone_number', sa.String(length=30), nullable=True),
        sa.Column('verified_name', sa.String(length=255), nullable=True),
        sa.Column('access_token', sa.Text(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('connected_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['shop_id'], ['shops.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('shop_id'),
    )
    op.create_index(op.f('ix_whatsapp_connections_id'), 'whatsapp_connections', ['id'], unique=False)
    op.create_index(op.f('ix_whatsapp_connections_shop_id'), 'whatsapp_connections', ['shop_id'], unique=False)

    op.create_table(
        'whatsapp_templates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('shop_id', sa.Integer(), nullable=False),
        sa.Column('meta_template_id', sa.String(length=100), nullable=True),
        sa.Column('name', sa.String(length=512), nullable=False),
        sa.Column('language', sa.String(length=20), nullable=False),
        sa.Column('category', sa.String(length=20), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=True),
        sa.Column('body_text', sa.Text(), nullable=True),
        sa.Column('variable_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('synced_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['shop_id'], ['shops.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_whatsapp_templates_id'), 'whatsapp_templates', ['id'], unique=False)
    op.create_index(op.f('ix_whatsapp_templates_shop_id'), 'whatsapp_templates', ['shop_id'], unique=False)

    op.create_table(
        'whatsapp_campaigns',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('shop_id', sa.Integer(), nullable=False),
        sa.Column('template_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='draft'),
        sa.Column('total_recipients', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('sent_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('failed_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['shop_id'], ['shops.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['template_id'], ['whatsapp_templates.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_whatsapp_campaigns_id'), 'whatsapp_campaigns', ['id'], unique=False)
    op.create_index(op.f('ix_whatsapp_campaigns_shop_id'), 'whatsapp_campaigns', ['shop_id'], unique=False)

    op.create_table(
        'whatsapp_message_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('campaign_id', sa.Integer(), nullable=False),
        sa.Column('customer_id', sa.Integer(), nullable=True),
        sa.Column('phone', sa.String(length=30), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('whatsapp_message_id', sa.String(length=150), nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('sent_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['campaign_id'], ['whatsapp_campaigns.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_whatsapp_message_logs_id'), 'whatsapp_message_logs', ['id'], unique=False)
    op.create_index(op.f('ix_whatsapp_message_logs_campaign_id'), 'whatsapp_message_logs', ['campaign_id'], unique=False)
    op.create_index(op.f('ix_whatsapp_message_logs_customer_id'), 'whatsapp_message_logs', ['customer_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_whatsapp_message_logs_customer_id'), table_name='whatsapp_message_logs')
    op.drop_index(op.f('ix_whatsapp_message_logs_campaign_id'), table_name='whatsapp_message_logs')
    op.drop_index(op.f('ix_whatsapp_message_logs_id'), table_name='whatsapp_message_logs')
    op.drop_table('whatsapp_message_logs')

    op.drop_index(op.f('ix_whatsapp_campaigns_shop_id'), table_name='whatsapp_campaigns')
    op.drop_index(op.f('ix_whatsapp_campaigns_id'), table_name='whatsapp_campaigns')
    op.drop_table('whatsapp_campaigns')

    op.drop_index(op.f('ix_whatsapp_templates_shop_id'), table_name='whatsapp_templates')
    op.drop_index(op.f('ix_whatsapp_templates_id'), table_name='whatsapp_templates')
    op.drop_table('whatsapp_templates')

    op.drop_index(op.f('ix_whatsapp_connections_shop_id'), table_name='whatsapp_connections')
    op.drop_index(op.f('ix_whatsapp_connections_id'), table_name='whatsapp_connections')
    op.drop_table('whatsapp_connections')
