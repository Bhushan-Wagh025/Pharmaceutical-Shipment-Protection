from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.governance import AuditLog
from app.schemas.alert import AuditLogOut

router = APIRouter(prefix="/audit", tags=["Regulatory Audit Logs"])

@router.get("", response_model=List[AuditLogOut])
def get_audit_logs(
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    user_email: Optional[str] = None,
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    query = db.query(AuditLog)
    if action:
        query = query.filter(AuditLog.action == action)
    if resource_type:
        query = query.filter(AuditLog.resource_type == resource_type)
    if user_email:
        query = query.filter(AuditLog.user_email == user_email)
    return query.order_by(AuditLog.timestamp.desc()).limit(limit).all()
