import logging
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.logistics import Tray, TrayState, Shipment
from app.models.control import TrayEvent
from app.models.auth import User, RoleEnum
from app.schemas.tray import TrayOut, TrayEventOut
from app.simulator.tray_simulator import get_simulated_tray
from app.services.auth_service import get_current_user, require_roles
from app.services.audit_service import AuditService
from app.websocket.manager import manager

logger = logging.getLogger("pharma.trays_api")
router = APIRouter(prefix="/trays", tags=["Tray Actuation Control"])

class TrayOverrideCommand(BaseModel):
    target_percentage: float = Field(..., ge=0.0, le=100.0)
    reason: Optional[str] = "Manual operator position adjustment"

@router.get("", response_model=List[TrayOut])
def get_trays(db: Session = Depends(get_db)):
    trays = db.query(Tray).order_by(Tray.id.asc()).all()
    # Sync with position feedback simulator / hardware controller
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
async def move_tray_in(
    tray_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    tray = db.query(Tray).filter(Tray.id == tray_id).first()
    if not tray:
        raise HTTPException(status_code=404, detail="Tray unit not found")

    # Safety: Duplicate Command Protection
    if tray.state == TrayState.PROTECTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tray is already in PROTECTED state inside the cold compartment. Duplicate command ignored."
        )
    if tray.state == TrayState.MOVING_IN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tray is already actively MOVING_IN. Duplicate command rejected to prevent motor stress."
        )

    from_state = tray.state
    sim_tray = get_simulated_tray(tray.tray_code)
    sim_tray.command_move_in()
    
    tray.state = TrayState.MOVING_IN
    tray.position_percentage = 40.0
    tray.last_moved_at = datetime.utcnow()

    event = TrayEvent(
        tray_id=tray.id,
        from_state=from_state.value if hasattr(from_state, 'value') else str(from_state),
        to_state="MOVING_IN",
        initiated_by=f"OPERATOR_{current_user.email if current_user else 'MANUAL'}",
        reason="Manual command to retract package into hermetic cold chamber",
        timestamp=datetime.utcnow()
    )
    db.add(event)

    AuditService.log(
        db=db,
        action="TRAY_MOVE_IN",
        resource_type="TRAY",
        resource_id=str(tray.id),
        details=f"Commanded tray {tray.tray_code} to retract into cold chamber",
        user=current_user
    )

    db.commit()
    db.refresh(tray)

    await manager.broadcast_to_channel("dashboard", {
        "type": "TRAY_STATE_CHANGED",
        "tray_id": tray.id,
        "tray_code": tray.tray_code,
        "state": tray.state.value if hasattr(tray.state, 'value') else str(tray.state),
        "position_percentage": tray.position_percentage
    })

    return tray

@router.post("/{tray_id}/move-out", response_model=TrayOut)
async def move_tray_out(
    tray_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    tray = db.query(Tray).filter(Tray.id == tray_id).first()
    if not tray:
        raise HTTPException(status_code=404, detail="Tray unit not found")

    # Safety: Duplicate Command Protection
    if tray.state == TrayState.EXTENDED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tray is already in EXTENDED state outside the cold chamber. Duplicate command ignored."
        )
    if tray.state == TrayState.MOVING_OUT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tray is already actively MOVING_OUT. Duplicate command rejected."
        )

    from_state = tray.state
    sim_tray = get_simulated_tray(tray.tray_code)
    sim_tray.command_move_out()

    tray.state = TrayState.MOVING_OUT
    tray.position_percentage = 60.0
    tray.last_moved_at = datetime.utcnow()

    event = TrayEvent(
        tray_id=tray.id,
        from_state=from_state.value if hasattr(from_state, 'value') else str(from_state),
        to_state="MOVING_OUT",
        initiated_by=f"OPERATOR_{current_user.email if current_user else 'MANUAL'}",
        reason="Manual command to extend package outward to packaging dispatch bay",
        timestamp=datetime.utcnow()
    )
    db.add(event)

    AuditService.log(
        db=db,
        action="TRAY_MOVE_OUT",
        resource_type="TRAY",
        resource_id=str(tray.id),
        details=f"Commanded tray {tray.tray_code} to extend outward",
        user=current_user
    )

    db.commit()
    db.refresh(tray)

    await manager.broadcast_to_channel("dashboard", {
        "type": "TRAY_STATE_CHANGED",
        "tray_id": tray.id,
        "tray_code": tray.tray_code,
        "state": tray.state.value if hasattr(tray.state, 'value') else str(tray.state),
        "position_percentage": tray.position_percentage
    })

    return tray

@router.post("/{tray_id}/emergency-stop", response_model=TrayOut)
async def emergency_stop_tray(
    tray_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    tray = db.query(Tray).filter(Tray.id == tray_id).first()
    if not tray:
        raise HTTPException(status_code=404, detail="Tray unit not found")

    from_state = tray.state
    sim_tray = get_simulated_tray(tray.tray_code)
    sim_tray.is_moving = False

    tray.state = TrayState.ERROR
    tray.last_moved_at = datetime.utcnow()

    event = TrayEvent(
        tray_id=tray.id,
        from_state=from_state.value if hasattr(from_state, 'value') else str(from_state),
        to_state="ERROR",
        initiated_by=f"E_STOP_{current_user.email if current_user else 'OPERATOR'}",
        reason="EMERGENCY STOP manually triggered. Actuator drive de-energized.",
        timestamp=datetime.utcnow()
    )
    db.add(event)

    AuditService.log(
        db=db,
        action="TRAY_EMERGENCY_STOP",
        resource_type="TRAY",
        resource_id=str(tray.id),
        details=f"EMERGENCY STOP engaged on tray {tray.tray_code}. Actuator halted.",
        user=current_user
    )

    db.commit()
    db.refresh(tray)

    await manager.broadcast_to_channel("dashboard", {
        "type": "TRAY_STATE_CHANGED",
        "tray_id": tray.id,
        "tray_code": tray.tray_code,
        "state": "ERROR",
        "position_percentage": tray.position_percentage
    })

    return tray

@router.post("/{tray_id}/override", response_model=TrayOut)
async def manual_override_tray(
    tray_id: int,
    payload: TrayOverrideCommand,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    tray = db.query(Tray).filter(Tray.id == tray_id).first()
    if not tray:
        raise HTTPException(status_code=404, detail="Tray unit not found")

    from_state = tray.state
    target = payload.target_percentage

    sim_tray = get_simulated_tray(tray.tray_code)
    sim_tray.position_percentage = target
    sim_tray.is_moving = False

    if target >= 90.0:
        tray.state = TrayState.PROTECTED
    elif target <= 10.0:
        tray.state = TrayState.EXTENDED
    else:
        tray.state = TrayState.MOVING_IN if target > 50 else TrayState.MOVING_OUT

    tray.position_percentage = target
    tray.last_moved_at = datetime.utcnow()

    event = TrayEvent(
        tray_id=tray.id,
        from_state=from_state.value if hasattr(from_state, 'value') else str(from_state),
        to_state=tray.state.value if hasattr(tray.state, 'value') else str(tray.state),
        initiated_by=f"OVERRIDE_{current_user.email if current_user else 'OPERATOR'}",
        reason=f"Manual Override: {payload.reason} (Target: {target}%)",
        timestamp=datetime.utcnow()
    )
    db.add(event)

    AuditService.log(
        db=db,
        action="TRAY_MANUAL_OVERRIDE",
        resource_type="TRAY",
        resource_id=str(tray.id),
        details=f"Manual override on tray {tray.tray_code} to {target}%: {payload.reason}",
        user=current_user
    )

    db.commit()
    db.refresh(tray)

    await manager.broadcast_to_channel("dashboard", {
        "type": "TRAY_STATE_CHANGED",
        "tray_id": tray.id,
        "tray_code": tray.tray_code,
        "state": tray.state.value if hasattr(tray.state, 'value') else str(tray.state),
        "position_percentage": tray.position_percentage
    })

    return tray

@router.post("/{tray_id}/reset", response_model=TrayOut)
async def reset_tray(
    tray_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
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

    AuditService.log(
        db=db,
        action="TRAY_RESET",
        resource_type="TRAY",
        resource_id=str(tray.id),
        details=f"Reset tray {tray.tray_code} to initial EXTENDED state",
        user=current_user
    )

    await manager.broadcast_to_channel("dashboard", {
        "type": "TRAY_STATE_CHANGED",
        "tray_id": tray.id,
        "tray_code": tray.tray_code,
        "state": "EXTENDED",
        "position_percentage": 0.0
    })

    return tray
