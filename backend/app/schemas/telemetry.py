from typing import Optional, Union, Any
from datetime import datetime
from pydantic import BaseModel

class TemperatureReadingCreate(BaseModel):
    shipment_id: Optional[int] = None
    device_id: Optional[Union[int, str]] = None
    gateway_id: Optional[Union[int, str]] = None
    temperature: float
    battery: Optional[float] = 95.0
    battery_level: Optional[float] = None
    humidity: Optional[float] = 45.0
    signal_rssi: Optional[int] = -65
    rssi: Optional[int] = None
    data_source: str = "SIMULATED" # LIVE, SIMULATED
    validation_status: str = "VALID"
    timestamp: Optional[datetime] = None

class TemperatureReadingOut(BaseModel):
    id: int
    shipment_id: Optional[int] = None
    device_id: Optional[int] = None
    gateway_id: Optional[int] = None
    temperature: float
    battery: float
    humidity: float
    signal_rssi: int
    data_source: str = "SIMULATED"
    validation_status: str = "VALID"
    timestamp: datetime
    server_timestamp: Optional[datetime] = None

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
