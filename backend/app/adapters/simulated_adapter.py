import logging
from typing import Dict, Any, Optional
from app.adapters.base import BaseGatewayAdapter, BaseTrayAdapter
from app.simulator.tray_simulator import get_simulated_tray
from app.simulator.temp_simulator import get_simulated_shipment

logger = logging.getLogger("pharma.simulated_adapter")

class SimulatedGatewayAdapter(BaseGatewayAdapter):
    """
    Adapter implementing telemetry ingestion from simulated IoT thermal sensors.
    """

    def __init__(self, shipment_code: str = "SHP-2026-001"):
        self.shipment_code = shipment_code

    def read_telemetry(self, device_mac: str) -> Optional[Dict[str, Any]]:
        sim = get_simulated_shipment(self.shipment_code)
        # Check tray state to compute physics
        tray = get_simulated_tray("TRAY-UNIT-A1")
        reading = sim.step(tray_state=tray.state)
        reading["device_mac"] = device_mac
        return reading

    def is_online(self) -> bool:
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
