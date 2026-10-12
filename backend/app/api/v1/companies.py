from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.auth import Company
from app.schemas.auth import CompanyOut, CompanyCreate

router = APIRouter(prefix="/companies", tags=["Companies"])

@router.get("", response_model=List[CompanyOut])
def get_companies(db: Session = Depends(get_db)):
    return db.query(Company).order_by(Company.id.asc()).all()

@router.post("", response_model=CompanyOut)
def create_company(payload: CompanyCreate, db: Session = Depends(get_db)):
    existing = db.query(Company).filter(Company.code == payload.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Company code already exists")
    comp = Company(
        name=payload.name,
        code=payload.code,
        contact_email=payload.contact_email,
        contact_phone=payload.contact_phone,
        is_active=payload.is_active
    )
    db.add(comp)
    db.commit()
    db.refresh(comp)
    return comp
