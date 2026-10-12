from abc import ABC, abstractmethod
from typing import Dict, Any, Optional

class BaseGatewayAdapter(ABC):
    """
    Abstract hardware gateway adapter interface for BLE environmental sensors.
    Decouples raw hardware protocols (GAO BLE Gateway, Teltonika, Simulated, etc.)
    from core pharma application business logic.
    """

    @abstractmethod
    def read_telemetry(self, device_mac: str) -> Optional[Dict[str, Any]]:
        """Returns dict: {'temperature': float, 'battery': float, 'humidity': float, 'rssi': int}"""
        pass

    @abstractmethod
    def is_online(self) -> bool:
        """Returns health status of the physical or simulated gateway"""
        pass

class BaseTrayAdapter(ABC):
    """
    Abstract motorized cold-compartment tray actuator adapter.
    """

    @abstractmethod
    def move_in(self, tray_code: str) -> bool:
        """Trigger stepper/servo motor to retract package into protected compartment"""
        pass

    @abstractmethod
    def move_out(self, tray_code: str) -> bool:
        """Trigger stepper/servo motor to extend package outwards"""
        pass

    @abstractmethod
    def get_status(self, tray_code: str) -> Dict[str, Any]:
        """Returns: {'state': str, 'position_percentage': float, 'error': Optional[str]}"""
        pass
