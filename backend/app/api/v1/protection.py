from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.control import ProtectionAction
from app.schemas.tray import ProtectionActionOut

router = APIRouter(prefix="/protection", tags=["Protection Actions"])

@router.get("/actions", response_model=List[ProtectionActionOut])
def get_protection_actions(
    shipment_id: Optional[int] = None,
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db)
):
    query = db.query(ProtectionAction)
    if shipment_id:
        query = query.filter(ProtectionAction.shipment_id == shipment_id)
    return query.order_by(ProtectionAction.timestamp.desc()).limit(limit).all()

@router.get("/actions/{action_id}", response_model=ProtectionActionOut)
def get_protection_action_by_id(action_id: int, db: Session = Depends(get_db)):
    action = db.query(ProtectionAction).filter(ProtectionAction.id == action_id).first()
    if not action:
        raise HTTPException(status_code=404, detail="Protection action record not found")
    return action
