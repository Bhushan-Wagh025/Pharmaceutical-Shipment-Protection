from typing import Dict, Any, List
from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.logistics import Shipment, ShipmentStatus
from app.models.telemetry import TemperatureReading, TemperatureForecast
from app.models.control import ProtectionAction
from app.models.governance import Alert

router = APIRouter(prefix="/reports", tags=["Reports & Analytics"])

@router.get("/compliance")
def get_compliance_report(db: Session = Depends(get_db)) -> Dict[str, Any]:
    total_shipments = db.query(Shipment).count()
    total_readings = db.query(TemperatureReading).count()
    total_forecasts = db.query(TemperatureForecast).count()
    total_protections = db.query(ProtectionAction).count()
    successful_protections = db.query(ProtectionAction).filter(ProtectionAction.cooling_verified == True).count()
    total_alerts = db.query(Alert).count()

    # Calculate compliance rate
    compliance_rate = 100.0
    if total_shipments > 0:
        protected_or_normal = db.query(Shipment).filter(
            Shipment.status.in_([ShipmentStatus.NORMAL, ShipmentStatus.ACTIVE, ShipmentStatus.PROTECTED, ShipmentStatus.DELIVERED])
        ).count()
        compliance_rate = round((protected_or_normal / max(1, total_shipments)) * 100.0, 2)

    # Detailed shipments overview for table export
    shipments = db.query(Shipment).all()
    shipment_summaries = []
    for s in shipments:
        readings_count = db.query(TemperatureReading).filter(TemperatureReading.shipment_id == s.id).count()
        actions_count = db.query(ProtectionAction).filter(ProtectionAction.shipment_id == s.id).count()
        alerts_count = db.query(Alert).filter(Alert.shipment_id == s.id).count()
        
        # Max temp observed
        max_temp = db.query(func.max(TemperatureReading.temperature)).filter(TemperatureReading.shipment_id == s.id).scalar()
        min_temp = db.query(func.min(TemperatureReading.temperature)).filter(TemperatureReading.shipment_id == s.id).scalar()

        shipment_summaries.append({
            "id": s.id,
            "shipment_code": s.shipment_code,
            "product_name": s.product_name,
            "batch_number": s.batch_number,
            "customer_name": s.customer_name,
            "origin": s.origin,
            "destination": s.destination,
            "status": s.status,
            "risk_level": s.risk_level,
            "temp_limit": s.temp_limit,
            "readings_count": readings_count,
            "max_temp": max_temp,
            "min_temp": min_temp,
            "protection_actions_count": actions_count,
            "alerts_count": alerts_count,
            "compliant": (max_temp or 0.0) <= s.temp_limit or s.status == ShipmentStatus.PROTECTED
        })

    return {
        "generated_at": datetime.utcnow().isoformat(),
        "total_shipments": total_shipments,
        "total_readings": total_readings,
        "total_forecasts": total_forecasts,
        "total_protections_triggered": total_protections,
        "successful_cooling_verified": successful_protections,
        "total_alerts_issued": total_alerts,
        "compliance_rate_percent": compliance_rate,
        "shipment_summaries": shipment_summaries
    }
