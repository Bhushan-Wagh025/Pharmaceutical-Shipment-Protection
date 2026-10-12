import sys
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def run_tests():
    print("--- 1. Testing Health Check ---")
    res = client.get("/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    print("Health check OK:", res.json())

    print("\n--- 2. Testing Authentication ---")
    login_res = client.post("/api/v1/auth/login", json={
        "email": "admin@pharmaprotect.com",
        "password": "Admin123!"
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    data = login_res.json()
    token = data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("Login successful! User:", data["user"]["full_name"], "Role:", data["user"]["role"]["name"])

    print("\n--- 3. Testing Shipments List & Overview ---")
    overview_res = client.get("/api/v1/shipments/overview", headers=headers)
    assert overview_res.status_code == 200
    overview = overview_res.json()
    print("Overview metrics:", {
        "active_shipments": overview["active_shipments_count"],
        "normal": overview["normal_count"],
        "at_risk": overview["at_risk_count"],
        "protected": overview["protected_count"]
    })

    shipment_res = client.get("/api/v1/shipments/1", headers=headers)
    assert shipment_res.status_code == 200
    shipment = shipment_res.json()
    print("Shipment #1:", shipment["shipment_code"], "Product:", shipment["product_name"], "Limit:", shipment["temp_limit"])

    print("\n--- 4. Testing AI Forecast Calculation ---")
    forecast_res = client.post("/api/v1/forecast/1/run", headers=headers)
    assert forecast_res.status_code == 200
    forecast = forecast_res.json()
    print("AI Forecast:", {
        "current_temp": forecast["current_temp"],
        "predicted_temp": forecast["predicted_temp"],
        "risk_level": forecast["risk_level"],
        "slope_c_per_min": forecast["slope_c_per_min"],
        "model_type": forecast["model_type"]
    })

    print("\n--- 5. Testing Simulator Stepping & Excursion Trigger ---")
    step_res = client.post("/api/v1/simulator/step/1", headers=headers)
    assert step_res.status_code == 200
    print("Simulation Step 1:", step_res.json()["temperature"], "°C | Tray:", step_res.json()["tray_state"])

    # Trigger excursion
    excursion_res = client.post("/api/v1/simulator/trigger-excursion/1", headers=headers)
    assert excursion_res.status_code == 200
    print("Excursion triggered! Temp:", excursion_res.json()["step"]["temperature"], "°C")

    # Step simulation multiple times until AI predicts limit breach and decision engine actuates tray
    protection_triggered = False
    for i in range(12):
        s_res = client.post("/api/v1/simulator/step/1", headers=headers)
        s_data = s_res.json()
        print(f"Step {i+2}: Temp={s_data['temperature']}°C | Pred={s_data['forecast']['predicted_temp']}°C | Risk={s_data['risk_level']} | Decision={s_data['decision']['decision']} | Tray={s_data['tray_state']}")
        if s_data["decision"]["decision"] == "TRIGGER_PROTECTION" or s_data["tray_state"] in ["MOVING_IN", "PROTECTED"]:
            protection_triggered = True
            break

    assert protection_triggered, "Protection was not triggered during excursion simulation!"
    print(">>> SUCCESS: AI Decision Engine successfully detected excursion and actuated motorized tray protection!")

    print("\n--- 6. Testing Protection Actions Audit & Alerts ---")
    actions_res = client.get("/api/v1/protection/actions?shipment_id=1", headers=headers)
    assert actions_res.status_code == 200
    actions = actions_res.json()
    print("Protection Actions recorded:", len(actions))
    if actions:
        print("Latest Action:", actions[0]["reason"], "Decision:", actions[0]["decision"])

    alerts_res = client.get("/api/v1/alerts?shipment_id=1", headers=headers)
    assert alerts_res.status_code == 200
    alerts = alerts_res.json()
    print("Alerts generated:", len(alerts), [a["alert_type"] for a in alerts])

    print("\n--- 7. Testing Reset Demo Scenario ---")
    reset_res = client.post("/api/v1/simulator/reset/1", headers=headers)
    assert reset_res.status_code == 200
    print("Reset Result:", reset_res.json())

    print("\n--- 8. Testing Compliance Report & Audit Logs ---")
    report_res = client.get("/api/v1/reports/compliance", headers=headers)
    assert report_res.status_code == 200
    print("Compliance Rate:", report_res.json()["compliance_rate_percent"], "%")

    audit_res = client.get("/api/v1/audit", headers=headers)
    assert audit_res.status_code == 200
    print("Audit logs count:", len(audit_res.json()))

    print("\n=======================================================")
    print("ALL BACKEND, SIMULATOR, AI, AND DECISION TESTS PASSED!")
    print("=======================================================")

if __name__ == "__main__":
    run_tests()
