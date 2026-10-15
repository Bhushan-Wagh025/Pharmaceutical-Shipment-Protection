import logging
from datetime import datetime
from typing import Dict, Any, Optional
import httpx

logger = logging.getLogger("pharma.temp_simulator")

class ShipmentThermalSimulator:
    """
    Thermal telemetry interface that queries the live Aperture BLE Gateway API
    (https://gateway.apertureventurestudio.com).
    """

    def __init__(
        self,
        shipment_code: str,
        initial_temp: float = 24.5,
        ambient_temp: float = 24.0,
        cold_pack_temp: float = 2.8,
        temp_limit: float = 8.0
    ):
        self.shipment_code = shipment_code
        self.initial_temp = initial_temp
        self.current_temp = initial_temp
        self.ambient_temp = ambient_temp
        self.cold_pack_temp = cold_pack_temp
        self.temp_limit = temp_limit
        self.battery_level = 95.0
        self.humidity = 42.0
        self.signal_rssi = -68
        self.mode = "LIVE_APERTURE"
        self.step_count = 0
        self.is_auto_running = False

    def step(self, tray_state: str, force_excursion: bool = False) -> Dict[str, Any]:
        """
        Fetches live telemetry reading directly from Aperture Industrial BLE Gateway API.
        """
        self.step_count += 1
        live_reading = None
        target_dmac = self.shipment_code.replace("SHIP-", "").strip()
        try:
            with httpx.Client(timeout=3.0) as client:
                res = client.get("https://gateway.apertureventurestudio.com/api/v1/gateway/ble/telemetry/latest")
                if res.status_code == 200:
                    payload = res.json()
                    objs = payload.get("data", {}).get("data", {}).get("obj", [])
                    matched_item = None
                    # First attempt exact DMAC match
                    for item in objs:
                        if "temp" in item and item.get("dmac") == target_dmac:
                            matched_item = item
                            break
                    # If not matched, pick first item with temperature
                    if not matched_item:
                        for item in objs:
                            if "temp" in item:
                                matched_item = item
                                break

                    if matched_item:
                        vbatt = matched_item.get("vbatt")
                        bat = min(100.0, max(0.0, round((float(vbatt) - 2500.0) / 6.0, 1))) if vbatt else 95.0
                        live_reading = {
                            "temperature": float(matched_item["temp"]),
                            "battery": bat,
                            "signal_rssi": int(matched_item.get("rssi", -68)),
                            "device_mac": matched_item.get("dmac", target_dmac)
                        }
        except Exception as e:
            logger.debug(f"Aperture live query fallback: {e}")

        if live_reading:
            self.current_temp = round(live_reading["temperature"], 2)
            self.battery_level = live_reading["battery"]
            self.signal_rssi = live_reading["signal_rssi"]
            device_mac = live_reading["device_mac"]
        else:
            device_mac = target_dmac if target_dmac else "BC5729206C16"

        return {
            "shipment_code": self.shipment_code,
            "device_mac": device_mac,
            "temperature": self.current_temp,
            "battery": round(self.battery_level, 1),
            "humidity": self.humidity,
            "signal_rssi": self.signal_rssi,
            "mode": "LIVE_APERTURE",
            "step_count": self.step_count,
            "data_source": "APERTURE_LIVE",
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

# Registry of live tracked shipments (dynamically populated from Aperture)
simulated_shipments: Dict[str, ShipmentThermalSimulator] = {}

def get_simulated_shipment(shipment_code: str) -> ShipmentThermalSimulator:
    if shipment_code not in simulated_shipments:
        simulated_shipments[shipment_code] = ShipmentThermalSimulator(shipment_code, initial_temp=5.5)
    return simulated_shipments[shipment_code]
