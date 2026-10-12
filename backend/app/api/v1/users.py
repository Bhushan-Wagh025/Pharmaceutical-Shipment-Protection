from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.auth import User, Role
from app.schemas.auth import UserOut, UserCreate, UserUpdate, RoleOut
from app.services.auth_service import get_password_hash, get_current_user, require_roles

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("", response_model=List[UserOut])
def get_users(db: Session = Depends(get_db)):
    return db.query(User).order_by(User.id.asc()).all()

@router.get("/roles", response_model=List[RoleOut])
def get_roles(db: Session = Depends(get_db)):
    return db.query(Role).all()

@router.post("", response_model=UserOut)
def create_user(
    payload: UserCreate, 
    db: Session = Depends(get_db)
):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    new_user = User(
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=get_password_hash(payload.password),
        is_active=payload.is_active,
        company_id=payload.company_id,
        role_id=payload.role_id
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.put("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int, 
    payload: UserUpdate, 
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.password:
        user.hashed_password = get_password_hash(payload.password)
    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.role_id is not None:
        user.role_id = payload.role_id
    if payload.company_id is not None:
        user.company_id = payload.company_id

    db.commit()
    db.refresh(user)
    return user
