from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.logistics import Shipment
from app.models.telemetry import TemperatureForecast
from app.schemas.telemetry import TemperatureForecastOut
from app.services.ai_forecast_service import AITemperatureForecaster

router = APIRouter(prefix="/forecast", tags=["AI Forecast"])

@router.get("/{shipment_id}/latest", response_model=Optional[TemperatureForecastOut])
def get_latest_forecast(shipment_id: int, db: Session = Depends(get_db)):
    forecast = (
        db.query(TemperatureForecast)
        .filter(TemperatureForecast.shipment_id == shipment_id)
        .order_by(TemperatureForecast.timestamp.desc())
        .first()
    )
    return forecast

@router.get("/{shipment_id}/history", response_model=List[TemperatureForecastOut])
def get_forecast_history(
    shipment_id: int, 
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db)
):
    records = (
        db.query(TemperatureForecast)
        .filter(TemperatureForecast.shipment_id == shipment_id)
        .order_by(TemperatureForecast.timestamp.desc())
        .limit(limit)
        .all()
    )
    return list(reversed(records))

@router.post("/{shipment_id}/run", response_model=TemperatureForecastOut)
def run_forecast_on_demand(shipment_id: int, db: Session = Depends(get_db)):
    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    forecast_data = AITemperatureForecaster.forecast_shipment_temperature(db, shipment)
    if not forecast_data:
        raise HTTPException(status_code=400, detail="Insufficient temperature data to compute forecast")

    record = TemperatureForecast(
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
    db.add(record)
    shipment.risk_level = forecast_data["risk_level"]
    db.commit()
    db.refresh(record)
    return record
