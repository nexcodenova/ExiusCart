"""add activity_logs table

Revision ID: c3d4e5f6a8b9
Revises: b2c3d4e5f7a8
Create Date: 2026-09-11

Real, append-only order/payment activity feed for the Orders page's Recent
Activity panel — see app/models/activity_log.py for exactly what it covers.
"""
from alembic import op
import sqlalchemy as sa


revision = "c3d4e5f6a8b9"
down_revision = "b2c3d4e5f7a8"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "activity_logs",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("shop_id", sa.Integer(), sa.ForeignKey("shops.id"), nullable=False),
        sa.Column("event_type", sa.String(30), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.String(300), nullable=True),
        sa.Column("order_id", sa.Integer(), sa.ForeignKey("orders.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_activity_logs_shop_id", "activity_logs", ["shop_id"])
    op.create_index("ix_activity_logs_created_at", "activity_logs", ["created_at"])


def downgrade():
    op.drop_index("ix_activity_logs_created_at", table_name="activity_logs")
    op.drop_index("ix_activity_logs_shop_id", table_name="activity_logs")
    op.drop_table("activity_logs")
