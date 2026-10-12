from typing import List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.telemetry import RiskEvent
from app.schemas.telemetry import RiskEventOut

router = APIRouter(prefix="/risk", tags=["Risk Management"])

@router.get("/{shipment_id}/events", response_model=List[RiskEventOut])
def get_risk_events(shipment_id: int, db: Session = Depends(get_db)):
    return (
        db.query(RiskEvent)
        .filter(RiskEvent.shipment_id == shipment_id)
        .order_by(RiskEvent.timestamp.desc())
        .all()
    )
