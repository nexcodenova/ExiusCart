"""add dropship_connections.refresh_token and oauth_state

AliExpress uses a real OAuth2 flow (one shared ExiusCart app, each seller
authorizes their own AliExpress account) unlike CJ/Printful's pasted API
key — needs the same refresh_token/oauth_state shape ChannelConnection
already has for Daraz's OAuth flow, but on this table since AliExpress is
a supplier (source products FROM), not a sales channel.

Revision ID: a8e2f4c7b1d9
Revises: f1a7c3e9b5d2
Create Date: 2026-08-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a8e2f4c7b1d9'
down_revision: Union[str, None] = 'f1a7c3e9b5d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('dropship_connections', sa.Column('refresh_token', sa.Text(), nullable=True))
    op.add_column('dropship_connections', sa.Column('oauth_state', sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column('dropship_connections', 'oauth_state')
    op.drop_column('dropship_connections', 'refresh_token')
