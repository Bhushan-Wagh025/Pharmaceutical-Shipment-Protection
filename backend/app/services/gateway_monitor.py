import asyncio
import logging
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

from app.database import SessionLocal
from app.models.logistics import Gateway, GatewayStatus, Shipment, BLEDevice
from app.models.telemetry import TemperatureReading, TemperatureForecast
from app.adapters.factory import get_gateway_adapter
from app.services.ai_forecast_service import AITemperatureForecaster
from app.services.decision_engine import decision_engine
from app.websocket.manager import manager

logger = logging.getLogger("pharma.gateway_monitor")

class GatewayMonitoringService:
    """
    Background polling service that continuously inspects enabled gateways with is_monitoring=True.
    Fetches real sensor telemetry, normalizes records, runs AI forecasts, triggers tray protection
    decisions, and broadcasts live updates over WebSockets.
    """

    def __init__(self):
        self._task: Optional[asyncio.Task] = None
        self._running = False

    async def start(self):
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._poll_loop())
        logger.info("Gateway background monitoring service started.")

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        logger.info("Gateway background monitoring service stopped.")

    async def _poll_loop(self):
        while self._running:
            try:
                await self.poll_all_active_gateways()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in gateway monitoring loop: {e}")
            await asyncio.sleep(3)

    async def poll_all_active_gateways(self):
        db = SessionLocal()
        try:
            gateways = db.query(Gateway).filter(
                Gateway.is_enabled == True,
                Gateway.is_monitoring == True
            ).all()

            for gw in gateways:
                now = datetime.utcnow()
                interval = gw.polling_interval or 5
                if gw.last_communication_at and (now - gw.last_communication_at).total_seconds() < interval:
                    continue

                await self._poll_single_gateway(gw, db)
        finally:
            db.close()

    async def _poll_single_gateway(self, gw: Gateway, db):
        now = datetime.utcnow()
        try:
            adapter = get_gateway_adapter(gw)
            readings = adapter.fetch_telemetry()

            if readings:
                gw.status = GatewayStatus.ONLINE
                gw.last_communication_at = now
                gw.last_seen_at = now
                gw.last_error = None

                for r in readings:
                    await self._ingest_gateway_reading(gw, r, db)
                db.commit()
            else:
                status_res = adapter.get_status()
                if status_res.get("connected") or status_res.get("status") == "ONLINE":
                    gw.status = GatewayStatus.ONLINE
                    gw.last_communication_at = now
                elif status_res.get("error"):
                    gw.status = GatewayStatus.OFFLINE
                    gw.last_error = status_res.get("error")
                db.commit()
        except Exception as e:
            gw.status = GatewayStatus.OFFLINE
            gw.last_error = str(e)
            db.commit()
            logger.warning(f"Error polling gateway {gw.name} ({gw.gateway_eui}): {e}")

    async def _ingest_gateway_reading(self, gw: Gateway, r: Dict[str, Any], db):
        device_mac = r.get("device_mac")
        temp = r.get("temperature")
        if temp is None:
            return

        now = datetime.utcnow()
        shipment = None
        if device_mac:
            ble = db.query(BLEDevice).filter(BLEDevice.device_mac == device_mac).first()
            if ble:
                shipment = db.query(Shipment).filter(Shipment.ble_device_id == ble.id).first()

        if not shipment:
            shipment = db.query(Shipment).first()

        if not shipment:
            gw.last_reading_data = json.dumps({
                "device_mac": device_mac,
                "temperature": float(temp),
                "battery": float(r.get("battery", 95.0)),
                "rssi": int(r.get("rssi", -65)),
                "timestamp": now.isoformat()
            })
            return

        # Deduplication
        existing = db.query(TemperatureReading).filter(
            TemperatureReading.shipment_id == shipment.id,
            TemperatureReading.temperature == round(float(temp), 2),
            TemperatureReading.timestamp >= now - timedelta(seconds=2)
        ).first()
        if existing:
            return

        source_tag = r.get("data_source") or r.get("source") or ("SIMULATED" if (hasattr(gw.adapter_type, 'value') and gw.adapter_type.value == "SIMULATED") else "LIVE")
        reading = TemperatureReading(
            shipment_id=shipment.id,
            device_id=shipment.ble_device_id,
            gateway_id=gw.id,
            temperature=round(float(temp), 2),
            battery=round(float(r.get("battery", 95.0)), 1),
            humidity=round(float(r.get("humidity", 45.0)), 1),
            signal_rssi=int(r.get("rssi", -65)),
            data_source=source_tag,
            validation_status="VALID",
            timestamp=now,
            server_timestamp=now
        )
        db.add(reading)
        db.commit()
        db.refresh(reading)

        gw.last_reading_data = json.dumps({
            "device_mac": device_mac,
            "temperature": reading.temperature,
            "battery": reading.battery,
            "rssi": reading.signal_rssi,
            "timestamp": now.isoformat()
        })

        # Run AI ML Trajectory Forecast
        forecast_data = AITemperatureForecaster.forecast_shipment_temperature(db, shipment)
        if forecast_data:
            db.add(TemperatureForecast(
                shipment_id=shipment.id,
                current_temp=forecast_data["current_temp"],
                predicted_temp=forecast_data["predicted_temp"],
                horizon_minutes=forecast_data["horizon_minutes"],
                risk_level=forecast_data["risk_level"],
                will_cross_limit=forecast_data["will_cross_limit"],
                time_to_cross_seconds=forecast_data["time_to_cross_seconds"],
                confidence=forecast_data["confidence"],
                slope_c_per_min=forecast_data["slope_c_per_min"],
                model_type=forecast_data["model_type"],
                timestamp=now
            ))
            shipment.risk_level = forecast_data["risk_level"]
            db.commit()

        # Physical Tray Control Decision
        decision_result = decision_engine.evaluate_shipment(
            db=db,
            shipment=shipment,
            current_temp=reading.temperature,
            forecast=forecast_data,
            is_stale=False
        )

        # Broadcast real-time WebSocket update
        await manager.broadcast_shipment_update(shipment.id, {
            "type": "TELEMETRY_UPDATE",
            "shipment_id": shipment.id,
            "shipment_code": shipment.shipment_code,
            "gateway_id": gw.id,
            "temperature": reading.temperature,
            "battery": reading.battery,
            "humidity": reading.humidity,
            "rssi": reading.signal_rssi,
            "data_source": source_tag,
            "validation_status": "VALID",
            "timestamp": now.isoformat(),
            "server_timestamp": now.isoformat(),
            "forecast": forecast_data,
            "decision": decision_result,
            "tray_state": shipment.tray.state if shipment.tray else "EXTENDED",
            "risk_level": shipment.risk_level,
            "status": shipment.status
        })

gateway_monitor = GatewayMonitoringService()
