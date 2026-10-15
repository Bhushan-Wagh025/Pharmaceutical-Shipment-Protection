import sys
import logging
from datetime import datetime
import httpx

from app.database import SessionLocal
from app.models.auth import Role, User, RoleEnum, Company
from app.models.logistics import Site, Station, Gateway, GatewayStatus, BLEDevice, BLEDeviceStatus, Shipment, ShipmentStatus, Tray, TrayState
from app.models.telemetry import TemperatureReading, TemperatureForecast, RiskLevel
from app.models.governance import Alert
from app.models.control import ProtectionAction
from app.services.ai_forecast_service import AITemperatureForecaster

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("resync_aperture")

def resync():
    db = SessionLocal()
    try:
        print("[*] 1. Purging old hardcoded dummy data...")
        old_codes = ["SHP-2026-001", "SHP-2026-002", "SHIP-VAX-2026-094", "SHIP-APT-2026-LIVE"]
        old_shipments = db.query(Shipment).filter(Shipment.shipment_code.in_(old_codes)).all()
        for s in old_shipments:
            db.query(TemperatureReading).filter(TemperatureReading.shipment_id == s.id).delete()
            db.query(TemperatureForecast).filter(TemperatureForecast.shipment_id == s.id).delete()
            db.query(Alert).filter(Alert.shipment_id == s.id).delete()
            db.query(ProtectionAction).filter(ProtectionAction.shipment_id == s.id).delete()
            db.delete(s)
        db.commit()

        # Delete old devices with colon MACs or specific dummy MACs
        old_devs = db.query(BLEDevice).filter(
            (BLEDevice.device_mac.like("%:%")) | 
            (BLEDevice.device_mac.in_(["PROBE-BLE-T901", "CC:50:E3:88:42:01", "F4:B8:5E:21:99:A4"]))
        ).all()
        for dev in old_devs:
            # unlink or delete dependent shipments
            for shp in db.query(Shipment).filter(Shipment.ble_device_id == dev.id).all():
                db.delete(shp)
            db.delete(dev)
        db.commit()

        # Delete non-Aperture gateways entirely
        db.query(Gateway).filter(Gateway.gateway_eui != "GW-304A2657BF44").delete()
        db.commit()
        print("[+] Old hardcoded records and non-Aperture gateways purged.")

        # Ensure Aperture gateway
        company = db.query(Company).first()
        station = db.query(Station).first()
        tray = db.query(Tray).filter(Tray.tray_code == "TRAY-UNIT-A1").first()
        if not tray and station:
            tray = Tray(
                station_id=station.id,
                tray_code="TRAY-UNIT-A1",
                name="Motorized Cold Compartment Actuator Unit A1",
                state=TrayState.EXTENDED,
                position_percentage=0.0,
                temp_cold_pack=2.5,
                target_temp=4.0
            )
            db.add(tray)
            db.commit()
            db.refresh(tray)

        # Delete any old simulated trays
        for t in db.query(Tray).filter(Tray.tray_code != "TRAY-UNIT-A1").all():
            for s in db.query(Shipment).filter(Shipment.tray_id == t.id).all():
                s.tray_id = tray.id if tray else None
            db.delete(t)
        db.commit()

        apt_gw = db.query(Gateway).filter(Gateway.gateway_eui == "GW-304A2657BF44").first()
        if not apt_gw:
            apt_gw = Gateway(
                company_id=company.id if company else 1,
                station_id=station.id if station else 1,
                gateway_eui="GW-304A2657BF44",
                name="Aperture Industrial BLE Gateway (GW-304A2657BF44)",
                host_url="https://gateway.apertureventurestudio.com",
                api_base_path="/api/v1/gateway/ble",
                auth_method="NONE",
                polling_interval=3,
                timeout_seconds=5,
                is_enabled=True,
                is_monitoring=True,
                verify_ssl=True,
                adapter_type="GAO_BLE",
                status=GatewayStatus.ONLINE,
                last_seen_at=datetime.utcnow(),
                last_communication_at=datetime.utcnow()
            )
            db.add(apt_gw)
            db.commit()
            db.refresh(apt_gw)
        else:
            apt_gw.name = "Aperture Industrial BLE Gateway (GW-304A2657BF44)"
            apt_gw.host_url = "https://gateway.apertureventurestudio.com"
            apt_gw.api_base_path = "/api/v1/gateway/ble"
            apt_gw.is_enabled = True
            apt_gw.is_monitoring = True
            apt_gw.status = GatewayStatus.ONLINE
            db.commit()

        print("[*] 2. Querying live Aperture BLE Gateway APIs...")
        with httpx.Client(timeout=10.0) as client:
            latest_res = client.get("https://gateway.apertureventurestudio.com/api/v1/gateway/ble/telemetry/latest").json()
            history_res = client.get("https://gateway.apertureventurestudio.com/api/v1/gateway/ble/telemetry/history").json()

        latest_objs = latest_res.get("data", {}).get("data", {}).get("obj", [])
        temp_beacons = [x for x in latest_objs if "temp" in x]
        print(f"[+] Found {len(temp_beacons)} real-time temperature beacons in latest telemetry.")

        created_shipments = []
        for b in temp_beacons:
            dmac = str(b.get("dmac"))
            temp_val = float(b.get("temp", 24.0))
            vbatt = b.get("vbatt")
            bat = min(100.0, max(0.0, round((float(vbatt) - 2500.0) / 6.0, 1))) if vbatt else 92.0
            rssi = int(b.get("rssi", -70))

            dev = db.query(BLEDevice).filter(BLEDevice.device_mac == dmac).first()
            if not dev:
                dev = BLEDevice(
                    company_id=company.id if company else 1,
                    device_mac=dmac,
                    name=f"Aperture Temp Beacon #{dmac[-4:]}",
                    battery_level=bat,
                    status=BLEDeviceStatus.ONLINE,
                    last_seen_at=datetime.utcnow()
                )
                db.add(dev)
                db.commit()
                db.refresh(dev)
            else:
                dev.battery_level = bat
                dev.last_seen_at = datetime.utcnow()
                db.commit()

            shp_code = f"SHIP-{dmac}"
            shp = db.query(Shipment).filter(Shipment.shipment_code == shp_code).first()
            if not shp:
                shp = Shipment(
                    shipment_code=shp_code,
                    package_id=f"PKG-{dmac}",
                    company_id=company.id if company else 1,
                    product_name=f"Live Bio-Pharmaceutical Cargo (Beacon #{dmac[-4:]})",
                    batch_number=f"LOT-2026-APT-{dmac[-4:]}",
                    customer_name="Global Clinical Cold-Chain Network",
                    origin="Aperture Gateway Hub (304A2657BF44)",
                    destination="Central Temperature-Controlled Logistics Hub",
                    temp_limit=8.0,
                    temp_safe_min=2.0,
                    forecast_horizon_minutes=15,
                    status=ShipmentStatus.NORMAL if temp_val < 8.0 else ShipmentStatus.AT_RISK,
                    risk_level=RiskLevel.LOW.value if temp_val < 7.5 else (RiskLevel.HIGH.value if temp_val >= 8.0 else RiskLevel.MEDIUM.value),
                    ble_device_id=dev.id,
                    tray_id=tray.id if tray else None
                )
                db.add(shp)
                db.commit()
                db.refresh(shp)
            created_shipments.append((shp, dev))

        print(f"[+] Synced {len(created_shipments)} active shipments directly bound to real Aperture BLE beacons.")

        # 3. Ingest real historical data for each real beacon
        history_records = history_res.get("data", [])
        print(f"[*] Ingesting historical packets ({len(history_records)} packets) for active beacons...")
        ingested_count = 0
        for entry in reversed(history_records):
            sub_data = entry.get("data", {})
            objs = sub_data.get("obj", [])
            recv_time_str = entry.get("received_at")
            try:
                entry_dt = datetime.fromisoformat(recv_time_str.replace("Z", "+00:00")).replace(tzinfo=None)
            except Exception:
                entry_dt = datetime.utcnow()

            for obj in objs:
                if "temp" in obj:
                    dmac = str(obj.get("dmac"))
                    temp_val = float(obj["temp"])
                    vbatt = obj.get("vbatt")
                    bat = min(100.0, max(0.0, round((float(vbatt) - 2500.0) / 6.0, 1))) if vbatt else 92.0
                    rssi = int(obj.get("rssi", -70))

                    dev = db.query(BLEDevice).filter(BLEDevice.device_mac == dmac).first()
                    if not dev:
                        continue
                    shp = db.query(Shipment).filter(Shipment.ble_device_id == dev.id).first()
                    if not shp:
                        continue

                    existing_r = db.query(TemperatureReading).filter(
                        TemperatureReading.shipment_id == shp.id,
                        TemperatureReading.timestamp == entry_dt
                    ).first()
                    if not existing_r:
                        db.add(TemperatureReading(
                            shipment_id=shp.id,
                            device_id=dev.id,
                            gateway_id=apt_gw.id,
                            temperature=round(temp_val, 2),
                            battery=bat,
                            humidity=45.0,
                            signal_rssi=rssi,
                            data_source="APERTURE_LIVE",
                            validation_status="VALID",
                            timestamp=entry_dt,
                            server_timestamp=datetime.utcnow()
                        ))
                        ingested_count += 1
        db.commit()
        print(f"[+] Ingested {ingested_count} real-time historical readings.")

        # Update latest forecast for all shipments
        for shp, dev in created_shipments:
            try:
                fc = AITemperatureForecaster.forecast_shipment_temperature(db, shp)
                if fc:
                    db.add(TemperatureForecast(
                        shipment_id=shp.id,
                        current_temp=fc["current_temp"],
                        predicted_temp=fc["predicted_temp"],
                        horizon_minutes=fc["horizon_minutes"],
                        risk_level=fc["risk_level"],
                        will_cross_limit=fc["will_cross_limit"],
                        time_to_cross_seconds=fc["time_to_cross_seconds"],
                        confidence=fc["confidence"],
                        slope_c_per_min=fc["slope_c_per_min"],
                        model_type=fc["model_type"],
                        timestamp=datetime.utcnow()
                    ))
                    shp.risk_level = fc["risk_level"]
            except Exception as e:
                pass
        db.commit()

        print("[+] Aperture live data resync complete! All hardcoded and old dummy data removed.")
    except Exception as e:
        print(f"[-] Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    resync()
