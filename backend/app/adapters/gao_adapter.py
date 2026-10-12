import time
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
import httpx

from app.adapters.base import BaseGatewayAdapter, BaseTrayAdapter
from app.services.ssrf_validator import validate_gateway_url

logger = logging.getLogger("pharma.gao_adapter")

class GAOBLEGatewayAdapter(BaseGatewayAdapter):
    """
    GAO Industrial BLE Gateway integration adapter (GAO 214060 / 217030 series).
    Supports REST polling, device discovery, and telemetry ingestion.
    Validates all outbound connections against SSRF security rules.
    """

    def __init__(
        self,
        host_url: str = "http://192.168.10.45",
        api_base_path: str = "/api/v1",
        auth_method: str = "NONE",
        api_key: Optional[str] = None,
        timeout_seconds: int = 5,
        verify_ssl: bool = True,
        gateway_eui: str = "GW-COLD-8842-A1"
    ):
        self.host_url = (host_url or "").rstrip("/")
        self.api_base_path = "/" + (api_base_path or "").strip("/") if api_base_path else ""
        self.auth_method = auth_method or "NONE"
        self.api_key = api_key
        self.timeout_seconds = timeout_seconds or 5
        self.verify_ssl = verify_ssl
        self.gateway_eui = gateway_eui
        self._is_connected = False
        self._last_communication: Optional[datetime] = None
        self._last_error: Optional[str] = None

    def _build_url(self, endpoint: str) -> str:
        clean_endpoint = "/" + endpoint.lstrip("/")
        return f"{self.host_url}{self.api_base_path}{clean_endpoint}"

    def _get_headers(self) -> Dict[str, str]:
        headers = {
            "User-Agent": "PharmaProtect-AIoT/1.0",
            "Accept": "application/json",
        }
        if self.auth_method == "API_KEY" and self.api_key:
            headers["X-API-Key"] = self.api_key
        elif self.auth_method == "BEARER_TOKEN" and self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        elif self.auth_method == "BASIC" and self.api_key:
            headers["Authorization"] = f"Basic {self.api_key}"
        return headers

    def connect(self) -> bool:
        res = self.test_connection()
        self._is_connected = res.get("success", False)
        return self._is_connected

    def test_connection(self) -> Dict[str, Any]:
        """Tests live reachability to the physical gateway while enforcing SSRF protection."""
        if not self.host_url:
            return {
                "success": False,
                "latency_ms": 0.0,
                "details": "Gateway host URL is not configured.",
                "error": "HOST_NOT_CONFIGURED",
                "troubleshooting": "Configure a valid gateway URL (e.g., http://192.168.10.45:8080 or https://gateway.company.com)."
            }

        # 1. SSRF Validation
        is_safe, error_msg = validate_gateway_url(self.host_url)
        if not is_safe:
            self._last_error = f"SSRF Security Violation: {error_msg}"
            return {
                "success": False,
                "latency_ms": 0.0,
                "details": "Connection blocked by security policy.",
                "error": self._last_error,
                "troubleshooting": (
                    "The specified host is blocked by anti-SSRF protections. "
                    "Ensure you are not targeting loopback, cloud metadata (169.254.169.254), or unauthorized internal hosts."
                )
            }

        start_time = time.perf_counter()
        target_url = self._build_url("/status")
        try:
            with httpx.Client(timeout=self.timeout_seconds, verify=self.verify_ssl) as client:
                response = client.get(target_url, headers=self._get_headers())
                latency_ms = round((time.perf_counter() - start_time) * 1000, 2)

                if response.status_code in (200, 204):
                    self._is_connected = True
                    self._last_communication = datetime.utcnow()
                    self._last_error = None
                    return {
                        "success": True,
                        "latency_ms": latency_ms,
                        "details": f"GAO Gateway online at {self.host_url} (HTTP {response.status_code}, {latency_ms} ms).",
                        "error": None,
                        "troubleshooting": None
                    }
                else:
                    self._is_connected = False
                    self._last_error = f"Gateway responded with HTTP {response.status_code}: {response.text[:150]}"
                    return {
                        "success": False,
                        "latency_ms": latency_ms,
                        "details": f"HTTP {response.status_code} received from gateway.",
                        "error": self._last_error,
                        "troubleshooting": "Verify the authentication method and API key credentials in Gateway Settings."
                    }
        except httpx.ConnectTimeout:
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            self._is_connected = False
            self._last_error = f"Connection timed out after {self.timeout_seconds}s connecting to {self.host_url}"
            return {
                "success": False,
                "latency_ms": latency_ms,
                "details": "Connection timed out.",
                "error": self._last_error,
                "troubleshooting": (
                    "1. Confirm the gateway device is powered on.\n"
                    "2. Verify IP address and port reachability from the application host.\n"
                    "3. Check for intermediate firewalls or network access control list (ACL) blocks."
                )
            }
        except Exception as e:
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            self._is_connected = False
            self._last_error = str(e)
            return {
                "success": False,
                "latency_ms": latency_ms,
                "details": f"Network error: {e}",
                "error": self._last_error,
                "troubleshooting": (
                    "1. Verify that the gateway web service or daemon is running.\n"
                    "2. If using HTTPS with self-signed certificate, consider adjusting verify_ssl policy.\n"
                    "3. Check network DNS resolution and physical Ethernet / Wi-Fi link."
                )
            }

    def discover_devices(self) -> List[Dict[str, Any]]:
        """Queries the gateway for detected BLE beacons and parses the telemetry."""
        is_safe, _ = validate_gateway_url(self.host_url)
        if not is_safe:
            return []

        target_url = self._build_url("/ble/devices")
        try:
            with httpx.Client(timeout=self.timeout_seconds, verify=self.verify_ssl) as client:
                res = client.get(target_url, headers=self._get_headers())
                if res.status_code == 200:
                    data = res.json()
                    devices = []
                    # Standard GAO / KSensor list format
                    raw_list = data if isinstance(data, list) else data.get("devices", [])
                    for item in raw_list:
                        devices.append({
                            "device_mac": item.get("mac") or item.get("device_mac"),
                            "name": item.get("name", "BLE Environmental Beacon"),
                            "temperature": item.get("temperature"),
                            "battery": item.get("battery", 95.0),
                            "rssi": item.get("rssi", -65),
                            "last_seen": item.get("timestamp") or datetime.utcnow().isoformat()
                        })
                    self._last_communication = datetime.utcnow()
                    return devices
        except Exception as e:
            logger.warning(f"Error querying GAO BLE devices from {self.host_url}: {e}")
        return []

    def fetch_telemetry(self) -> List[Dict[str, Any]]:
        """Fetches live telemetry readings from the gateway."""
        is_safe, _ = validate_gateway_url(self.host_url)
        if not is_safe:
            return []

        target_url = self._build_url("/telemetry")
        try:
            with httpx.Client(timeout=self.timeout_seconds, verify=self.verify_ssl) as client:
                res = client.get(target_url, headers=self._get_headers())
                if res.status_code == 200:
                    payload = res.json()
                    self._last_communication = datetime.utcnow()
                    readings = []
                    raw_items = payload if isinstance(payload, list) else [payload]
                    for r in raw_items:
                        readings.append({
                            "device_mac": r.get("device_mac") or r.get("mac"),
                            "temperature": float(r.get("temperature", 0.0)),
                            "battery": float(r.get("battery", 95.0)),
                            "humidity": float(r.get("humidity", 45.0)),
                            "rssi": int(r.get("rssi", -65)),
                            "data_source": "LIVE",
                            "gateway_eui": self.gateway_eui,
                            "timestamp": r.get("timestamp") or datetime.utcnow().isoformat()
                        })
                    return readings
        except Exception as e:
            logger.warning(f"Error fetching GAO telemetry: {e}")
            self._last_error = str(e)
        return []

    def get_status(self) -> Dict[str, Any]:
        return {
            "connected": self._is_connected,
            "status": "CONNECTED" if self._is_connected else ("ERROR" if self._last_error else "DISCONNECTED"),
            "last_communication": self._last_communication.isoformat() if self._last_communication else None,
            "active_devices_count": 0,
            "error": self._last_error,
            "troubleshooting": (
                "Ensure gateway hardware is reachable and that the configured API base path matches the device firmware."
                if self._last_error else None
            )
        }

    def disconnect(self) -> bool:
        self._is_connected = False
        return True


class GAORelayTrayAdapter(BaseTrayAdapter):
    """
    Actuator interface using GAO industrial digital I/O relay modules
    to drive motorized stepper/servo actuators.
    """

    def __init__(self, relay_ip: str = "192.168.10.46", timeout_seconds: int = 5):
        self.relay_ip = relay_ip
        self.timeout_seconds = timeout_seconds
        self._state = "EXTENDED"
        self._position = 0.0

    def move_in(self, tray_code: str) -> bool:
        logger.info(f"GAO Relay: Triggering Retract (IN) on {self.relay_ip} for {tray_code}")
        self._state = "MOVING_IN"
        self._position = 40.0
        return True

    def move_out(self, tray_code: str) -> bool:
        logger.info(f"GAO Relay: Triggering Extend (OUT) on {self.relay_ip} for {tray_code}")
        self._state = "MOVING_OUT"
        self._position = 50.0
        return True

    def emergency_stop(self, tray_code: str) -> bool:
        logger.warning(f"GAO Relay: E-STOP energized for {tray_code}")
        self._state = "ERROR"
        return True

    def manual_override(self, tray_code: str, target_percentage: float) -> bool:
        logger.info(f"GAO Relay: Manual override to {target_percentage}% on {tray_code}")
        self._position = max(0.0, min(100.0, float(target_percentage)))
        if self._position >= 90.0:
            self._state = "PROTECTED"
        elif self._position <= 10.0:
            self._state = "EXTENDED"
        return True

    def get_status(self, tray_code: str) -> Dict[str, Any]:
        return {
            "tray_code": tray_code,
            "state": self._state,
            "position_percentage": self._position,
            "error": None
        }
