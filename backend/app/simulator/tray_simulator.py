import logging
from datetime import datetime
from typing import Dict, Any

logger = logging.getLogger("pharma.tray_simulator")

class SimulatedTray:
    """
    Simulates physical motorized tray hardware controlling cold-pack enclosure.
    States: EXTENDED (0%), MOVING_IN (1%-99%), PROTECTED (100%), MOVING_OUT (99%-1%), ERROR.
    """

    def __init__(self, tray_code: str, initial_state: str = "EXTENDED"):
        self.tray_code = tray_code
        self.state = initial_state
        self.position_percentage = 0.0 if initial_state == "EXTENDED" else 100.0
        self.target_position = self.position_percentage
        self.speed_pct_per_tick = 35.0 # Speed of actuator transition
        self.temp_cold_pack = 2.5 # Internal cold pack block temperature
        self.last_moved_at = datetime.utcnow()

    def command_move_in(self) -> str:
        """Command tray to retract payload into cold-pack compartment"""
        logger.info(f"Tray [{self.tray_code}]: Received Command MOVE_IN")
        if self.state == "PROTECTED":
            return "ALREADY_PROTECTED"
        self.state = "MOVING_IN"
        self.target_position = 100.0
        self.last_moved_at = datetime.utcnow()
        return "MOVING_IN"

    def command_move_out(self) -> str:
        """Command tray to extend payload outward"""
        logger.info(f"Tray [{self.tray_code}]: Received Command MOVE_OUT")
        if self.state == "EXTENDED":
            return "ALREADY_EXTENDED"
        self.state = "MOVING_OUT"
        self.target_position = 0.0
        self.last_moved_at = datetime.utcnow()
        return "MOVING_OUT"

    def tick(self) -> Dict[str, Any]:
        """Advance actuator physical simulation by one time-step"""
        previous_state = self.state

        if self.state == "MOVING_IN":
            self.position_percentage = min(100.0, self.position_percentage + self.speed_pct_per_tick)
            if self.position_percentage >= 100.0:
                self.position_percentage = 100.0
                self.state = "PROTECTED"
                logger.info(f"Tray [{self.tray_code}]: Fully reached PROTECTED position (100%)")

        elif self.state == "MOVING_OUT":
            self.position_percentage = max(0.0, self.position_percentage - self.speed_pct_per_tick)
            if self.position_percentage <= 0.0:
                self.position_percentage = 0.0
                self.state = "EXTENDED"
                logger.info(f"Tray [{self.tray_code}]: Fully reached EXTENDED position (0%)")

        return {
            "tray_code": self.tray_code,
            "state": self.state,
            "previous_state": previous_state,
            "position_percentage": round(self.position_percentage, 1),
            "state_changed": self.state != previous_state
        }

    def reset(self):
        self.state = "EXTENDED"
        self.position_percentage = 0.0
        self.target_position = 0.0
        self.last_moved_at = datetime.utcnow()

# Singleton registry of simulated trays
simulated_trays: Dict[str, SimulatedTray] = {
    "TRAY-UNIT-A1": SimulatedTray("TRAY-UNIT-A1", "EXTENDED")
}

def get_simulated_tray(tray_code: str) -> SimulatedTray:
    if tray_code not in simulated_trays:
        simulated_trays[tray_code] = SimulatedTray(tray_code, "EXTENDED")
    return simulated_trays[tray_code]
