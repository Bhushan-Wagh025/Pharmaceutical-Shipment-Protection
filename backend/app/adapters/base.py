from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional

class BaseGatewayAdapter(ABC):
    """
    Modular hardware gateway adapter interface for BLE environmental sensors.
    Decouples raw hardware protocols (GAO BLE Gateway, Teltonika, Simulated, etc.)
    from core pharma application business logic.
    """

    @abstractmethod
    def connect(self) -> bool:
        """Establishes session or handshake with gateway."""
        pass

    @abstractmethod
    def test_connection(self) -> Dict[str, Any]:
        """
        Tests reachability, authentication, and API response.
        Returns:
            {
                "success": bool,
                "latency_ms": float,
                "details": str,
                "error": Optional[str],
                "troubleshooting": Optional[str]
            }
        """
        pass

    @abstractmethod
    def discover_devices(self) -> List[Dict[str, Any]]:
        """
        Scans or queries gateway for active BLE temperature beacons in range.
        Returns:
            [
                {
                    "device_mac": str,
                    "name": str,
                    "temperature": Optional[float],
                    "battery": Optional[float],
                    "rssi": Optional[int],
                    "last_seen": Optional[str]
                }
            ]
        """
        pass

    @abstractmethod
    def fetch_telemetry(self) -> List[Dict[str, Any]]:
        """
        Polls or retrieves latest telemetry batch from gateway.
        Returns list of normalized sensor reading dicts.
        """
        pass

    @abstractmethod
    def get_status(self) -> Dict[str, Any]:
        """
        Returns gateway operational state, connection health, and diagnostics.
        Returns:
            {
                "connected": bool,
                "status": str, # "CONNECTED", "DISCONNECTED", "ERROR"
                "last_communication": Optional[str],
                "active_devices_count": int,
                "error": Optional[str],
                "troubleshooting": Optional[str]
            }
        """
        pass

    @abstractmethod
    def disconnect(self) -> bool:
        """Terminates session or polling loop."""
        pass

    # Backward-compatible helpers
    def read_telemetry(self, device_mac: str) -> Optional[Dict[str, Any]]:
        readings = self.fetch_telemetry()
        for r in readings:
            if r.get("device_mac") == device_mac:
                return r
        return None

    def is_online(self) -> bool:
        status = self.get_status()
        return status.get("connected", False)


class BaseTrayAdapter(ABC):
    """
    Abstract motorized cold-compartment tray actuator adapter.
    """

    @abstractmethod
    def move_in(self, tray_code: str) -> bool:
        """Trigger stepper/servo motor to retract package into protected compartment."""
        pass

    @abstractmethod
    def move_out(self, tray_code: str) -> bool:
        """Trigger stepper/servo motor to extend package outwards."""
        pass

    @abstractmethod
    def emergency_stop(self, tray_code: str) -> bool:
        """Instantly cuts power to motor coils to halt motion safely."""
        pass

    @abstractmethod
    def manual_override(self, tray_code: str, target_percentage: float) -> bool:
        """Allows authorized operator manual positioning."""
        pass

    @abstractmethod
    def get_status(self, tray_code: str) -> Dict[str, Any]:
        """Returns: {'state': str, 'position_percentage': float, 'error': Optional[str]}"""
        pass
