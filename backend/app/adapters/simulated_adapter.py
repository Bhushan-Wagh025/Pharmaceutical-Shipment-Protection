import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
from app.adapters.base import BaseGatewayAdapter, BaseTrayAdapter
from app.simulator.tray_simulator import get_simulated_tray
from app.simulator.temp_simulator import get_simulated_shipment

logger = logging.getLogger("pharma.simulated_adapter")

class SimulatedGatewayAdapter(BaseGatewayAdapter):
    """
    Adapter implementing telemetry ingestion and device discovery from
    the live Aperture BLE Gateway API (https://gateway.apertureventurestudio.com).
    """

    def __init__(self, shipment_code: str = "SHIP-BC5729206C16", gateway_eui: str = "GW-304A2657BF44"):
        self.shipment_code = shipment_code
        self.gateway_eui = gateway_eui
        self._is_connected = True
        self._last_comm = datetime.utcnow()
        from app.adapters.gao_adapter import GAOBLEGatewayAdapter
        self._live_adapter = GAOBLEGatewayAdapter(
            host_url="https://gateway.apertureventurestudio.com",
            api_base_path="/api/v1/gateway/ble",
            gateway_eui=gateway_eui
        )

    def connect(self) -> bool:
        self._last_comm = datetime.utcnow()
        res = self._live_adapter.test_connection()
        self._is_connected = res.get("success", False)
        return self._is_connected

    def test_connection(self) -> Dict[str, Any]:
        self._last_comm = datetime.utcnow()
        return self._live_adapter.test_connection()

    def discover_devices(self) -> List[Dict[str, Any]]:
        self._last_comm = datetime.utcnow()
        return self._live_adapter.discover_devices()

    def fetch_telemetry(self) -> List[Dict[str, Any]]:
        self._last_comm = datetime.utcnow()
        return self._live_adapter.fetch_telemetry()

    def get_status(self) -> Dict[str, Any]:
        return self._live_adapter.get_status()

    def disconnect(self) -> bool:
        self._is_connected = False
        logger.info(f"Simulated Gateway [{self.gateway_eui}] disconnected.")
        return True


class SimulatedTrayAdapter(BaseTrayAdapter):
    """
    Adapter implementing motorized tray control on the software simulation unit.
    """

    def move_in(self, tray_code: str) -> bool:
        tray = get_simulated_tray(tray_code)
        tray.command_move_in()
        return True

    def move_out(self, tray_code: str) -> bool:
        tray = get_simulated_tray(tray_code)
        tray.command_move_out()
        return True

    def emergency_stop(self, tray_code: str) -> bool:
        tray = get_simulated_tray(tray_code)
        # Freeze motor motion immediately
        tray.is_moving = False
        logger.warning(f"Simulated Tray [{tray_code}]: EMERGENCY STOP ACTIVATED.")
        return True

    def manual_override(self, tray_code: str, target_percentage: float) -> bool:
        tray = get_simulated_tray(tray_code)
        tray.position_percentage = max(0.0, min(100.0, float(target_percentage)))
        if tray.position_percentage >= 95.0:
            tray.state = "PROTECTED"
        elif tray.position_percentage <= 5.0:
            tray.state = "EXTENDED"
        else:
            tray.state = "MOVING_IN" if target_percentage > 50 else "MOVING_OUT"
        return True

    def get_status(self, tray_code: str) -> Dict[str, Any]:
        tray = get_simulated_tray(tray_code)
        # Advance motion tick
        tray.tick()
        return {
            "tray_code": tray.tray_code,
            "state": tray.state,
            "position_percentage": tray.position_percentage,
            "error": None
        }
