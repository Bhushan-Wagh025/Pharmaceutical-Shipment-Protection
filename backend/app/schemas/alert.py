from typing import Optional
from datetime import datetime
from pydantic import BaseModel

class AlertCreate(BaseModel):
    shipment_id: Optional[int] = None
    alert_type: str
    severity: str = "INFO"
    title: str
    message: str

class AlertOut(BaseModel):
    id: int
    shipment_id: Optional[int] = None
    alert_type: str
    severity: str
    title: str
    message: str
    is_acknowledged: bool
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

class AlertAcknowledge(BaseModel):
    acknowledged_by: Optional[str] = "Operator"

class AuditLogCreate(BaseModel):
    user_id: Optional[int] = None
    user_email: Optional[str] = None
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    details: Optional[str] = None
    ip_address: Optional[str] = None

class AuditLogOut(BaseModel):
    id: int
    user_id: Optional[int] = None
    user_email: Optional[str] = None
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    details: Optional[str] = None
    ip_address: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True

class SystemSettingOut(BaseModel):
    id: int
    key: str
    value: str
    description: Optional[str] = None
    updated_at: datetime

    class Config:
        from_attributes = True

class SystemSettingUpdate(BaseModel):
    value: str
    description: Optional[str] = None
