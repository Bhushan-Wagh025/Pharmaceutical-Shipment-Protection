import enum
from datetime import datetime
from sqlalchemy import Column, Integer, Float, String, Boolean, DateTime, ForeignKey, Enum, Text
from sqlalchemy.orm import relationship
from app.database import Base

class RiskLevel(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class TemperatureReading(Base):
    __tablename__ = "temperature_readings"

    id = Column(Integer, primary_key=True, index=True)
    shipment_id = Column(Integer, ForeignKey("shipments.id", ondelete="CASCADE"), nullable=False, index=True)
    device_id = Column(Integer, ForeignKey("ble_devices.id", ondelete="SET NULL"), nullable=True, index=True)
    gateway_id = Column(Integer, ForeignKey("gateways.id", ondelete="SET NULL"), nullable=True, index=True)
    temperature = Column(Float, nullable=False)
    battery = Column(Float, default=95.0)
    humidity = Column(Float, default=45.0)
    signal_rssi = Column(Integer, default=-65)
    data_source = Column(String(50), default="SIMULATED", index=True) # LIVE, SIMULATED
    validation_status = Column(String(50), default="VALID", index=True) # VALID, OUT_OF_RANGE, STALE, DUPLICATE
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    server_timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    shipment = relationship("Shipment", back_populates="readings")
    device = relationship("BLEDevice", back_populates="temperature_readings")

class TemperatureForecast(Base):
    __tablename__ = "temperature_forecasts"

    id = Column(Integer, primary_key=True, index=True)
    shipment_id = Column(Integer, ForeignKey("shipments.id", ondelete="CASCADE"), nullable=False, index=True)
    current_temp = Column(Float, nullable=False)
    predicted_temp = Column(Float, nullable=False)
    horizon_minutes = Column(Integer, nullable=False)
    risk_level = Column(String(50), default="LOW")
    will_cross_limit = Column(Boolean, default=False)
    time_to_cross_seconds = Column(Float, nullable=True) # Seconds until limit is crossed
    confidence = Column(Float, default=0.95)
    slope_c_per_min = Column(Float, default=0.0)
    model_type = Column(String(100), default="scikit-learn-linear-polynomial")
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    shipment = relationship("Shipment", back_populates="forecasts")

class RiskEvent(Base):
    __tablename__ = "risk_events"

    id = Column(Integer, primary_key=True, index=True)
    shipment_id = Column(Integer, ForeignKey("shipments.id", ondelete="CASCADE"), nullable=False, index=True)
    risk_level = Column(String(50), nullable=False)
    trigger_factor = Column(String(255), nullable=False)
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    shipment = relationship("Shipment", back_populates="risk_events")
