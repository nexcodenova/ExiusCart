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
    # IF NOT EXISTS throughout — app startup's own Base.metadata.create_all()
    # also creates any new table it sees in the models, and can race this
    # migration (whichever runs first wins), so this must tolerate the table
    # already being there, same as the old hand-written migrations always did.
    op.execute("""
        CREATE TABLE IF NOT EXISTS email_templates (
            id SERIAL PRIMARY KEY,
            shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
            name VARCHAR(200) NOT NULL,
            heading VARCHAR(300),
            subtitle TEXT,
            hero_image_url VARCHAR(1000),
            button_text VARCHAR(100),
            button_color VARCHAR(7),
            button_shape VARCHAR(20),
            font_key VARCHAR(30),
            created_at TIMESTAMPTZ DEFAULT now()
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_email_templates_id ON email_templates (id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_email_templates_shop_id ON email_templates (shop_id);")


def downgrade() -> None:
    op.drop_index(op.f('ix_email_templates_shop_id'), table_name='email_templates')
    op.drop_index(op.f('ix_email_templates_id'), table_name='email_templates')
    op.drop_table('email_templates')
