import logging
from datetime import datetime
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from app.models.logistics import Shipment, Tray, ShipmentStatus, TrayState
from app.models.telemetry import TemperatureReading, TemperatureForecast, RiskLevel, RiskEvent
from app.models.control import ProtectionAction, TrayEvent, ProtectionDecision, ProtectionResult
from app.models.governance import AlertType, AlertSeverity
from app.services.audit_service import AuditService
from app.services.alert_service import AlertService
from app.adapters.simulated_adapter import SimulatedTrayAdapter

logger = logging.getLogger("pharma.decision_engine")

class DecisionEngine:
    """
    Automated AIoT decision engine that continuously analyzes sensor telemetry
    and AI forecasts against safety bounds. Executes deterministic fail-safe protection
    by actuating the motorized cold-pack tray before temperature breaches occur.
    """

    def __init__(self):
        self.tray_adapter = SimulatedTrayAdapter()

    def evaluate_shipment(
        self,
        db: Session,
        shipment: Shipment,
        current_temp: float,
        forecast: Optional[Dict[str, Any]] = None,
        is_stale: bool = False
    ) -> Dict[str, Any]:
        """
        Evaluates current thermal reading and AI forecast.
        Executes protection action if excursion is imminent.
        Suspends actuation if sensor telemetry is stale.
        """
        temp_limit = shipment.temp_limit
        if forecast:
            predicted_temp = forecast.get("predicted_temp")
            risk_level = forecast.get("risk_level", RiskLevel.LOW.value)
            will_cross_limit = forecast.get("will_cross_limit", False)
        else:
            predicted_temp = None
            will_cross_limit = False
            # Generate risk states strictly from defined business rules and actual measurements
            if current_temp >= temp_limit:
                risk_level = RiskLevel.CRITICAL.value
            elif current_temp >= (temp_limit - 0.5):
                risk_level = RiskLevel.HIGH.value
            elif current_temp >= (temp_limit - 1.0):
                risk_level = RiskLevel.MEDIUM.value
            else:
                risk_level = RiskLevel.LOW.value
        horizon = shipment.forecast_horizon_minutes

        tray = shipment.tray
        if not tray:
            tray = db.query(Tray).first()

        # Check if telemetry is stale
        if is_stale:
            AlertService.create_alert(
                db=db,
                shipment_id=shipment.id,
                alert_type=AlertType.SENSOR_OFFLINE.value,
                severity=AlertSeverity.WARNING.value,
                title="Stale Sensor Telemetry - Protection Suspended",
                message="Telemetry is older than safety threshold. Automated actuation suspended to prevent false triggers."
            )
            return {
                "decision": "SUSPENDED_STALE_TELEMETRY",
                "reason": "Sensor telemetry is stale (>5 min old). Automatic physical actuation suspended.",
                "threshold": temp_limit,
                "predicted_temp": round(predicted_temp, 2) if predicted_temp is not None else None,
                "current_temp": round(current_temp, 2),
                "action_taken": False,
                "tray_state": tray.state.value if (tray and hasattr(tray.state, 'value')) else (tray.state if tray else "N/A"),
                "risk_level": "UNKNOWN_STALE"
            }

        decision = "MONITOR"
        reason = "Temperature and AI trajectory within safe tolerances."
        action_taken = False
        action_record = None

        # Check if shipment is in an active monitoring state
        if shipment.status in [ShipmentStatus.CANCELLED, ShipmentStatus.DELIVERED]:
            return {
                "decision": "IGNORE_INACTIVE",
                "reason": "Shipment is not active.",
                "action_taken": False
            }

        # 1. EVALUATE TRIGGER CONDITIONS:
        # Imminent excursion predicted or threshold already breached
        should_protect = (
            will_cross_limit or
            (predicted_temp is not None and predicted_temp >= temp_limit) or
            current_temp >= (temp_limit - 0.2) or
            risk_level in [RiskLevel.HIGH.value, RiskLevel.CRITICAL.value]
        )

        current_tray_state = tray.state if tray else TrayState.EXTENDED

        if should_protect and current_tray_state not in [TrayState.PROTECTED, TrayState.MOVING_IN]:
            decision = "TRIGGER_PROTECTION"
            if predicted_temp is not None:
                reason = (
                    f"AI Forecast predicted temperature {predicted_temp:.2f}°C exceeding limit "
                    f"{temp_limit:.1f}°C within {horizon} min horizon (Current: {current_temp:.2f}°C, Risk: {risk_level})."
                )
            else:
                reason = (
                    f"Measured temperature {current_temp:.2f}°C near/exceeding threshold "
                    f"{temp_limit:.1f}°C (Risk: {risk_level})."
                )
            action_taken = True

            # Actuate motorized tray
            if tray:
                from_state = tray.state.value if hasattr(tray.state, 'value') else str(tray.state)
                self.tray_adapter.move_in(tray.tray_code)
                tray.state = TrayState.MOVING_IN
                tray.position_percentage = 40.0
                tray.last_moved_at = datetime.utcnow()
                
                # Record Tray Event
                tray_event = TrayEvent(
                    tray_id=tray.id,
                    shipment_id=shipment.id,
                    from_state=from_state,
                    to_state="MOVING_IN",
                    initiated_by="AI_DECISION_ENGINE",
                    reason=reason,
                    timestamp=datetime.utcnow()
                )
                db.add(tray_event)

            # Record Protection Action
            action_record = ProtectionAction(
                shipment_id=shipment.id,
                tray_id=tray.id if tray else None,
                prediction_temp=round(predicted_temp, 2) if predicted_temp is not None else round(current_temp, 2),
                threshold=round(temp_limit, 2),
                reason=reason,
                decision=decision,
                result="SUCCESS",
                cooling_verified=False,
                timestamp=datetime.utcnow()
            )
            db.add(action_record)

            # Update Shipment Status
            shipment.status = ShipmentStatus.PROTECTED
            shipment.risk_level = risk_level

            # Generate Alerts
            AlertService.create_alert(
                db=db,
                shipment_id=shipment.id,
                alert_type=AlertType.PREDICTED_EXCURSION.value,
                severity=AlertSeverity.WARNING.value,
                title="Predicted Thermal Excursion",
                message=reason
            )
            AlertService.create_alert(
                db=db,
                shipment_id=shipment.id,
                alert_type=AlertType.PROTECTION_TRIGGERED.value,
                severity=AlertSeverity.CRITICAL.value,
                title="Cold-Pack Protection Actuated",
                message=f"Motorized tray [{tray.tray_code if tray else 'N/A'}] moved into protected cold-pack chamber."
            )

            # Audit Trail
            AuditService.log(
                db=db,
                action="PROTECTION_TRIGGERED",
                resource_type="SHIPMENT",
                resource_id=str(shipment.id),
                details=f"Decision Engine actuated tray protection for shipment {shipment.shipment_code}: {reason}"
            )

            db.commit()
            if action_record:
                db.refresh(action_record)

        elif current_tray_state in [TrayState.PROTECTED, TrayState.MOVING_IN]:
            # Already protected: Check if cooling has succeeded
            if current_tray_state == TrayState.MOVING_IN and tray:
                tray.state = TrayState.PROTECTED
                tray.position_percentage = 100.0

            decision = "MAINTAIN_PROTECTED"
            reason = "Package safely shielded in cold-pack compartment."

            # Verify cooling recovery
            if current_temp <= (temp_limit - 1.5):
                # Find latest active protection action without cooling verification
                latest_action = (
                    db.query(ProtectionAction)
                    .filter(
                        ProtectionAction.shipment_id == shipment.id,
                        ProtectionAction.cooling_verified == False
                    )
                    .order_by(ProtectionAction.timestamp.desc())
                    .first()
                )
                if latest_action:
                    latest_action.cooling_verified = True
                    latest_action.recovery_temp = round(current_temp, 2)
                    
                    AlertService.create_alert(
                        db=db,
                        shipment_id=shipment.id,
                        alert_type=AlertType.PROTECTION_SUCCESSFUL.value,
                        severity=AlertSeverity.INFO.value,
                        title="Cooling Verified - Product Safe",
                        message=f"Thermal recovery verified at {current_temp:.2f}°C inside cold-pack compartment."
                    )
                    
                    AuditService.log(
                        db=db,
                        action="COOLING_VERIFIED",
                        resource_type="SHIPMENT",
                        resource_id=str(shipment.id),
                        details=f"Cooling successfully stabilized at {current_temp:.2f}°C"
                    )
                    db.commit()

        elif current_temp >= (temp_limit - 1.0) and not should_protect:
            # Temperature warning alert
            AlertService.create_alert(
                db=db,
                shipment_id=shipment.id,
                alert_type=AlertType.TEMP_WARNING.value,
                severity=AlertSeverity.WARNING.value,
                title="Temperature Approaching Limit",
                message=f"Temperature reached {current_temp:.2f}°C (Limit: {temp_limit:.1f}°C)"
            )

        return {
            "decision": decision,
            "reason": reason,
            "threshold": temp_limit,
            "predicted_temp": round(predicted_temp, 2),
            "current_temp": round(current_temp, 2),
            "action_taken": action_taken,
            "tray_state": tray.state.value if (tray and hasattr(tray.state, 'value')) else (tray.state if tray else "N/A"),
            "risk_level": risk_level
        }

decision_engine = DecisionEngine()

def evaluate_protection_decision(
    current_temp: float,
    predicted_temp: float,
    temp_limit: float,
    current_tray_state: str = "EXTENDED",
    is_stale: bool = False
) -> Dict[str, Any]:
    """
    Pure, deterministic evaluation function for thermal safety and AI forecasts.
    Guarantees reproducible decisions without database side-effects.
    """
    if is_stale:
        return {
            "decision": "SUSPENDED_STALE_TELEMETRY",
            "reason": "Stale telemetry (>5 min old). Automatic physical actuation suspended to prevent false triggers.",
            "threshold": temp_limit,
            "predicted_temp": round(predicted_temp, 2),
            "current_temp": round(current_temp, 2),
            "action_taken": False
        }

    should_protect = (
        predicted_temp >= temp_limit or
        current_temp >= (temp_limit - 0.2)
    )

    if should_protect and current_tray_state not in ["PROTECTED", "MOVING_IN"]:
        return {
            "decision": "TRIGGER_PROTECTION",
            "reason": f"AI Forecast predicted temperature {predicted_temp:.2f}°C exceeding limit {temp_limit:.1f}°C",
            "threshold": temp_limit,
            "predicted_temp": round(predicted_temp, 2),
            "current_temp": round(current_temp, 2),
            "action_taken": True
        }

    return {
        "decision": "NO_ACTION",
        "reason": "Temperature and AI trajectory within safe tolerances.",
        "threshold": temp_limit,
        "predicted_temp": round(predicted_temp, 2),
        "current_temp": round(current_temp, 2),
        "action_taken": False
    }
