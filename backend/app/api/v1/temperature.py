import math
import json
import logging
from typing import List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.logistics import Shipment, Gateway, BLEDevice
from app.models.telemetry import TemperatureReading, TemperatureForecast
from app.schemas.telemetry import TemperatureReadingCreate, TemperatureReadingOut
from app.services.ai_forecast_service import AITemperatureForecaster
from app.services.decision_engine import decision_engine
from app.websocket.manager import manager

logger = logging.getLogger("pharma.temperature_api")
router = APIRouter(prefix="/temperature", tags=["Temperature Telemetry"])

@router.get("/history/{shipment_id}", response_model=List[TemperatureReadingOut])
def get_temperature_history(
    shipment_id: int, 
    limit: int = Query(100, ge=1, le=1000),
    data_source: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(TemperatureReading).filter(TemperatureReading.shipment_id == shipment_id)
    if data_source:
        query = query.filter(TemperatureReading.data_source == data_source.upper())
    readings = query.order_by(TemperatureReading.timestamp.desc()).limit(limit).all()
    return list(reversed(readings))

@router.post("/readings", response_model=TemperatureReadingOut)
async def ingest_temperature_reading(
    payload: TemperatureReadingCreate, 
    db: Session = Depends(get_db)
):
    """
    Ingests and normalizes incoming telemetry from GAO BLE Gateways or Simulator.
    Executes telemetry validation, deduplication, timestamp drift/stale checks,
    scikit-learn AI forecasting, decision engine safety checks, and WebSocket broadcasts.
    """
    # 1. Resolve Shipment
    shipment = None
    if payload.shipment_id:
        shipment = db.query(Shipment).filter(Shipment.id == payload.shipment_id).first()
    elif payload.device_id:
        shipment = db.query(Shipment).filter(Shipment.ble_device_id == payload.device_id).first()

    if not shipment:
        # Fallback to first active shipment for standalone sensor testing
        shipment = db.query(Shipment).first()
        if not shipment:
            raise HTTPException(status_code=404, detail="No active shipment found to correlate telemetry.")

    # 2. Telemetry Range & Sanity Validation
    temp = payload.temperature
    if temp is None or math.isnan(temp) or math.isinf(temp):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Invalid temperature reading: Value must be a valid finite number."
        )

    validation_status = "VALID"
    if temp < -50.0 or temp > 80.0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Temperature reading out of valid range (-50°C to 80°C)."
        )

    # 3. Timestamp & Stale Detection
    now = datetime.utcnow()
    reading_time = payload.timestamp or now

    # Clock drift correction if skewed by > 24 hours
    if abs((now - reading_time).total_seconds()) > 86400:
        reading_time = now

    is_stale = False
    stale_cutoff = now - timedelta(minutes=settings.STALE_TELEMETRY_THRESHOLD_MINUTES)
    if reading_time < stale_cutoff:
        is_stale = True
        validation_status = "STALE"
        logger.warning(f"Stale telemetry received for shipment {shipment.id} (Age: {round((now - reading_time).total_seconds()/60, 1)}m)")

    # 4. Deduplication: Check if duplicate reading already exists
    recent_dup = (
        db.query(TemperatureReading)
        .filter(
            TemperatureReading.shipment_id == shipment.id,
            TemperatureReading.timestamp == reading_time,
            TemperatureReading.temperature == round(temp, 2)
        )
        .first()
    )
    if recent_dup:
        return recent_dup

    # 5. Persist Normalized Reading
    data_src = (payload.data_source or "SIMULATED").upper()
    if data_src not in ("LIVE", "SIMULATED"):
        data_src = "SIMULATED"

    dev_id = payload.device_id if isinstance(payload.device_id, int) else shipment.ble_device_id
    gw_id = payload.gateway_id if isinstance(payload.gateway_id, int) else None
    batt = payload.battery_level if payload.battery_level is not None else payload.battery
    rssi_val = payload.rssi if payload.rssi is not None else payload.signal_rssi

    reading = TemperatureReading(
        shipment_id=shipment.id,
        device_id=dev_id,
        gateway_id=gw_id,
        temperature=round(temp, 2),
        battery=round(batt, 1) if batt is not None else 95.0,
        humidity=round(payload.humidity, 1) if payload.humidity is not None else 45.0,
        signal_rssi=rssi_val if rssi_val is not None else -65,
        data_source=data_src,
        validation_status=validation_status,
        timestamp=reading_time,
        server_timestamp=now
    )
    db.add(reading)
    db.commit()
    db.refresh(reading)

    # 6. Update Gateway Last Reading & Last Communication if gateway_id provided
    if payload.gateway_id:
        gw = db.query(Gateway).filter(Gateway.id == payload.gateway_id).first()
        if gw:
            gw.last_communication_at = now
            gw.last_seen_at = now
            gw.last_reading_data = json.dumps({
                "temperature": reading.temperature,
                "battery": reading.battery,
                "rssi": reading.signal_rssi,
                "data_source": reading.data_source,
                "timestamp": reading.timestamp.isoformat()
            })
            db.commit()

    # 7. AI ML Trajectory Forecasting
    forecast_data = None
    if validation_status != "OUT_OF_RANGE":
        forecast_data = AITemperatureForecaster.forecast_shipment_temperature(db, shipment)
        if forecast_data:
            forecast_record = TemperatureForecast(
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
            )
            db.add(forecast_record)
            shipment.risk_level = forecast_data["risk_level"]
            db.commit()

    # 8. Run Decision Engine with Stale Telemetry Protection
    decision_result = decision_engine.evaluate_shipment(
        db=db,
        shipment=shipment,
        current_temp=reading.temperature,
        forecast=forecast_data,
        is_stale=is_stale
    )

    # 9. Real-Time Broadcast over WebSockets
    ws_payload = {
        "type": "TELEMETRY_UPDATE",
        "shipment_id": shipment.id,
        "shipment_code": shipment.shipment_code,
        "gateway_id": reading.gateway_id,
        "temperature": reading.temperature,
        "battery": reading.battery,
        "humidity": reading.humidity,
        "rssi": reading.signal_rssi,
        "data_source": reading.data_source,
        "validation_status": reading.validation_status,
        "timestamp": reading.timestamp.isoformat(),
        "server_timestamp": reading.server_timestamp.isoformat() if reading.server_timestamp else now.isoformat(),
        "forecast": forecast_data,
        "decision": decision_result,
        "tray_state": shipment.tray.state if shipment.tray else "EXTENDED",
        "risk_level": shipment.risk_level,
        "status": shipment.status
    }
    await manager.broadcast_shipment_update(shipment.id, ws_payload)

    return reading
