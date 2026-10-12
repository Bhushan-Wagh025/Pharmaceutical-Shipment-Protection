import random
import logging
from datetime import datetime
from typing import Dict, Any, Optional

logger = logging.getLogger("pharma.temp_simulator")

class ShipmentThermalSimulator:
    """
    Simulates thermal physics for pharmaceutical cold chain payload.
    Supports ambient thermal breach, rising curve, cooling in cold-pack chamber,
    and demo excursion scenarios.
    """

    def __init__(
        self,
        shipment_code: str,
        initial_temp: float = 5.5,
        ambient_temp: float = 23.5,
        cold_pack_temp: float = 2.8,
        temp_limit: float = 8.0
    ):
        self.shipment_code = shipment_code
        self.initial_temp = initial_temp
        self.current_temp = initial_temp
        self.ambient_temp = ambient_temp
        self.cold_pack_temp = cold_pack_temp
        self.temp_limit = temp_limit
        self.battery_level = 98.5
        self.humidity = 42.0
        
        # State modes: 'SAFE', 'WARMING', 'EXCURSION', 'COOLING'
        self.mode = "WARMING"
        self.step_count = 0
        self.is_auto_running = False

    def step(self, tray_state: str, force_excursion: bool = False) -> Dict[str, Any]:
        """
        Calculates one telemetry step based on physical tray state and thermal environment.
        """
        self.step_count += 1
        jitter = random.uniform(-0.03, 0.04) # Realistic sensor jitter

        # Slight battery discharge
        self.battery_level = max(10.0, self.battery_level - random.uniform(0.001, 0.005))
        self.humidity = round(float(np_clip(self.humidity + random.uniform(-0.2, 0.2), 35.0, 60.0)), 1)

        # Thermal behavior governed by tray state
        if tray_state in ["PROTECTED", "MOVING_IN"]:
            # Inside cold compartment: strong cooling Newton law towards cold_pack_temp (2.8°C)
            self.mode = "COOLING"
            cooling_rate = 0.28 if tray_state == "PROTECTED" else 0.10
            delta = (self.cold_pack_temp - self.current_temp) * cooling_rate + jitter
            # Bound cooling to not freeze below 2.5°C
            self.current_temp = max(2.8, self.current_temp + delta)

        elif force_excursion or self.mode == "EXCURSION":
            # Accelerated warming excursion: e.g. ambient exposure breach
            self.mode = "EXCURSION"
            warming_rate = 0.22 + jitter
            self.current_temp = min(22.0, self.current_temp + warming_rate)

        else:
            # Normal exposed warming rate: slowly increases towards ambient
            self.mode = "WARMING"
            warming_delta = 0.12 + jitter
            self.current_temp = min(self.ambient_temp, self.current_temp + warming_delta)

        self.current_temp = round(self.current_temp, 2)

        return {
            "shipment_code": self.shipment_code,
            "temperature": self.current_temp,
            "battery": round(self.battery_level, 1),
            "humidity": self.humidity,
            "signal_rssi": random.randint(-68, -60),
            "mode": self.mode,
            "step_count": self.step_count,
            "timestamp": datetime.utcnow()
        }

    def trigger_excursion(self):
        """Forces an accelerated temperature excursion"""
        self.mode = "EXCURSION"
        logger.info(f"Simulator [{self.shipment_code}]: Excursion mode activated! Warming will accelerate.")

    def reset(self, initial_temp: Optional[float] = None):
        """Resets the simulator state back to clean baseline safe temperature"""
        if initial_temp is not None:
            self.initial_temp = initial_temp
        self.current_temp = self.initial_temp
        self.battery_level = 98.5
        self.humidity = 42.0
        self.mode = "WARMING"
        self.step_count = 0
        logger.info(f"Simulator [{self.shipment_code}]: Reset to baseline temperature {self.current_temp}°C")

def np_clip(val, min_v, max_v):
    return max(min_v, min(val, max_v))

# Singleton registry of simulated shipments
simulated_shipments: Dict[str, ShipmentThermalSimulator] = {
    "SHP-2026-001": ShipmentThermalSimulator("SHP-2026-001", initial_temp=5.5, temp_limit=8.0)
}

def get_simulated_shipment(shipment_code: str) -> ShipmentThermalSimulator:
    if shipment_code not in simulated_shipments:
        simulated_shipments[shipment_code] = ShipmentThermalSimulator(shipment_code, initial_temp=5.5)
    return simulated_shipments[shipment_code]
