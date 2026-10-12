from typing import Optional
from datetime import datetime
from pydantic import BaseModel

class TrayMoveCommand(BaseModel):
    direction: str # "IN" or "OUT"
    reason: Optional[str] = "Manual operator command"

class TrayOut(BaseModel):
    id: int
    station_id: Optional[int] = None
    tray_code: str
    name: str
    state: str
    position_percentage: float
    temp_cold_pack: float
    target_temp: float
    last_moved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class TrayEventOut(BaseModel):
    id: int
    tray_id: int
    shipment_id: Optional[int] = None
    from_state: str
    to_state: str
    initiated_by: str
    reason: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True

class ProtectionActionOut(BaseModel):
    id: int
    shipment_id: int
    tray_id: Optional[int] = None
    prediction_temp: float
    threshold: float
    reason: str
    decision: str
    result: str
    cooling_verified: bool
    recovery_temp: Optional[float] = None
    timestamp: datetime

    class Config:
        from_attributes = True
