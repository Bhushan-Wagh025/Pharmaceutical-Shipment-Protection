from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.logistics import Shipment, BLEDevice, Tray, Gateway, GatewayStatus, BLEDeviceStatus, ShipmentStatus
from app.models.telemetry import TemperatureReading, TemperatureForecast, RiskLevel
from app.models.governance import Alert
from app.schemas.shipment import ShipmentCreate, ShipmentUpdate, ShipmentOut, DashboardOverviewOut
from app.services.audit_service import AuditService

router = APIRouter(prefix="/shipments", tags=["Shipments"])

def enrich_shipment(s: Shipment, db: Session) -> ShipmentOut:
    latest_reading = (
        db.query(TemperatureReading)
        .filter(TemperatureReading.shipment_id == s.id)
        .order_by(TemperatureReading.timestamp.desc())
        .first()
    )
    latest_forecast = (
        db.query(TemperatureForecast)
        .filter(TemperatureForecast.shipment_id == s.id)
        .order_by(TemperatureForecast.timestamp.desc())
        .first()
    )

    out = ShipmentOut.model_validate(s)
    if latest_reading:
        out.current_temperature = latest_reading.temperature
        out.current_battery = latest_reading.battery
        out.last_reading_time = latest_reading.timestamp
    if latest_forecast:
        out.latest_forecast = latest_forecast
    return out

@router.get("", response_model=List[ShipmentOut])
def get_shipments(
    status: Optional[str] = None,
    risk: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Shipment)
    if status:
        query = query.filter(Shipment.status == status)
    if risk:
        query = query.filter(Shipment.risk_level == risk)
    shipments = query.order_by(Shipment.id.asc()).all()
    return [enrich_shipment(s, db) for s in shipments]

@router.get("/overview", response_model=DashboardOverviewOut)
def get_dashboard_overview(db: Session = Depends(get_db)):
    shipments = db.query(Shipment).order_by(Shipment.id.asc()).all()
    enriched = [enrich_shipment(s, db) for s in shipments]

    active_count = len([s for s in shipments if s.status in [ShipmentStatus.ACTIVE, ShipmentStatus.NORMAL, ShipmentStatus.AT_RISK, ShipmentStatus.PROTECTED]])
    normal_count = len([s for s in shipments if s.status == ShipmentStatus.NORMAL or (s.status == ShipmentStatus.ACTIVE and s.risk_level == "LOW")])
    at_risk_count = len([s for s in shipments if s.risk_level in ["MEDIUM", "HIGH", "CRITICAL"] and s.status != ShipmentStatus.PROTECTED])
    protected_count = len([s for s in shipments if s.status == ShipmentStatus.PROTECTED])

    online_gateways = db.query(Gateway).filter(Gateway.status == GatewayStatus.ONLINE).count()
    online_devices = db.query(BLEDevice).filter(BLEDevice.status == BLEDeviceStatus.ONLINE).count()
    active_alerts = db.query(Alert).filter(Alert.is_acknowledged == False).count()

    return {
        "active_shipments_count": active_count,
        "normal_count": normal_count,
        "at_risk_count": at_risk_count,
        "protected_count": protected_count,
        "online_gateways_count": online_gateways,
        "online_devices_count": online_devices,
        "active_alerts_count": active_alerts,
        "shipments": enriched
    }

@router.get("/{shipment_id}", response_model=ShipmentOut)
def get_shipment_by_id(shipment_id: int, db: Session = Depends(get_db)):
    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    return enrich_shipment(shipment, db)

@router.post("", response_model=ShipmentOut)
def create_shipment(payload: ShipmentCreate, db: Session = Depends(get_db)):
    existing = db.query(Shipment).filter(Shipment.shipment_code == payload.shipment_code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Shipment code already exists")

    shipment = Shipment(
        shipment_code=payload.shipment_code,
        package_id=payload.package_id,
        company_id=payload.company_id,
        product_name=payload.product_name,
        batch_number=payload.batch_number,
        customer_name=payload.customer_name,
        origin=payload.origin,
        destination=payload.destination,
        temp_limit=payload.temp_limit,
        temp_safe_min=payload.temp_safe_min,
        forecast_horizon_minutes=payload.forecast_horizon_minutes,
        status=ShipmentStatus.NORMAL,
        risk_level=RiskLevel.LOW.value,
        ble_device_id=payload.ble_device_id,
        tray_id=payload.tray_id
    )
    db.add(shipment)
    db.commit()
    db.refresh(shipment)

    AuditService.log(
        db=db,
        action="CREATE_SHIPMENT",
        resource_type="SHIPMENT",
        resource_id=str(shipment.id),
        details=f"Created shipment {shipment.shipment_code} for product {shipment.product_name}"
    )

    return enrich_shipment(shipment, db)

@router.put("/{shipment_id}", response_model=ShipmentOut)
def update_shipment(shipment_id: int, payload: ShipmentUpdate, db: Session = Depends(get_db)):
    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(shipment, field, val)

    shipment.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(shipment)

    AuditService.log(
        db=db,
        action="UPDATE_SHIPMENT",
        resource_type="SHIPMENT",
        resource_id=str(shipment.id),
        details=f"Updated shipment parameters for {shipment.shipment_code}"
    )

    return enrich_shipment(shipment, db)

@router.delete("/{shipment_id}")
def delete_shipment(shipment_id: int, db: Session = Depends(get_db)):
    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    
    code = shipment.shipment_code
    db.delete(shipment)
    db.commit()

    AuditService.log(
        db=db,
        action="DELETE_SHIPMENT",
        resource_type="SHIPMENT",
        resource_id=str(shipment_id),
        details=f"Deleted shipment {code}"
    )
    return {"message": f"Shipment {code} deleted"}
