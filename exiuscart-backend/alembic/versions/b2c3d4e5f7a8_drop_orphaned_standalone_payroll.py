"""drop orphaned standalone payroll tables

Revision ID: b2c3d4e5f7a8
Revises: a1b2c3d4e5f7
Create Date: 2026-09-11

The standalone Payroll page (its own staff roster + payroll runs,
PayrollStaff/PayrollRun/PayrollItem) was never linked from any sidebar item
or button — the real, reachable payroll feature is the "Payroll" tab on the
HR page, backed by the separate PayrollRecord model (untouched by this
migration). Audit confirmed zero references to the standalone page/tables
anywhere in the frontend, so this drops the dead tables rather than leaving
unreachable data behind.
"""
from alembic import op


revision = "b2c3d4e5f7a8"
down_revision = "a1b2c3d4e5f7"
branch_labels = None
depends_on = None


def upgrade():
    # Children first (FK dependencies): payroll_items -> payroll_runs / payroll_staff
    op.drop_table("payroll_items")
    op.drop_table("payroll_runs")
    op.drop_table("payroll_staff")


def downgrade():
    # Recreating these isn't supported — the feature is being removed
    # deliberately, not just this schema version. Restore from the previous
    # migration's table definitions manually if ever needed.
    raise NotImplementedError("Standalone payroll tables were intentionally removed; no downgrade path.")
