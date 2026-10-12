import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from app.database import get_db, SessionLocal
from app.models.logistics import Shipment, Tray, ShipmentStatus, TrayState
from app.models.telemetry import TemperatureReading, TemperatureForecast, RiskLevel
from app.simulator.temp_simulator import get_simulated_shipment
from app.simulator.tray_simulator import get_simulated_tray
from app.services.ai_forecast_service import AITemperatureForecaster
from app.services.decision_engine import decision_engine
from app.services.audit_service import AuditService
from app.websocket.manager import manager

logger = logging.getLogger("pharma.simulator_api")
router = APIRouter(prefix="/simulator", tags=["Demo Simulator Controls"])

# Background task tracking for auto-run mode
auto_run_tasks: Dict[int, bool] = {}

def execute_simulation_step_sync(shipment_id: int, db: Session, force_excursion: bool = False) -> Dict[str, Any]:
    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    tray = shipment.tray
    if not tray:
        tray = db.query(Tray).first()

    tray_sim = get_simulated_tray(tray.tray_code if tray else "TRAY-UNIT-A1")
    # Advance tray actuator
    tray_status = tray_sim.tick()
    if tray:
        tray.state = tray_sim.state
        tray.position_percentage = tray_sim.position_percentage
        db.commit()

    # Step thermal environment
    temp_sim = get_simulated_shipment(shipment.shipment_code)
    sim_data = temp_sim.step(tray_state=tray_sim.state, force_excursion=force_excursion)

    # Ingest reading to DB
    reading = TemperatureReading(
        shipment_id=shipment.id,
        device_id=shipment.ble_device_id,
        temperature=sim_data["temperature"],
        battery=sim_data["battery"],
        humidity=sim_data["humidity"],
        signal_rssi=sim_data["signal_rssi"],
        timestamp=datetime.utcnow()
    )
    db.add(reading)
    db.commit()
    db.refresh(reading)

    # Run AI Forecast
    forecast_data = AITemperatureForecaster.forecast_shipment_temperature(db, shipment)
    forecast_record = None
    if forecast_data:
        forecast_record = TemperatureForecast(
            shipment_id=shipment.id,
            current_temp=forecast_data["current_temp"],
            predicted_temp=forecast_data["predicted_temp"],
            horizon_minutes=forecast_data["horizon_minutes"],
            risk_level=forecast_data["risk_level"],
            will_cross_limit=forecast_data["will_cross_limit"],
            time_to_cross_seconds=forecast_data["time_to_cross_seconds"],
            confidence=forecast_data["confidence"],
            slope_c_per_min=forecast_data["slope_c_per_min"],
            model_type=forecast_data["model_type"],
            timestamp=datetime.utcnow()
        )
        db.add(forecast_record)
        shipment.risk_level = forecast_data["risk_level"]
        db.commit()

    # Run Decision Engine
    decision_result = decision_engine.evaluate_shipment(
        db=db,
        shipment=shipment,
        current_temp=reading.temperature,
        forecast=forecast_data
    )

    return {
        "shipment_id": shipment.id,
        "shipment_code": shipment.shipment_code,
        "temperature": reading.temperature,
        "battery": reading.battery,
        "tray_state": tray_sim.state,
        "tray_position": tray_sim.position_percentage,
        "forecast": forecast_data,
        "decision": decision_result,
        "risk_level": shipment.risk_level,
        "status": shipment.status.value if hasattr(shipment.status, 'value') else str(shipment.status),
        "step_count": sim_data["step_count"],
        "timestamp": reading.timestamp.isoformat()
    }

@router.post("/step/{shipment_id}")
async def step_simulation(shipment_id: int, db: Session = Depends(get_db)):
    result = execute_simulation_step_sync(shipment_id, db)
    # Broadcast to WebSocket
    await manager.broadcast_shipment_update(shipment_id, {
        "type": "SIMULATOR_STEP",
        **result
    })
    return result

@router.post("/trigger-excursion/{shipment_id}")
async def trigger_thermal_excursion(shipment_id: int, db: Session = Depends(get_db)):
    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    temp_sim = get_simulated_shipment(shipment.shipment_code)
    temp_sim.trigger_excursion()

    AuditService.log(
        db=db,
        action="SIMULATOR_TRIGGER_EXCURSION",
        resource_type="SIMULATOR",
        resource_id=str(shipment.id),
        details=f"Demo: Triggered rapid temperature rise excursion on {shipment.shipment_code}"
    )

    # Take an immediate step to show rapid rise
    result = execute_simulation_step_sync(shipment_id, db, force_excursion=True)
    await manager.broadcast_shipment_update(shipment_id, {
        "type": "SIMULATOR_EXCURSION_TRIGGERED",
        **result
    })
    return {"message": "Thermal excursion initiated", "step": result}

@router.post("/reset/{shipment_id}")
async def reset_simulation(shipment_id: int, db: Session = Depends(get_db)):
    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    # Stop any auto runner
    auto_run_tasks[shipment_id] = False

    # Reset simulator objects
    temp_sim = get_simulated_shipment(shipment.shipment_code)
    temp_sim.reset(initial_temp=5.5)

    tray = shipment.tray
    if not tray:
        tray = db.query(Tray).first()
    if tray:
        tray_sim = get_simulated_tray(tray.tray_code)
        tray_sim.reset()
        tray.state = TrayState.EXTENDED
        tray.position_percentage = 0.0

    shipment.status = ShipmentStatus.NORMAL
    shipment.risk_level = RiskLevel.LOW.value
    db.commit()

    # Clear excessive older readings for clean demonstration and add 5 seed baseline readings
    db.query(TemperatureReading).filter(TemperatureReading.shipment_id == shipment.id).delete()
    db.query(TemperatureForecast).filter(TemperatureForecast.shipment_id == shipment.id).delete()
    db.commit()

    import datetime as dt
    now = datetime.utcnow()
    baseline_temps = [5.42, 5.45, 5.48, 5.50, 5.52]
    for i, t in enumerate(baseline_temps):
        db.add(TemperatureReading(
            shipment_id=shipment.id,
            device_id=shipment.ble_device_id,
            temperature=t,
            battery=98.5,
            humidity=42.0,
            signal_rssi=-64,
            timestamp=now - dt.timedelta(seconds=(len(baseline_temps) - i) * 10)
        ))
    db.commit()

    # Calculate initial forecast
    forecast_data = AITemperatureForecaster.forecast_shipment_temperature(db, shipment)
    if forecast_data:
        db.add(TemperatureForecast(
            shipment_id=shipment.id,
            current_temp=forecast_data["current_temp"],
            predicted_temp=forecast_data["predicted_temp"],
            horizon_minutes=forecast_data["horizon_minutes"],
            risk_level=forecast_data["risk_level"],
            will_cross_limit=forecast_data["will_cross_limit"],
            time_to_cross_seconds=forecast_data["time_to_cross_seconds"],
            confidence=forecast_data["confidence"],
            slope_c_per_min=forecast_data["slope_c_per_min"],
            model_type=forecast_data["model_type"],
            timestamp=now
        ))
        db.commit()

    AuditService.log(
        db=db,
        action="SIMULATOR_RESET",
        resource_type="SIMULATOR",
        resource_id=str(shipment.id),
        details=f"Demo: Reset shipment {shipment.shipment_code} to safe baseline (5.5°C, EXTENDED)"
    )

    reset_payload = {
        "type": "SIMULATOR_RESET",
        "shipment_id": shipment.id,
        "temperature": 5.52,
        "tray_state": "EXTENDED",
        "tray_position": 0.0,
        "risk_level": "LOW",
        "status": "NORMAL",
        "message": "Demo reset to safe baseline (5.5°C)"
    }
    await manager.broadcast_shipment_update(shipment.id, reset_payload)

    return reset_payload

async def auto_run_worker(shipment_id: int):
    logger.info(f"Auto-run worker loop started for shipment {shipment_id}")
    while auto_run_tasks.get(shipment_id, False):
        db = SessionLocal()
        try:
            result = execute_simulation_step_sync(shipment_id, db)
            await manager.broadcast_shipment_update(shipment_id, {
                "type": "SIMULATOR_STEP",
                **result
            })
        except Exception as e:
            logger.error(f"Error in auto-run step: {e}")
        finally:
            db.close()
        await asyncio.sleep(2.5) # 2.5 seconds per simulation tick
    logger.info(f"Auto-run worker loop stopped for shipment {shipment_id}")

@router.post("/auto-run/start/{shipment_id}")
async def start_auto_run(shipment_id: int, background_tasks: BackgroundTasks):
    if auto_run_tasks.get(shipment_id, False):
        return {"message": "Auto-run already active", "status": "RUNNING"}

    auto_run_tasks[shipment_id] = True
    background_tasks.add_task(auto_run_worker, shipment_id)
    return {"message": "Auto-run started successfully", "status": "RUNNING"}

@router.post("/auto-run/stop/{shipment_id}")
async def stop_auto_run(shipment_id: int):
    auto_run_tasks[shipment_id] = False
    return {"message": "Auto-run stopped", "status": "STOPPED"}
