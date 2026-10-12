import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.v1 import api_router
from app.websocket.manager import manager
from seed import seed_database

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("pharma.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure tables exist and seed default accounts & demo data
    logger.info("Initializing B2B Pharmaceutical Protection AIoT Platform...")
    try:
        seed_database(include_samples=False)
        logger.info("Database essentials initialized and verified.")
    except Exception as e:
        logger.error(f"Error during startup database initialization: {e}")
    yield
    logger.info("Shutting down AIoT application server...")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Enterprise B2B AIoT Cold-Chain Shipment Protection System with predictive excursion forecasting and motorized tray protection.",
    lifespan=lifespan
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all for local dev & docker
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API v1 router
app.include_router(api_router, prefix=settings.API_V1_STR)

from fastapi import Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.database import get_db

@app.get("/health")
@app.get("/api/v1/health")
def health_check(db: Session = Depends(get_db)):
    db_status = "connected"
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"unhealthy: {e}"

    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "database": db_status
    }

@app.get("/ready")
@app.get("/api/v1/ready")
def readiness_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ready", "database_connected": True}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database not ready: {e}")

# Real-time WebSocket endpoints
@app.websocket("/ws/shipments/{shipment_id}")
async def websocket_shipment_endpoint(websocket: WebSocket, shipment_id: str):
    await manager.connect(websocket, shipment_id)
    try:
        while True:
            # Keep-alive ping/pong
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket, shipment_id)
    except Exception as e:
        logger.warning(f"WebSocket error on shipment channel {shipment_id}: {e}")
        manager.disconnect(websocket, shipment_id)

@app.websocket("/ws/dashboard")
async def websocket_dashboard_endpoint(websocket: WebSocket):
    await manager.connect(websocket, "dashboard")
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket, "dashboard")
    except Exception as e:
        logger.warning(f"WebSocket error on dashboard channel: {e}")
        manager.disconnect(websocket, "dashboard")
