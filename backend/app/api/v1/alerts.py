from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.governance import Alert
from app.schemas.alert import AlertOut, AlertAcknowledge
from app.services.alert_service import AlertService

router = APIRouter(prefix="/alerts", tags=["Alerts"])

@router.get("", response_model=List[AlertOut])
def get_alerts(
    shipment_id: Optional[int] = None,
    unack_only: bool = False,
    severity: Optional[str] = None,
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db)
):
    query = db.query(Alert)
    if shipment_id:
        query = query.filter(Alert.shipment_id == shipment_id)
    if unack_only:
        query = query.filter(Alert.is_acknowledged == False)
    if severity:
        query = query.filter(Alert.severity == severity)
    return query.order_by(Alert.created_at.desc()).limit(limit).all()

@router.post("/{alert_id}/acknowledge", response_model=AlertOut)
def acknowledge_alert(
    alert_id: int, 
    payload: AlertAcknowledge, 
    db: Session = Depends(get_db)
):
    alert = AlertService.acknowledge_alert(
        db=db, 
        alert_id=alert_id, 
        user_email=payload.acknowledged_by or "Operator"
    )
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert
