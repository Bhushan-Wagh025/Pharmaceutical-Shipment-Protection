import logging
from datetime import datetime, timedelta
from typing import List, Optional, Tuple, Dict, Any
import numpy as np
from sklearn.linear_model import Ridge, LinearRegression
from sklearn.preprocessing import PolynomialFeatures
from sklearn.pipeline import make_pipeline
from sqlalchemy.orm import Session

from app.models.telemetry import TemperatureReading, TemperatureForecast, RiskLevel
from app.models.logistics import Shipment

logger = logging.getLogger("pharma.ai_forecast")

class AITemperatureForecaster:
    """
    Lightweight scikit-learn based thermal trajectory forecaster for cold chain shipments.
    Trains dynamically on recent sensor telemetry to project thermal behavior across
    configured forecast horizons.
    """

    @staticmethod
    def forecast_shipment_temperature(
        db: Session, 
        shipment: Shipment,
        window_minutes: int = 30
    ) -> Optional[Dict[str, Any]]:
        # Fetch recent readings for this shipment
        cutoff = datetime.utcnow() - timedelta(minutes=window_minutes)
        readings = (
            db.query(TemperatureReading)
            .filter(
                TemperatureReading.shipment_id == shipment.id,
                TemperatureReading.timestamp >= cutoff
            )
            .order_by(TemperatureReading.timestamp.asc())
            .all()
        )

        if not readings or len(readings) < 3:
            # Fallback to the latest historical readings for cold start / demo scenarios
            recent_readings = (
                db.query(TemperatureReading)
                .filter(TemperatureReading.shipment_id == shipment.id)
                .order_by(TemperatureReading.timestamp.desc())
                .limit(20)
                .all()
            )
            if len(recent_readings) >= 3:
                readings = list(reversed(recent_readings))
            else:
                return None

        # Convert timestamps and temperatures to numpy arrays
        t0 = readings[0].timestamp
        times_min = np.array([(r.timestamp - t0).total_seconds() / 60.0 for r in readings]).reshape(-1, 1)
        temps = np.array([r.temperature for r in readings])

        current_time_min = times_min[-1, 0]
        current_temp = float(temps[-1])
        horizon = float(shipment.forecast_horizon_minutes)
        future_time_min = current_time_min + horizon

        # Fit scikit-learn model: Ridge regression with 2nd order polynomial features to capture non-linear warming curves
        # or simple LinearRegression if fewer than 5 points
        if len(readings) >= 5:
            model = make_pipeline(PolynomialFeatures(degree=2), Ridge(alpha=0.5))
            model_name = "scikit-learn-polynomial-ridge-deg2"
        else:
            model = LinearRegression()
            model_name = "scikit-learn-linear-regression"

        model.fit(times_min, temps)

        # Predict future temperature
        predicted_temp = float(model.predict(np.array([[future_time_min]]))[0])
        # Also predict near-term slope
        t_delta = 1.0 # 1 minute into future
        temp_1m = float(model.predict(np.array([[current_time_min + t_delta]]))[0])
        slope_c_per_min = float((temp_1m - current_temp) / t_delta)

        # Measure fit quality (R^2 / residual std)
        preds_history = model.predict(times_min)
        residuals = temps - preds_history
        rmse = float(np.sqrt(np.mean(residuals ** 2)))
        confidence = float(np.clip(1.0 - (rmse / 2.0), 0.60, 0.99))

        # Check limit crossing
        temp_limit = float(shipment.temp_limit)
        will_cross_limit = (predicted_temp >= temp_limit) or (current_temp >= temp_limit)

        # Calculate estimated time to cross threshold
        time_to_cross_seconds = None
        if current_temp >= temp_limit:
            time_to_cross_seconds = 0.0
        elif will_cross_limit and slope_c_per_min > 0.001:
            # Check intermediate seconds using root finding / sampling
            sim_times = np.linspace(current_time_min, current_time_min + horizon * 1.5, 60)
            sim_preds = model.predict(sim_times.reshape(-1, 1))
            cross_indices = np.where(sim_preds >= temp_limit)[0]
            if len(cross_indices) > 0:
                first_cross_idx = cross_indices[0]
                cross_time = sim_times[first_cross_idx]
                time_to_cross_seconds = max(0.0, float((cross_time - current_time_min) * 60.0))
            else:
                # Approximate linearly
                diff = temp_limit - current_temp
                time_to_cross_seconds = (diff / slope_c_per_min) * 60.0

        # Assess Risk Level
        if current_temp >= temp_limit:
            risk_level = RiskLevel.CRITICAL.value
        elif will_cross_limit:
            if time_to_cross_seconds and time_to_cross_seconds < (5 * 60):
                risk_level = RiskLevel.CRITICAL.value
            else:
                risk_level = RiskLevel.HIGH.value
        elif predicted_temp >= (temp_limit - 0.75) or slope_c_per_min > 0.15:
            risk_level = RiskLevel.MEDIUM.value
        else:
            risk_level = RiskLevel.LOW.value

        return {
            "shipment_id": shipment.id,
            "current_temp": round(current_temp, 2),
            "predicted_temp": round(predicted_temp, 2),
            "horizon_minutes": shipment.forecast_horizon_minutes,
            "risk_level": risk_level,
            "will_cross_limit": will_cross_limit,
            "time_to_cross_seconds": round(time_to_cross_seconds, 1) if time_to_cross_seconds is not None else None,
            "confidence": round(confidence, 2),
            "slope_c_per_min": round(slope_c_per_min, 4),
            "model_type": model_name,
        }
