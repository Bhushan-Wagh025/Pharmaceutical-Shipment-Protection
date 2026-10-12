import enum
from datetime import datetime
from sqlalchemy import Column, Integer, Float, String, Boolean, DateTime, ForeignKey, Enum, Text
from sqlalchemy.orm import relationship
from app.database import Base

class GatewayStatus(str, enum.Enum):
    ONLINE = "ONLINE"
    OFFLINE = "OFFLINE"
    MAINTENANCE = "MAINTENANCE"

class BLEDeviceStatus(str, enum.Enum):
    ONLINE = "ONLINE"
    OFFLINE = "OFFLINE"
    LOW_BATTERY = "LOW_BATTERY"

class TrayState(str, enum.Enum):
    EXTENDED = "EXTENDED"
    MOVING_IN = "MOVING_IN"
    PROTECTED = "PROTECTED"
    MOVING_OUT = "MOVING_OUT"
    ERROR = "ERROR"

class ShipmentStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    NORMAL = "NORMAL"
    AT_RISK = "AT_RISK"
    PROTECTED = "PROTECTED"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"

class Site(Base):
    __tablename__ = "sites"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    code = Column(String(50), nullable=False, unique=True)
    location = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    company = relationship("Company", back_populates="sites")
    stations = relationship("Station", back_populates="site", cascade="all, delete-orphan")

class Station(Base):
    __tablename__ = "stations"

    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    station_code = Column(String(50), nullable=False, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    site = relationship("Site", back_populates="stations")
    gateways = relationship("Gateway", back_populates="station")
    trays = relationship("Tray", back_populates="station")

class Gateway(Base):
    __tablename__ = "gateways"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="SET NULL"), nullable=True)
    station_id = Column(Integer, ForeignKey("stations.id", ondelete="SET NULL"), nullable=True)
    gateway_eui = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    ip_address = Column(String(50), nullable=True)
    status = Column(Enum(GatewayStatus), default=GatewayStatus.ONLINE)
    last_seen_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    station = relationship("Station", back_populates="gateways")

class BLEDevice(Base):
    __tablename__ = "ble_devices"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="SET NULL"), nullable=True)
    device_mac = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    battery_level = Column(Float, default=98.5)
    status = Column(Enum(BLEDeviceStatus), default=BLEDeviceStatus.ONLINE)
    last_seen_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    shipments = relationship("Shipment", back_populates="ble_device")
    temperature_readings = relationship("TemperatureReading", back_populates="device")

class Tray(Base):
    __tablename__ = "trays"

    id = Column(Integer, primary_key=True, index=True)
    station_id = Column(Integer, ForeignKey("stations.id", ondelete="SET NULL"), nullable=True)
    tray_code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    state = Column(Enum(TrayState), default=TrayState.EXTENDED)
    position_percentage = Column(Float, default=0.0) # 0% = EXTENDED, 100% = PROTECTED
    temp_cold_pack = Column(Float, default=2.5) # Chamber cold pack temp
    target_temp = Column(Float, default=4.0)
    last_moved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    station = relationship("Station", back_populates="trays")
    shipments = relationship("Shipment", back_populates="tray")
    tray_events = relationship("TrayEvent", back_populates="tray", cascade="all, delete-orphan")
    protection_actions = relationship("ProtectionAction", back_populates="tray")

class Shipment(Base):
    __tablename__ = "shipments"

    id = Column(Integer, primary_key=True, index=True)
    shipment_code = Column(String(100), unique=True, nullable=False, index=True)
    package_id = Column(String(100), nullable=False, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    product_name = Column(String(255), nullable=False)
    batch_number = Column(String(100), nullable=False)
    customer_name = Column(String(255), nullable=False)
    origin = Column(String(255), nullable=False)
    destination = Column(String(255), nullable=False)
    
    # Temperature thresholds
    temp_limit = Column(Float, default=8.0, nullable=False)
    temp_safe_min = Column(Float, default=2.0, nullable=False)
    forecast_horizon_minutes = Column(Integer, default=15, nullable=False)
    
    status = Column(Enum(ShipmentStatus), default=ShipmentStatus.NORMAL)
    risk_level = Column(String(50), default="LOW")
    
    ble_device_id = Column(Integer, ForeignKey("ble_devices.id", ondelete="SET NULL"), nullable=True)
    tray_id = Column(Integer, ForeignKey("trays.id", ondelete="SET NULL"), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    company = relationship("Company", back_populates="shipments")
    ble_device = relationship("BLEDevice", back_populates="shipments")
    tray = relationship("Tray", back_populates="shipments")
    readings = relationship("TemperatureReading", back_populates="shipment", cascade="all, delete-orphan")
    forecasts = relationship("TemperatureForecast", back_populates="shipment", cascade="all, delete-orphan")
    risk_events = relationship("RiskEvent", back_populates="shipment", cascade="all, delete-orphan")
    tray_events = relationship("TrayEvent", back_populates="shipment")
    protection_actions = relationship("ProtectionAction", back_populates="shipment")
    alerts = relationship("Alert", back_populates="shipment", cascade="all, delete-orphan")
