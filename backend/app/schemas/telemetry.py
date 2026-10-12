from typing import Optional
from datetime import datetime
from pydantic import BaseModel

class TemperatureReadingCreate(BaseModel):
    shipment_id: int
    device_id: Optional[int] = None
    temperature: float
    battery: Optional[float] = 95.0
    humidity: Optional[float] = 45.0
    signal_rssi: Optional[int] = -65
    timestamp: Optional[datetime] = None

class TemperatureReadingOut(BaseModel):
    id: int
    shipment_id: int
    device_id: Optional[int] = None
    temperature: float
    battery: float
    humidity: float
    signal_rssi: int
    timestamp: datetime

    class Config:
        from_attributes = True

class TemperatureForecastOut(BaseModel):
    id: int
    shipment_id: int
    current_temp: float
    predicted_temp: float
    horizon_minutes: int
    risk_level: str
    will_cross_limit: bool
    time_to_cross_seconds: Optional[float] = None
    confidence: float
    slope_c_per_min: float
    model_type: str
    timestamp: datetime

    class Config:
        from_attributes = True

class RiskEventOut(BaseModel):
    id: int
    shipment_id: int
    risk_level: str
    trigger_factor: str
    details: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True
