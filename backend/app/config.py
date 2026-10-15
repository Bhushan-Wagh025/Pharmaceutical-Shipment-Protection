import os
from pathlib import Path
from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings

_ROOT_DIR = Path(__file__).resolve().parent.parent.parent
_SQLITE_PATH = (_ROOT_DIR / "pharma_protection.db").as_posix()

class Settings(BaseSettings):
    PROJECT_NAME: str = "B2B Pharmaceutical Shipment Protection AIoT System"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "postgresql://postgres:postgres@localhost:5432/pharma_protection"
    )
    SQLITE_FALLBACK_URL: str = os.getenv("SQLITE_FALLBACK_URL", f"sqlite:///{_SQLITE_PATH}")
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

    @field_validator("CORS_ORIGINS", mode="before")
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            if v.startswith("["):
                import json
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [x.strip() for x in v.split(",") if x.strip()]
        return v
    
    # AIoT Threshold Defaults
    DEFAULT_TEMP_SAFE: float = 5.5
    DEFAULT_TEMP_LIMIT: float = 8.0
    DEFAULT_FORECAST_HORIZON_MINUTES: int = 15
    DEFAULT_COOLING_TARGET: float = 4.2
    
    # Gateway Security & SSRF
    ALLOW_PRIVATE_GATEWAY_IPS: bool = os.getenv("ALLOW_PRIVATE_GATEWAY_IPS", "true").lower() in ("true", "1", "yes")
    GATEWAY_ENCRYPTION_KEY: str = os.getenv("GATEWAY_ENCRYPTION_KEY", "b2b-gateway-secret-enc-key-32ch")
    STALE_TELEMETRY_THRESHOLD_MINUTES: int = 5
    
    # External Cloud Hardware Simulator & Dummy Data API
    CLOUD_DUMMY_API_URL: str = os.getenv(
        "CLOUD_DUMMY_API_URL", 
        "https://ais-dev-q7bubcyu5drcfwewqploj4-579074576008.asia-southeast1.run.app"
    )
    CLOUD_DUMMY_WS_URL: str = os.getenv(
        "CLOUD_DUMMY_WS_URL",
        "wss://ais-dev-q7bubcyu5drcfwewqploj4-579074576008.asia-southeast1.run.app/ws/telemetry"
    )
    
    # Live Aperture BLE Gateway
    APERTURE_GATEWAY_URL: str = os.getenv(
        "APERTURE_GATEWAY_URL",
        "https://gateway.apertureventurestudio.com"
    )
    APERTURE_BLE_LATEST_ENDPOINT: str = "/api/v1/gateway/ble/telemetry/latest"
    APERTURE_BLE_HISTORY_ENDPOINT: str = "/api/v1/gateway/ble/telemetry/history"
    
    class Config:
        case_sensitive = True
        extra = "ignore"
        env_file = ".env"

settings = Settings()
