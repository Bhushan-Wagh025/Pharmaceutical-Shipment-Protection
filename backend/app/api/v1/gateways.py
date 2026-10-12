from typing import List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.logistics import Gateway, GatewayStatus
from app.schemas.shipment import GatewayOut, GatewayCreate

router = APIRouter(prefix="/gateways", tags=["Gateways"])

@router.get("", response_model=List[GatewayOut])
def get_gateways(db: Session = Depends(get_db)):
    return db.query(Gateway).order_by(Gateway.id.asc()).all()

@router.post("", response_model=GatewayOut)
def create_gateway(payload: GatewayCreate, db: Session = Depends(get_db)):
    existing = db.query(Gateway).filter(Gateway.gateway_eui == payload.gateway_eui).first()
    if existing:
        raise HTTPException(status_code=400, detail="Gateway EUI already registered")
    
    gw = Gateway(
        gateway_eui=payload.gateway_eui,
        name=payload.name,
        ip_address=payload.ip_address,
        status=GatewayStatus.ONLINE,
        company_id=payload.company_id,
        station_id=payload.station_id
    )
    db.add(gw)
    db.commit()
    db.refresh(gw)
    return gw
