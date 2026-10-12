from typing import List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.logistics import Tray, TrayState, Shipment
from app.models.control import TrayEvent
from app.schemas.tray import TrayOut, TrayEventOut, TrayMoveCommand
from app.simulator.tray_simulator import get_simulated_tray
from app.services.audit_service import AuditService
from app.websocket.manager import manager

router = APIRouter(prefix="/trays", tags=["Tray Actuation Control"])

@router.get("", response_model=List[TrayOut])
def get_trays(db: Session = Depends(get_db)):
    trays = db.query(Tray).order_by(Tray.id.asc()).all()
    # Sync with simulator state
    for t in trays:
        sim_tray = get_simulated_tray(t.tray_code)
        sim_tray.tick()
        t.state = sim_tray.state
        t.position_percentage = sim_tray.position_percentage
    db.commit()
    return trays

@router.get("/{tray_id}/status", response_model=TrayOut)
def get_tray_status(tray_id: int, db: Session = Depends(get_db)):
    tray = db.query(Tray).filter(Tray.id == tray_id).first()
    if not tray:
        raise HTTPException(status_code=404, detail="Tray unit not found")
    sim_tray = get_simulated_tray(tray.tray_code)
    sim_tray.tick()
    tray.state = sim_tray.state
    tray.position_percentage = sim_tray.position_percentage
    db.commit()
    db.refresh(tray)
    return tray

@router.post("/{tray_id}/move-in", response_model=TrayOut)
async def move_tray_in(tray_id: int, db: Session = Depends(get_db)):
    tray = db.query(Tray).filter(Tray.id == tray_id).first()
    if not tray:
        raise HTTPException(status_code=404, detail="Tray unit not found")

    from_state = tray.state
    sim_tray = get_simulated_tray(tray.tray_code)
    sim_tray.command_move_in()
    
    tray.state = TrayState.MOVING_IN
    tray.position_percentage = 50.0
    tray.last_moved_at = datetime.utcnow()

    event = TrayEvent(
        tray_id=tray.id,
        from_state=from_state,
        to_state="MOVING_IN",
        initiated_by="OPERATOR_MANUAL_COMMAND",
        reason="Manual command to move tray into cold chamber",
        timestamp=datetime.utcnow()
    )
    db.add(event)

    AuditService.log(
        db=db,
        action="TRAY_MOVE_IN",
        resource_type="TRAY",
        resource_id=str(tray.id),
        details=f"Manual command: Moved tray {tray.tray_code} into protected compartment"
    )

    db.commit()
    db.refresh(tray)

    await manager.broadcast_to_channel("dashboard", {
        "type": "TRAY_STATE_CHANGED",
        "tray_id": tray.id,
        "tray_code": tray.tray_code,
        "state": tray.state,
        "position_percentage": tray.position_percentage
    })

    return tray

@router.post("/{tray_id}/move-out", response_model=TrayOut)
async def move_tray_out(tray_id: int, db: Session = Depends(get_db)):
    tray = db.query(Tray).filter(Tray.id == tray_id).first()
    if not tray:
        raise HTTPException(status_code=404, detail="Tray unit not found")

    from_state = tray.state
    sim_tray = get_simulated_tray(tray.tray_code)
    sim_tray.command_move_out()

    tray.state = TrayState.MOVING_OUT
    tray.position_percentage = 50.0
    tray.last_moved_at = datetime.utcnow()

    event = TrayEvent(
        tray_id=tray.id,
        from_state=from_state,
        to_state="MOVING_OUT",
        initiated_by="OPERATOR_MANUAL_COMMAND",
        reason="Manual command to extend tray outward",
        timestamp=datetime.utcnow()
    )
    db.add(event)

    AuditService.log(
        db=db,
        action="TRAY_MOVE_OUT",
        resource_type="TRAY",
        resource_id=str(tray.id),
        details=f"Manual command: Moved tray {tray.tray_code} outward"
    )

    db.commit()
    db.refresh(tray)

    await manager.broadcast_to_channel("dashboard", {
        "type": "TRAY_STATE_CHANGED",
        "tray_id": tray.id,
        "tray_code": tray.tray_code,
        "state": tray.state,
        "position_percentage": tray.position_percentage
    })

    return tray

@router.post("/{tray_id}/reset", response_model=TrayOut)
async def reset_tray(tray_id: int, db: Session = Depends(get_db)):
    tray = db.query(Tray).filter(Tray.id == tray_id).first()
    if not tray:
        raise HTTPException(status_code=404, detail="Tray unit not found")

    sim_tray = get_simulated_tray(tray.tray_code)
    sim_tray.reset()

    tray.state = TrayState.EXTENDED
    tray.position_percentage = 0.0
    tray.last_moved_at = datetime.utcnow()
    db.commit()
    db.refresh(tray)

    await manager.broadcast_to_channel("dashboard", {
        "type": "TRAY_STATE_CHANGED",
        "tray_id": tray.id,
        "tray_code": tray.tray_code,
        "state": tray.state,
        "position_percentage": tray.position_percentage
    })

    return tray
