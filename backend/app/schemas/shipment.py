from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
from app.schemas.telemetry import TemperatureReadingOut, TemperatureForecastOut
from app.schemas.tray import TrayOut

class GatewayBase(BaseModel):
    name: str
    gateway_eui: Optional[str] = None
    gateway_identifier: Optional[str] = None
    ip_address: Optional[str] = None
    host_url: Optional[str] = None
    api_base_path: str = "/api/v1"
    auth_method: str = "NONE" # NONE, API_KEY, BEARER_TOKEN, BASIC
    polling_interval: int = 5
    timeout_seconds: int = 5
    is_enabled: bool = True
    verify_ssl: bool = True
    tls_certificate: Optional[str] = None
    adapter_type: str = "GAO_BLE"
    status: str = "ONLINE"
    company_id: Optional[int] = None
    station_id: Optional[int] = None

class GatewayCreate(GatewayBase):
    api_key: Optional[str] = None

class GatewayUpdate(BaseModel):
    name: Optional[str] = None
    gateway_eui: Optional[str] = None
    host_url: Optional[str] = None
    api_base_path: Optional[str] = None
    auth_method: Optional[str] = None
    api_key: Optional[str] = None
    polling_interval: Optional[int] = None
    timeout_seconds: Optional[int] = None
    is_enabled: Optional[bool] = None
    verify_ssl: Optional[bool] = None
    tls_certificate: Optional[str] = None
    adapter_type: Optional[str] = None
    status: Optional[str] = None
    station_id: Optional[int] = None

class GatewayOut(GatewayBase):
    id: int
    api_key_masked: Optional[str] = None
    api_key: Optional[str] = None
    is_monitoring: bool = False
    last_error: Optional[str] = None
    last_communication_at: Optional[datetime] = None
    last_reading_data: Optional[str] = None
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
