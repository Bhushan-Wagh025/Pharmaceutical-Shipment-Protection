import os
from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "B2B Pharmaceutical Shipment Protection AIoT System"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "postgresql://postgres:postgres@localhost:5432/pharma_protection"
    )
    SQLITE_FALLBACK_URL: str = "sqlite:///./pharma_protection.db"
    ENABLE_SQLITE_FALLBACK: bool = True
    
    # JWT & Auth
    SECRET_KEY: str = os.getenv("SECRET_KEY", "b2b-pharma-shipment-super-secret-key-2026-safe-production-jwt-token")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 # 24 hours
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "*"
    ]
    
    # AIoT Threshold Defaults
    DEFAULT_TEMP_SAFE: float = 5.5
    DEFAULT_TEMP_LIMIT: float = 8.0
    DEFAULT_FORECAST_HORIZON_MINUTES: int = 15
    DEFAULT_COOLING_TARGET: float = 4.2
    
    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()
