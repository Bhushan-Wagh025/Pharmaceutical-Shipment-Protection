from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.logistics import Shipment
from app.models.telemetry import TemperatureReading, TemperatureForecast
from app.schemas.telemetry import TemperatureReadingCreate, TemperatureReadingOut
from app.services.ai_forecast_service import AITemperatureForecaster
from app.services.decision_engine import decision_engine
from app.websocket.manager import manager

router = APIRouter(prefix="/temperature", tags=["Temperature Telemetry"])

@router.get("/history/{shipment_id}", response_model=List[TemperatureReadingOut])
def get_temperature_history(
    shipment_id: int, 
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    readings = (
        db.query(TemperatureReading)
        .filter(TemperatureReading.shipment_id == shipment_id)
        .order_by(TemperatureReading.timestamp.desc())
        .limit(limit)
        .all()
    )
    return list(reversed(readings))

@router.post("/readings", response_model=TemperatureReadingOut)
async def ingest_temperature_reading(
    payload: TemperatureReadingCreate, 
    db: Session = Depends(get_db)
):
    shipment = db.query(Shipment).filter(Shipment.id == payload.shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    reading = TemperatureReading(
        shipment_id=payload.shipment_id,
        device_id=payload.device_id or shipment.ble_device_id,
        temperature=payload.temperature,
        battery=payload.battery or 95.0,
        humidity=payload.humidity or 45.0,
        signal_rssi=payload.signal_rssi or -65,
        timestamp=payload.timestamp or datetime.utcnow()
    )
    db.add(reading)
    db.commit()
    db.refresh(reading)

    # 1. Run AI ML Forecast
    forecast_data = AITemperatureForecaster.forecast_shipment_temperature(db, shipment)
    forecast_record = None
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
            timestamp=datetime.utcnow()
        )
        db.add(forecast_record)
        shipment.risk_level = forecast_data["risk_level"]
        db.commit()
        db.refresh(forecast_record)

    # 2. Run Decision Engine
    decision_result = decision_engine.evaluate_shipment(
        db=db,
        shipment=shipment,
        current_temp=reading.temperature,
        forecast=forecast_data
    )

    # 3. Broadcast real-time telemetry over WebSocket
    ws_payload = {
        "type": "TELEMETRY_UPDATE",
        "shipment_id": shipment.id,
        "shipment_code": shipment.shipment_code,
        "temperature": reading.temperature,
        "battery": reading.battery,
        "timestamp": reading.timestamp.isoformat(),
        "forecast": forecast_data,
        "decision": decision_result,
        "tray_state": shipment.tray.state if shipment.tray else "EXTENDED",
        "risk_level": shipment.risk_level,
        "status": shipment.status
    }
    await manager.broadcast_shipment_update(shipment.id, ws_payload)

    return reading
