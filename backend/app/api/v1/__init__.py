from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.companies import router as companies_router
from app.api.v1.users import router as users_router
from app.api.v1.shipments import router as shipments_router
from app.api.v1.devices import router as devices_router
from app.api.v1.gateways import router as gateways_router
from app.api.v1.temperature import router as temperature_router
from app.api.v1.forecast import router as forecast_router
from app.api.v1.risk import router as risk_router
from app.api.v1.trays import router as trays_router
from app.api.v1.protection import router as protection_router
from app.api.v1.alerts import router as alerts_router
from app.api.v1.reports import router as reports_router
from app.api.v1.audit import router as audit_router
from app.api.v1.simulator import router as simulator_router

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(companies_router)
api_router.include_router(users_router)
api_router.include_router(shipments_router)
api_router.include_router(devices_router)
api_router.include_router(gateways_router)
api_router.include_router(temperature_router)
api_router.include_router(forecast_router)
api_router.include_router(risk_router)
api_router.include_router(trays_router)
api_router.include_router(protection_router)
api_router.include_router(alerts_router)
api_router.include_router(reports_router)
api_router.include_router(audit_router)
api_router.include_router(simulator_router)
