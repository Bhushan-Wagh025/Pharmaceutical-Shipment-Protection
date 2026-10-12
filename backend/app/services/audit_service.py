import logging
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from app.models.governance import AuditLog

logger = logging.getLogger("pharma.audit")

class AuditService:
    @staticmethod
    def log(
        db: Session,
        action: str,
        resource_type: str,
        resource_id: Optional[str] = None,
        details: Optional[str] = None,
        user_id: Optional[int] = None,
        user_email: Optional[str] = "system.decision.engine@pharmaprotect.io",
        ip_address: Optional[str] = "127.0.0.1"
    ) -> AuditLog:
        entry = AuditLog(
            user_id=user_id,
            user_email=user_email,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details,
            ip_address=ip_address,
            timestamp=datetime.utcnow()
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)
        logger.info(f"AUDIT LOG [{action}] on {resource_type}:{resource_id} - {details}")
        return entry
