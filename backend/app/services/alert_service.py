import logging
from datetime import datetime, timedelta
from typing import Optional, List
from sqlalchemy.orm import Session
from app.models.governance import Alert, AlertType, AlertSeverity

logger = logging.getLogger("pharma.alerts")

class AlertService:
    @staticmethod
    def create_alert(
        db: Session,
        alert_type: str,
        severity: str,
        title: str,
        message: str,
        shipment_id: Optional[int] = None,
        suppress_duplicate_seconds: int = 45
    ) -> Optional[Alert]:
        # Check if an identical unacknowledged alert was recently created for this shipment
        cutoff = datetime.utcnow() - timedelta(seconds=suppress_duplicate_seconds)
        existing = (
            db.query(Alert)
            .filter(
                Alert.shipment_id == shipment_id,
                Alert.alert_type == alert_type,
                Alert.created_at >= cutoff,
                Alert.is_acknowledged == False
            )
            .first()
        )
        if existing:
            # Suppress flood of identical alerts
            return None

        alert = Alert(
            shipment_id=shipment_id,
            alert_type=alert_type,
            severity=severity,
            title=title,
            message=message,
            is_acknowledged=False,
            created_at=datetime.utcnow()
        )
        db.add(alert)
        db.commit()
        db.refresh(alert)
        logger.warning(f"ALERT CREATED: [{severity}] {title} - {message}")
        return alert

    @staticmethod
    def acknowledge_alert(db: Session, alert_id: int, user_email: str) -> Optional[Alert]:
        alert = db.query(Alert).filter(Alert.id == alert_id).first()
        if alert:
            alert.is_acknowledged = True
            alert.acknowledged_by = user_email
            alert.acknowledged_at = datetime.utcnow()
            db.commit()
            db.refresh(alert)
        return alert
