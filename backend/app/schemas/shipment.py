from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
from app.schemas.telemetry import TemperatureReadingOut, TemperatureForecastOut
from app.schemas.tray import TrayOut

class GatewayBase(BaseModel):
    gateway_eui: str
    name: str
    ip_address: Optional[str] = None
    status: str = "ONLINE"
    company_id: Optional[int] = None
    station_id: Optional[int] = None

class GatewayCreate(GatewayBase):
    pass

class GatewayOut(GatewayBase):
    id: int
    last_seen_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True

class BLEDeviceBase(BaseModel):
    device_mac: str
    name: str
    battery_level: float = 98.0
    status: str = "ONLINE"
    company_id: Optional[int] = None

class BLEDeviceCreate(BLEDeviceBase):
    pass

class BLEDeviceOut(BLEDeviceBase):
    id: int
    last_seen_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True

class ShipmentBase(BaseModel):
    shipment_code: str
    package_id: str
    product_name: str
    batch_number: str
    customer_name: str
    origin: str
    destination: str
    temp_limit: float = 8.0
    temp_safe_min: float = 2.0
    forecast_horizon_minutes: int = 15
    company_id: int
    ble_device_id: Optional[int] = None
    tray_id: Optional[int] = None

class ShipmentCreate(ShipmentBase):
    pass

class ShipmentUpdate(BaseModel):
    product_name: Optional[str] = None
    customer_name: Optional[str] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    temp_limit: Optional[float] = None
    temp_safe_min: Optional[float] = None
    forecast_horizon_minutes: Optional[int] = None
    status: Optional[str] = None
    risk_level: Optional[str] = None
    ble_device_id: Optional[int] = None
    tray_id: Optional[int] = None

class ShipmentOut(ShipmentBase):
    id: int
    status: str
    risk_level: str
    created_at: datetime
    updated_at: datetime
    ble_device: Optional[BLEDeviceOut] = None
    tray: Optional[TrayOut] = None
    current_temperature: Optional[float] = None
    current_battery: Optional[float] = None
    last_reading_time: Optional[datetime] = None
    latest_forecast: Optional[TemperatureForecastOut] = None

    class Config:
        from_attributes = True

class DashboardOverviewOut(BaseModel):
    active_shipments_count: int
    normal_count: int
    at_risk_count: int
    protected_count: int
    online_gateways_count: int
    online_devices_count: int
    active_alerts_count: int
    shipments: List[ShipmentOut]
