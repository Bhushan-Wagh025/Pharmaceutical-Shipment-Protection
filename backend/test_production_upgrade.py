import sys
import uuid
import unittest
from fastapi.testclient import TestClient

from app.main import app
from app.services.ssrf_validator import validate_gateway_url
from app.services.encryption_service import encrypt_credential, decrypt_credential, mask_credential
from app.adapters.simulated_adapter import SimulatedGatewayAdapter
from app.adapters.gao_adapter import GAOBLEGatewayAdapter
from app.models.logistics import Gateway
from app.models.telemetry import TemperatureReading
from app.schemas.telemetry import TemperatureReadingCreate
from app.services.decision_engine import evaluate_protection_decision

client = TestClient(app)

class TestProductionUpgrade(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Authenticate as company admin
        login_res = client.post("/api/v1/auth/login", json={
            "email": "admin@pharmaprotect.com",
            "password": "Admin123!"
        })
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        data = login_res.json()
        cls.token = data["access_token"]
        cls.headers = {"Authorization": f"Bearer {cls.token}"}
        cls.company_id = data["user"]["company_id"]

    # --------------------------------------------------------------------------
    # 1. Health & Readiness
    # --------------------------------------------------------------------------
    def test_01_health_and_readiness_endpoints(self):
        res_health = client.get("/health")
        self.assertEqual(res_health.status_code, 200)
        self.assertEqual(res_health.json()["status"], "healthy")

        res_ready = client.get("/ready")
        self.assertEqual(res_ready.status_code, 200)
        self.assertTrue(res_ready.json()["database_connected"])

    # --------------------------------------------------------------------------
    # 2. SSRF URL Validator
    # --------------------------------------------------------------------------
    def test_02_ssrf_validator_blocks_malicious_urls(self):
        # Loopback must be rejected
        ok, err = validate_gateway_url("http://127.0.0.1:8080/api")
        self.assertFalse(ok)
        self.assertIn("loopback", err.lower())

        ok, err = validate_gateway_url("http://localhost:8000")
        self.assertFalse(ok)
        self.assertIn("forbidden", err.lower())

        # AWS/Cloud metadata endpoint must be rejected unconditionally
        ok, err = validate_gateway_url("http://169.254.169.254/latest/meta-data")
        self.assertFalse(ok)
        self.assertTrue("metadata" in err.lower() or "forbidden" in err.lower())

        # Invalid schemes must be rejected
        ok, err = validate_gateway_url("ftp://192.168.1.100/data")
        self.assertFalse(ok)
        self.assertIn("scheme", err.lower())

        # Local private network IP allowed when policy is true
        ok, _ = validate_gateway_url("http://192.168.1.100:8080/api", allow_private_override=True)
        self.assertTrue(ok)

    # --------------------------------------------------------------------------
    # 3. Credential Encryption & Masking
    # --------------------------------------------------------------------------
    def test_03_credential_encryption_and_masking(self):
        secret = "secret-ble-gateway-token-xyz-987"
        encrypted = encrypt_credential(secret)
        self.assertNotEqual(secret, encrypted)

        decrypted = decrypt_credential(encrypted)
        self.assertEqual(secret, decrypted)

        masked = mask_credential(secret)
        self.assertTrue("•" in masked)
        self.assertTrue(masked.endswith("987"))
        self.assertNotIn("token-xyz", masked)

    # --------------------------------------------------------------------------
    # 4. Gateway Configuration CRUD & Masking
    # --------------------------------------------------------------------------
    def test_04_gateway_crud_api(self):
        # Create gateway
        unique_eui = f"GAO-GW-TEST-{uuid.uuid4().hex[:6].upper()}"
        payload = {
            "name": "Warehouse B GAO BLE Gateway",
            "gateway_identifier": unique_eui,
            "host_url": "http://192.168.1.100:8080",
            "api_base_path": "/api/v1/telemetry",
            "adapter_type": "simulated",
            "auth_method": "API_KEY",
            "api_key": "my-super-secret-key-456789",
            "polling_interval": 10,
            "timeout_seconds": 5,
            "is_enabled": True
        }
        create_res = client.post("/api/v1/gateways", json=payload, headers=self.headers)
        self.assertEqual(create_res.status_code, 200, create_res.text)
        created_gw = create_res.json()
        gw_id = created_gw["id"]
        TestProductionUpgrade.created_gw_id = gw_id

        # Ensure credentials are masked on return
        self.assertTrue("•" in created_gw["api_key"])
        self.assertNotIn("456789", created_gw["api_key"][:-4])

        # Get gateway detail
        get_res = client.get(f"/api/v1/gateways/{gw_id}", headers=self.headers)
        self.assertEqual(get_res.status_code, 200)
        self.assertEqual(get_res.json()["name"], "Warehouse B GAO BLE Gateway")

        # Update gateway
        update_payload = {
            "name": "Warehouse B GAO BLE Gateway (Updated)",
            "polling_interval": 15
        }
        put_res = client.put(f"/api/v1/gateways/{gw_id}", json=update_payload, headers=self.headers)
        self.assertEqual(put_res.status_code, 200)
        self.assertEqual(put_res.json()["name"], "Warehouse B GAO BLE Gateway (Updated)")
        self.assertEqual(put_res.json()["polling_interval"], 15)

    # --------------------------------------------------------------------------
    # 5. Gateway Test Connection & Discovery
    # --------------------------------------------------------------------------
    def test_05_gateway_test_connection_and_discovery(self):
        gw_id = getattr(self, "created_gw_id", 2)
        test_res = client.post(f"/api/v1/gateways/{gw_id}/test-connection", headers=self.headers)
        self.assertEqual(test_res.status_code, 200)
        test_data = test_res.json()
        self.assertTrue(test_data["connected"])
        self.assertIn("latency_ms", test_data)

        # Discover devices
        disc_res = client.post(f"/api/v1/gateways/{gw_id}/discover-devices", headers=self.headers)
        self.assertEqual(disc_res.status_code, 200)
        disc_data = disc_res.json()
        self.assertTrue(disc_data["success"])
        self.assertGreater(len(disc_data["devices"]), 0)
        device = disc_data["devices"][0]
        self.assertTrue("device_mac" in device or "device_id" in device)
        self.assertIn("temperature", device)

        # Verify safe offline detection on unreached real hardware gateway (Gateway #1)
        offline_res = client.post("/api/v1/gateways/1/test-connection", headers=self.headers)
        self.assertEqual(offline_res.status_code, 200)
        self.assertFalse(offline_res.json()["connected"])
        self.assertIn("troubleshooting", offline_res.json())

    # --------------------------------------------------------------------------
    # 6. Gateway Start & Stop Monitoring
    # --------------------------------------------------------------------------
    def test_06_gateway_monitoring_controls(self):
        gw_id = getattr(self, "created_gw_id", 1)
        start_res = client.post(f"/api/v1/gateways/{gw_id}/start-monitoring", headers=self.headers)
        self.assertEqual(start_res.status_code, 200)
        self.assertTrue(start_res.json()["is_monitoring"])

        status_res = client.get(f"/api/v1/gateways/{gw_id}/status", headers=self.headers)
        self.assertEqual(status_res.status_code, 200)
        self.assertTrue(status_res.json()["is_monitoring"])

        stop_res = client.post(f"/api/v1/gateways/{gw_id}/stop-monitoring", headers=self.headers)
        self.assertEqual(stop_res.status_code, 200)
        self.assertFalse(stop_res.json()["is_monitoring"])

    # --------------------------------------------------------------------------
    # 7. Telemetry Ingestion Pipeline & Validation
    # --------------------------------------------------------------------------
    def test_07_telemetry_pipeline_validation(self):
        # 1. Normal reading
        payload = {
            "shipment_id": 1,
            "device_id": "TEST-BEACON-01",
            "temperature": 5.4,
            "humidity": 45.2,
            "battery_level": 95,
            "rssi": -62,
            "data_source": "LIVE"
        }
        ingest_res = client.post("/api/v1/temperature/readings", json=payload, headers=self.headers)
        self.assertEqual(ingest_res.status_code, 200)
        data = ingest_res.json()
        self.assertEqual(data["temperature"], 5.4)
        self.assertEqual(data["data_source"], "LIVE")
        self.assertEqual(data["validation_status"], "VALID")
        fc_res = client.get("/api/v1/forecast/1/latest", headers=self.headers)
        self.assertEqual(fc_res.status_code, 200)

        # 2. Out of range reading rejection (-60°C is out of pharmaceutical bounds)
        bad_payload = {
            "shipment_id": 1,
            "device_id": "TEST-BEACON-01",
            "temperature": -60.0,
            "data_source": "LIVE"
        }
        bad_res = client.post("/api/v1/temperature/readings", json=bad_payload, headers=self.headers)
        self.assertEqual(bad_res.status_code, 400)
        self.assertIn("valid range", bad_res.json()["detail"])

    # --------------------------------------------------------------------------
    # 8. AI Decision Engine & Stale Telemetry Protection
    # --------------------------------------------------------------------------
    def test_08_decision_engine_stale_safety(self):
        # Normal fresh telemetry
        decision_normal = evaluate_protection_decision(
            current_temp=5.2,
            predicted_temp=5.8,
            temp_limit=8.0,
            current_tray_state="EXTENDED",
            is_stale=False
        )
        self.assertEqual(decision_normal["decision"], "NO_ACTION")

        # Excursion imminent with fresh telemetry -> triggers protection
        decision_excursion = evaluate_protection_decision(
            current_temp=7.8,
            predicted_temp=8.4,
            temp_limit=8.0,
            current_tray_state="EXTENDED",
            is_stale=False
        )
        self.assertEqual(decision_excursion["decision"], "TRIGGER_PROTECTION")

        # Stale telemetry (> 5 mins) -> MUST suspend actuation for safety!
        decision_stale = evaluate_protection_decision(
            current_temp=7.8,
            predicted_temp=8.4,
            temp_limit=8.0,
            current_tray_state="EXTENDED",
            is_stale=True
        )
        self.assertEqual(decision_stale["decision"], "SUSPENDED_STALE_TELEMETRY")
        self.assertIn("Stale telemetry", decision_stale["reason"])

    # --------------------------------------------------------------------------
    # 9. Physical Tray Safety Controls & Interlocks
    # --------------------------------------------------------------------------
    def test_09_tray_emergency_stop_and_override(self):
        tray_id = 1

        # Emergency stop
        estop_res = client.post(f"/api/v1/trays/{tray_id}/emergency-stop", headers=self.headers)
        self.assertEqual(estop_res.status_code, 200)
        self.assertEqual(estop_res.json()["state"], "ERROR")

        # Manual operator override
        override_res = client.post(
            f"/api/v1/trays/{tray_id}/override",
            json={"target_percentage": 100, "reason": "Operator maintenance override"},
            headers=self.headers
        )
        self.assertEqual(override_res.status_code, 200)
        self.assertEqual(override_res.json()["position_percentage"], 100)
        self.assertEqual(override_res.json()["state"], "PROTECTED")

        # Duplicate command protection: tray is already at 100% (PROTECTED), move-in should reject
        dup_res = client.post(f"/api/v1/trays/{tray_id}/move-in", headers=self.headers)
        self.assertEqual(dup_res.status_code, 400)
        self.assertIn("already", dup_res.json()["detail"].lower())

    # --------------------------------------------------------------------------
    # 10. Audit Logging
    # --------------------------------------------------------------------------
    def test_10_audit_trail_logging(self):
        audit_res = client.get("/api/v1/audit", headers=self.headers)
        self.assertEqual(audit_res.status_code, 200)
        logs = audit_res.json()
        self.assertGreater(len(logs), 0)
        actions = [log["action"] for log in logs]
        self.assertTrue(any("GATEWAY" in a or "TRAY" in a for a in actions))

if __name__ == "__main__":
    unittest.main()
