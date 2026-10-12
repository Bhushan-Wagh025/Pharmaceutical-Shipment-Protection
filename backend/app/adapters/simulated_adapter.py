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
    the software-simulated IoT thermal environment.
    """

    def __init__(self, shipment_code: str = "SHP-2026-001", gateway_eui: str = "GW-COLD-8842-A1"):
        self.shipment_code = shipment_code
        self.gateway_eui = gateway_eui
        self._is_connected = True
        self._last_comm = datetime.utcnow()

    def connect(self) -> bool:
        self._is_connected = True
        self._last_comm = datetime.utcnow()
        logger.info(f"Simulated Gateway [{self.gateway_eui}] connected.")
        return True

    def test_connection(self) -> Dict[str, Any]:
        self._last_comm = datetime.utcnow()
        return {
            "success": True,
            "latency_ms": 8.4,
            "details": "Simulated BLE Gateway loopback healthy. Virtual BLE radio stack responsive.",
            "error": None,
            "troubleshooting": None
        }

    def discover_devices(self) -> List[Dict[str, Any]]:
        self._last_comm = datetime.utcnow()
        sim = get_simulated_shipment(self.shipment_code)
        current_temp = round(sim.current_temp, 2)
        return [
            {
                "device_mac": "CC:50:E3:88:42:01",
                "name": "BLE ColdTag Ultra #8021 (Primary)",
                "temperature": current_temp,
                "battery": 98.5,
                "rssi": -58,
                "last_seen": datetime.utcnow().isoformat()
            },
            {
                "device_mac": "F4:B8:5E:21:99:A4",
                "name": "KKM K6 Thermal Beacon #02 (Secondary)",
                "temperature": round(current_temp + 0.3, 2),
                "battery": 94.0,
                "rssi": -69,
                "last_seen": datetime.utcnow().isoformat()
            }
        ]

    def fetch_telemetry(self) -> List[Dict[str, Any]]:
        if not self._is_connected:
            return []
        self._last_comm = datetime.utcnow()
        sim = get_simulated_shipment(self.shipment_code)
        tray = get_simulated_tray("TRAY-UNIT-A1")
        reading = sim.step(tray_state=tray.state)
        reading["device_mac"] = "CC:50:E3:88:42:01"
        reading["data_source"] = "SIMULATED"
        reading["gateway_eui"] = self.gateway_eui
        return [reading]

    def get_status(self) -> Dict[str, Any]:
        return {
            "connected": self._is_connected,
            "status": "CONNECTED" if self._is_connected else "DISCONNECTED",
            "last_communication": self._last_comm.isoformat() if self._last_comm else None,
            "active_devices_count": 2,
            "error": None,
            "troubleshooting": None
        }

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
