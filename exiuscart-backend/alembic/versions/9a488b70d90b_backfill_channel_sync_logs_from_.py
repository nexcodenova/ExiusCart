"""backfill channel_sync_logs from existing channel_product_status rows

Revision ID: 9a488b70d90b
Revises: c93a5f16d8e7
Create Date: 2026-07-29 07:40:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '9a488b70d90b'
down_revision: Union[str, None] = 'c93a5f16d8e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Daraz/Noon/eBay listing attempts and TheDersi approve/reject callbacks
    # only started writing to channel_sync_logs today — sellers who listed
    # products before this fix would otherwise see an empty Channel Listings
    # page despite having real, already-approved listings. Synthesize one
    # log entry per existing status row so that history isn't lost.
    op.execute("""
        INSERT INTO channel_sync_logs
            (shop_id, product_id, channel_type, action, success, external_id, error_message, created_at)
        SELECT
            cps.shop_id,
            cps.product_id,
            cps.channel_type,
            CASE WHEN cps.channel_type = 'thedersi' THEN 'listing_status' ELSE 'create_listing' END,
            cps.status != 'rejected',
            cps.external_item_id,
            cps.rejection_reason,
            cps.updated_at
        FROM channel_product_status cps
        WHERE NOT EXISTS (
            SELECT 1 FROM channel_sync_logs csl
            WHERE csl.product_id = cps.product_id AND csl.channel_type = cps.channel_type
        )
    """)


def downgrade() -> None:
    # Backfilled rows are indistinguishable from real ones once written —
    # not safely reversible, so this is a no-op.
    pass
