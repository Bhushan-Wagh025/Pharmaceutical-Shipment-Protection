import sqlite3
import os

db_paths = [
    os.path.abspath("pharma_protection.db"),
    os.path.abspath("../pharma_protection.db")
]

gateway_columns = [
    ("host_url", "TEXT"),
    ("api_base_path", "TEXT DEFAULT '/api/v1'"),
    ("auth_method", "VARCHAR(50) DEFAULT 'NONE'"),
    ("api_key_encrypted", "TEXT"),
    ("polling_interval", "INTEGER DEFAULT 5"),
    ("timeout_seconds", "INTEGER DEFAULT 5"),
    ("is_enabled", "BOOLEAN DEFAULT 1"),
    ("verify_ssl", "BOOLEAN DEFAULT 1"),
    ("tls_certificate", "TEXT"),
    ("adapter_type", "VARCHAR(50) DEFAULT 'GAO_BLE'"),
    ("is_monitoring", "BOOLEAN DEFAULT 0"),
    ("last_error", "TEXT"),
    ("last_communication_at", "DATETIME"),
    ("last_reading_data", "TEXT"),
    ("updated_at", "DATETIME")
]

telemetry_columns = [
    ("gateway_id", "INTEGER"),
    ("data_source", "VARCHAR(50) DEFAULT 'SIMULATED'"),
    ("validation_status", "VARCHAR(50) DEFAULT 'VALID'"),
    ("server_timestamp", "DATETIME")
]

for db_path in db_paths:
    if not os.path.exists(db_path):
        continue
    print(f"Migrating database: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Check gateways columns
    cursor.execute("PRAGMA table_info(gateways)")
    existing_gw_cols = {row[1] for row in cursor.fetchall()}
    for col_name, col_type in gateway_columns:
        if col_name not in existing_gw_cols:
            print(f"  Adding {col_name} to gateways...")
            cursor.execute(f"ALTER TABLE gateways ADD COLUMN {col_name} {col_type}")

    # Check temperature_readings columns
    cursor.execute("PRAGMA table_info(temperature_readings)")
    existing_tel_cols = {row[1] for row in cursor.fetchall()}
    for col_name, col_type in telemetry_columns:
        if col_name not in existing_tel_cols:
            print(f"  Adding {col_name} to temperature_readings...")
            cursor.execute(f"ALTER TABLE temperature_readings ADD COLUMN {col_name} {col_type}")

    conn.commit()
    conn.close()
    print(f"Database {db_path} migration complete!")
