from typing import List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.logistics import BLEDevice, BLEDeviceStatus
from app.schemas.shipment import BLEDeviceOut, BLEDeviceCreate

router = APIRouter(prefix="/devices", tags=["BLE Devices"])

@router.get("", response_model=List[BLEDeviceOut])
def get_devices(db: Session = Depends(get_db)):
    return db.query(BLEDevice).order_by(BLEDevice.id.asc()).all()

@router.post("", response_model=BLEDeviceOut)
def create_device(payload: BLEDeviceCreate, db: Session = Depends(get_db)):
    existing = db.query(BLEDevice).filter(BLEDevice.device_mac == payload.device_mac).first()
    if existing:
        raise HTTPException(status_code=400, detail="BLE device MAC already registered")
    
    dev = BLEDevice(
        device_mac=payload.device_mac,
        name=payload.name,
        battery_level=payload.battery_level,
        status=BLEDeviceStatus.ONLINE,
        company_id=payload.company_id
    )
    db.add(dev)
    db.commit()
    db.refresh(dev)
    return dev
