"""gateway_configuration_and_telemetry_upgrade

Revision ID: 7b92314a51e1
Revises: 5a674786c0c2
Create Date: 2026-10-12 18:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '7b92314a51e1'
down_revision: Union[str, Sequence[str], None] = '5a674786c0c2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 1. Extend gateways table
    with op.batch_alter_table('gateways') as batch_op:
        batch_op.add_column(sa.Column('host_url', sa.String(length=500), nullable=True))
        batch_op.add_column(sa.Column('api_base_path', sa.String(length=255), server_default='/api/v1', nullable=True))
        batch_op.add_column(sa.Column('auth_method', sa.String(length=50), server_default='NONE', nullable=True))
        batch_op.add_column(sa.Column('api_key_encrypted', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('polling_interval', sa.Integer(), server_default='5', nullable=True))
        batch_op.add_column(sa.Column('timeout_seconds', sa.Integer(), server_default='5', nullable=True))
        batch_op.add_column(sa.Column('is_enabled', sa.Boolean(), server_default='1', nullable=True))
        batch_op.add_column(sa.Column('verify_ssl', sa.Boolean(), server_default='1', nullable=True))
        batch_op.add_column(sa.Column('tls_certificate', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('adapter_type', sa.String(length=50), server_default='GAO_BLE', nullable=True))
        batch_op.add_column(sa.Column('is_monitoring', sa.Boolean(), server_default='0', nullable=True))
        batch_op.add_column(sa.Column('last_error', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('last_communication_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('last_reading_data', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('updated_at', sa.DateTime(), nullable=True))

    # 2. Extend temperature_readings table
    with op.batch_alter_table('temperature_readings') as batch_op:
        batch_op.add_column(sa.Column('gateway_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('data_source', sa.String(length=50), server_default='SIMULATED', nullable=True))
        batch_op.add_column(sa.Column('validation_status', sa.String(length=50), server_default='VALID', nullable=True))
        batch_op.add_column(sa.Column('server_timestamp', sa.DateTime(), nullable=True))

def downgrade() -> None:
    with op.batch_alter_table('temperature_readings') as batch_op:
        batch_op.drop_column('server_timestamp')
        batch_op.drop_column('validation_status')
        batch_op.drop_column('data_source')
        batch_op.drop_column('gateway_id')

    with op.batch_alter_table('gateways') as batch_op:
        batch_op.drop_column('updated_at')
        batch_op.drop_column('last_reading_data')
        batch_op.drop_column('last_communication_at')
        batch_op.drop_column('last_error')
        batch_op.drop_column('is_monitoring')
        batch_op.drop_column('adapter_type')
        batch_op.drop_column('tls_certificate')
        batch_op.drop_column('verify_ssl')
        batch_op.drop_column('is_enabled')
        batch_op.drop_column('timeout_seconds')
        batch_op.drop_column('polling_interval')
        batch_op.drop_column('api_key_encrypted')
        batch_op.drop_column('auth_method')
        batch_op.drop_column('api_base_path')
        batch_op.drop_column('host_url')
