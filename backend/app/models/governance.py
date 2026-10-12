import enum
from datetime import datetime
from sqlalchemy import Column, Integer, Float, String, Boolean, DateTime, ForeignKey, Enum, Text
from sqlalchemy.orm import relationship
from app.database import Base

class AlertType(str, enum.Enum):
    TEMP_WARNING = "TEMP_WARNING"
    PREDICTED_EXCURSION = "PREDICTED_EXCURSION"
    PROTECTION_TRIGGERED = "PROTECTION_TRIGGERED"
    PROTECTION_SUCCESSFUL = "PROTECTION_SUCCESSFUL"
    TRAY_FAILURE = "TRAY_FAILURE"
    SENSOR_OFFLINE = "SENSOR_OFFLINE"

class AlertSeverity(str, enum.Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    shipment_id = Column(Integer, ForeignKey("shipments.id", ondelete="CASCADE"), nullable=True, index=True)
    alert_type = Column(String(50), nullable=False, index=True)
    severity = Column(String(20), default="INFO", index=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    is_acknowledged = Column(Boolean, default=False, index=True)
    acknowledged_by = Column(String(255), nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    shipment = relationship("Shipment", back_populates="alerts")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    user_email = Column(String(255), nullable=True)
    action = Column(String(100), nullable=False, index=True)
    resource_type = Column(String(100), nullable=False, index=True)
    resource_id = Column(String(100), nullable=True)
    details = Column(Text, nullable=True)
    ip_address = Column(String(50), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    user = relationship("User", back_populates="audit_logs")

class SystemSetting(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(String(255), nullable=False)
    description = Column(String(255), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
