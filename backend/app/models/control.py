import enum
from datetime import datetime
from sqlalchemy import Column, Integer, Float, String, Boolean, DateTime, ForeignKey, Enum, Text
from sqlalchemy.orm import relationship
from app.database import Base

class ProtectionDecision(str, enum.Enum):
    TRIGGER_PROTECTION = "TRIGGER_PROTECTION"
    MONITOR = "MONITOR"
    RESTORE_POSITION = "RESTORE_POSITION"

class ProtectionResult(str, enum.Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"

class TrayEvent(Base):
    __tablename__ = "tray_events"

    id = Column(Integer, primary_key=True, index=True)
    tray_id = Column(Integer, ForeignKey("trays.id", ondelete="CASCADE"), nullable=False, index=True)
    shipment_id = Column(Integer, ForeignKey("shipments.id", ondelete="SET NULL"), nullable=True, index=True)
    from_state = Column(String(50), nullable=False)
    to_state = Column(String(50), nullable=False)
    initiated_by = Column(String(100), default="AI_DECISION_ENGINE")
    reason = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    tray = relationship("Tray", back_populates="tray_events")
    shipment = relationship("Shipment", back_populates="tray_events")

class ProtectionAction(Base):
    __tablename__ = "protection_actions"

    id = Column(Integer, primary_key=True, index=True)
    shipment_id = Column(Integer, ForeignKey("shipments.id", ondelete="CASCADE"), nullable=False, index=True)
    tray_id = Column(Integer, ForeignKey("trays.id", ondelete="SET NULL"), nullable=True, index=True)
    prediction_temp = Column(Float, nullable=False)
    threshold = Column(Float, nullable=False)
    reason = Column(String(255), nullable=False)
    decision = Column(String(50), default="TRIGGER_PROTECTION")
    result = Column(String(50), default="SUCCESS")
    cooling_verified = Column(Boolean, default=False)
    recovery_temp = Column(Float, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    shipment = relationship("Shipment", back_populates="protection_actions")
    tray = relationship("Tray", back_populates="protection_actions")
