from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr

class Token(BaseModel):
    access_token: str
    token_type: str
    expires_in: int
    user: "UserOut"

class TokenPayload(BaseModel):
    sub: Optional[str] = None
    role: Optional[str] = None
    company_id: Optional[int] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    is_active: bool = True
    company_id: Optional[int] = None
    role_id: int

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None
    role_id: Optional[int] = None
    company_id: Optional[int] = None

class RoleOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None

    class Config:
        from_attributes = True

class CompanyOut(BaseModel):
    id: int
    name: str
    code: str
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True

class UserOut(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    is_active: bool
    company_id: Optional[int] = None
    role_id: int
    role: Optional[RoleOut] = None
    company: Optional[CompanyOut] = None
    created_at: datetime
    last_login_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class CompanyCreate(BaseModel):
    name: str
    code: str
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    is_active: bool = True
