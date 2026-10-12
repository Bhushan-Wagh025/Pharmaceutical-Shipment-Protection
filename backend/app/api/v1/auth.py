from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.auth import User, Role
from app.schemas.auth import LoginRequest, Token, UserOut
from app.services.auth_service import verify_password, create_access_token, get_current_user
from app.services.audit_service import AuditService

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=Token)
def login(creds: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == creds.email).first()
    if not user or not verify_password(creds.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User account is deactivated")

    user.last_login_at = datetime.utcnow()
    db.commit()

    token_data = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role.name if user.role else "VIEWER",
        "company_id": user.company_id
    }
    access_token = create_access_token(token_data)

    AuditService.log(
        db=db,
        action="USER_LOGIN",
        resource_type="USER",
        resource_id=str(user.id),
        details=f"User {user.email} authenticated successfully.",
        user_id=user.id,
        user_email=user.email
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": 86400,
        "user": user
    }

@router.get("/me", response_model=UserOut)
def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user
