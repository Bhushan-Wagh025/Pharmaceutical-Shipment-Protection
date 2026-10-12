import json
import uuid
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.logistics import Gateway, GatewayStatus, BLEDevice, BLEDeviceStatus
from app.models.auth import User, RoleEnum
from app.schemas.shipment import GatewayOut, GatewayCreate, GatewayUpdate
from app.services.auth_service import get_current_user
from app.services.ssrf_validator import validate_gateway_url
from app.services.encryption_service import encrypt_credential, mask_credential
from app.services.audit_service import AuditService
from app.adapters.factory import get_gateway_adapter

logger = logging.getLogger("pharma.gateways_api")
router = APIRouter(prefix="/gateways", tags=["Gateways"])

def _format_gateway_out(gw: Gateway) -> GatewayOut:
    gw_dict = {c.name: getattr(gw, c.name) for c in gw.__table__.columns}
    masked = mask_credential(gw.api_key_encrypted)
    gw_dict["api_key_masked"] = masked
    gw_dict["api_key"] = masked
    gw_dict["gateway_identifier"] = gw.gateway_eui
    return GatewayOut(**gw_dict)

def _check_gateway_access(gw: Gateway, current_user: User):
    if not current_user:
        return
    role_name = current_user.role.name if current_user.role else ""
    if role_name == RoleEnum.SUPER_ADMIN.value:
        return
    if current_user.company_id and gw.company_id and gw.company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Gateway belongs to another company."
        )

@router.get("", response_model=List[GatewayOut])
def get_gateways(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Gateway)
    if current_user and current_user.company_id:
        role_name = current_user.role.name if current_user.role else ""
        if role_name != RoleEnum.SUPER_ADMIN.value:
            query = query.filter(Gateway.company_id == current_user.company_id)
            
    gateways = query.order_by(Gateway.id.asc()).all()
    return [_format_gateway_out(gw) for gw in gateways]

@router.post("", response_model=GatewayOut)
def create_gateway(
    payload: GatewayCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Validate existing EUI
    existing = db.query(Gateway).filter(Gateway.gateway_eui == payload.gateway_eui).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Gateway EUI '{payload.gateway_eui}' already registered")

    # SSRF URL Validation
    target_host = payload.host_url or payload.ip_address
    if target_host:
        is_safe, error_msg = validate_gateway_url(target_host)
        if not is_safe:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Security Validation Error: {error_msg}"
            )

    # Secure credential encryption
    encrypted_key = encrypt_credential(payload.api_key) if payload.api_key else None

    # Multi-tenant assignment
    company_id = payload.company_id
    if current_user and current_user.company_id:
        role_name = current_user.role.name if current_user.role else ""
        if role_name != RoleEnum.SUPER_ADMIN.value:
            company_id = current_user.company_id

    gw_eui = payload.gateway_eui or payload.gateway_identifier or f"GW-{uuid.uuid4().hex[:8].upper()}"
    gw = Gateway(
        gateway_eui=gw_eui,
        name=payload.name,
        ip_address=payload.ip_address,
        host_url=payload.host_url,
        api_base_path=payload.api_base_path or "/api/v1",
        auth_method=payload.auth_method or "NONE",
        api_key_encrypted=encrypted_key,
        polling_interval=payload.polling_interval or 5,
        timeout_seconds=payload.timeout_seconds or 5,
        is_enabled=payload.is_enabled if payload.is_enabled is not None else True,
        verify_ssl=payload.verify_ssl if payload.verify_ssl is not None else True,
        tls_certificate=payload.tls_certificate,
        adapter_type=payload.adapter_type or "GAO_BLE",
        status=GatewayStatus.ONLINE,
        company_id=company_id,
        station_id=payload.station_id,
        created_at=datetime.utcnow()
    )
    db.add(gw)
    db.commit()
    db.refresh(gw)

    AuditService.log(
        db=db,
        action="GATEWAY_CREATED",
        resource_type="GATEWAY",
        resource_id=str(gw.id),
        details=f"Gateway {gw.name} ({gw.gateway_eui}) registered by {current_user.email if current_user else 'system'}",
        user=current_user
    )

    return _format_gateway_out(gw)

@router.get("/{id}", response_model=GatewayOut)
def get_gateway(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    gw = db.query(Gateway).filter(Gateway.id == id).first()
    if not gw:
        raise HTTPException(status_code=404, detail="Gateway not found")
    _check_gateway_access(gw, current_user)
    return _format_gateway_out(gw)

@router.put("/{id}", response_model=GatewayOut)
def update_gateway(
    id: int,
    payload: GatewayUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    gw = db.query(Gateway).filter(Gateway.id == id).first()
    if not gw:
        raise HTTPException(status_code=404, detail="Gateway not found")
    _check_gateway_access(gw, current_user)

    # Validate URL if changed
    if payload.host_url:
        is_safe, error_msg = validate_gateway_url(payload.host_url)
        if not is_safe:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Security Validation Error: {error_msg}"
            )
        gw.host_url = payload.host_url

    if payload.name is not None:
        gw.name = payload.name
    if payload.gateway_eui is not None:
        gw.gateway_eui = payload.gateway_eui
    if payload.api_base_path is not None:
        gw.api_base_path = payload.api_base_path
    if payload.auth_method is not None:
        gw.auth_method = payload.auth_method
    if payload.polling_interval is not None:
        gw.polling_interval = payload.polling_interval
    if payload.timeout_seconds is not None:
        gw.timeout_seconds = payload.timeout_seconds
    if payload.is_enabled is not None:
        gw.is_enabled = payload.is_enabled
    if payload.verify_ssl is not None:
        gw.verify_ssl = payload.verify_ssl
    if payload.tls_certificate is not None:
        gw.tls_certificate = payload.tls_certificate
    if payload.adapter_type is not None:
        gw.adapter_type = payload.adapter_type
    if payload.station_id is not None:
        gw.station_id = payload.station_id

    # If new API key submitted and not masked
    if payload.api_key and not payload.api_key.startswith("•"):
        gw.api_key_encrypted = encrypt_credential(payload.api_key)

    gw.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(gw)

    AuditService.log(
        db=db,
        action="GATEWAY_UPDATED",
        resource_type="GATEWAY",
        resource_id=str(gw.id),
        details=f"Gateway {gw.name} updated",
        user=current_user
    )

    return _format_gateway_out(gw)

@router.post("/{id}/test-connection")
def test_gateway_connection(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    gw = db.query(Gateway).filter(Gateway.id == id).first()
    if not gw:
        raise HTTPException(status_code=404, detail="Gateway not found")
    _check_gateway_access(gw, current_user)

    adapter = get_gateway_adapter(gw)
    result = adapter.test_connection()
    result["connected"] = result.get("success", False)

    if result.get("success"):
        gw.status = GatewayStatus.ONLINE
        gw.last_communication_at = datetime.utcnow()
        gw.last_seen_at = datetime.utcnow()
        gw.last_error = None
    else:
        gw.status = GatewayStatus.OFFLINE
        gw.last_error = result.get("error")

    db.commit()

    AuditService.log(
        db=db,
        action="GATEWAY_CONNECTION_TEST",
        resource_type="GATEWAY",
        resource_id=str(gw.id),
        details=f"Gateway connection test: success={result.get('success')}, latency={result.get('latency_ms')}ms",
        user=current_user
    )

    return result

@router.post("/{id}/discover-devices")
def discover_gateway_devices(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    gw = db.query(Gateway).filter(Gateway.id == id).first()
    if not gw:
        raise HTTPException(status_code=404, detail="Gateway not found")
    _check_gateway_access(gw, current_user)

    adapter = get_gateway_adapter(gw)
    devices = adapter.discover_devices()

    # Sync discovered devices into DB
    added_count = 0
    for dev in devices:
        mac = dev.get("device_mac")
        if not mac:
            continue
        existing_dev = db.query(BLEDevice).filter(BLEDevice.device_mac == mac).first()
        if not existing_dev:
            new_dev = BLEDevice(
                device_mac=mac,
                name=dev.get("name", "BLE Environmental Sensor"),
                battery_level=dev.get("battery", 95.0),
                status=BLEDeviceStatus.ONLINE,
                company_id=gw.company_id,
                last_seen_at=datetime.utcnow()
            )
            db.add(new_dev)
            added_count += 1
        else:
            existing_dev.last_seen_at = datetime.utcnow()
            if dev.get("battery") is not None:
                existing_dev.battery_level = dev.get("battery")

    db.commit()

    AuditService.log(
        db=db,
        action="BLE_DEVICES_DISCOVERED",
        resource_type="GATEWAY",
        resource_id=str(gw.id),
        details=f"Discovered {len(devices)} BLE devices (newly registered: {added_count})",
        user=current_user
    )

    return {
        "success": True,
        "gateway_id": gw.id,
        "count": len(devices),
        "devices": devices
    }

@router.post("/{id}/start-monitoring")
def start_gateway_monitoring(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    gw = db.query(Gateway).filter(Gateway.id == id).first()
    if not gw:
        raise HTTPException(status_code=404, detail="Gateway not found")
    _check_gateway_access(gw, current_user)

    gw.is_monitoring = True
    gw.status = GatewayStatus.ONLINE
    gw.last_communication_at = datetime.utcnow()
    db.commit()

    AuditService.log(
        db=db,
        action="GATEWAY_MONITORING_STARTED",
        resource_type="GATEWAY",
        resource_id=str(gw.id),
        details=f"Monitoring started for gateway {gw.name}",
        user=current_user
    )

    return {"message": "Gateway monitoring started", "is_monitoring": True}

@router.post("/{id}/stop-monitoring")
def stop_gateway_monitoring(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    gw = db.query(Gateway).filter(Gateway.id == id).first()
    if not gw:
        raise HTTPException(status_code=404, detail="Gateway not found")
    _check_gateway_access(gw, current_user)

    gw.is_monitoring = False
    db.commit()

    AuditService.log(
        db=db,
        action="GATEWAY_MONITORING_STOPPED",
        resource_type="GATEWAY",
        resource_id=str(gw.id),
        details=f"Monitoring stopped for gateway {gw.name}",
        user=current_user
    )

    return {"message": "Gateway monitoring stopped", "is_monitoring": False}

@router.get("/{id}/status")
def get_gateway_status(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    gw = db.query(Gateway).filter(Gateway.id == id).first()
    if not gw:
        raise HTTPException(status_code=404, detail="Gateway not found")
    _check_gateway_access(gw, current_user)

    adapter = get_gateway_adapter(gw)
    status_info = adapter.get_status()

    # Query active devices in DB
    devices = (
        db.query(BLEDevice)
        .filter(BLEDevice.company_id == gw.company_id if gw.company_id else True)
        .all()
    )
    devices_data = [
        {
            "device_mac": d.device_mac,
            "name": d.name,
            "battery": d.battery_level,
            "status": d.status.value if hasattr(d.status, 'value') else str(d.status),
            "last_seen": d.last_seen_at.isoformat() if d.last_seen_at else None
        }
        for d in devices
    ]

    # Parse last reading data if available
    last_reading = None
    if gw.last_reading_data:
        try:
            last_reading = json.loads(gw.last_reading_data)
        except Exception:
            last_reading = {"raw": gw.last_reading_data}

    return {
        "gateway_id": gw.id,
        "name": gw.name,
        "gateway_eui": gw.gateway_eui,
        "connected": gw.status == GatewayStatus.ONLINE,
        "status": gw.status.value if hasattr(gw.status, 'value') else str(gw.status),
        "is_monitoring": gw.is_monitoring,
        "last_communication": gw.last_communication_at.isoformat() if gw.last_communication_at else None,
        "last_error": gw.last_error,
        "troubleshooting": status_info.get("troubleshooting"),
        "last_reading": last_reading,
        "discovered_devices": devices_data
    }
