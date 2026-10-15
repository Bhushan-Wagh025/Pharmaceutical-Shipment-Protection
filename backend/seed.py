import logging
from datetime import datetime, timedelta
from app.database import SessionLocal, Base, engine
from app.models.auth import Role, RoleEnum, Company, User
from app.models.logistics import (
    Site,
    Station,
    Gateway,
    BLEDevice,
    Tray,
    Shipment,
    GatewayStatus,
    BLEDeviceStatus,
    TrayState,
    ShipmentStatus,
)
from app.models.telemetry import TemperatureReading, TemperatureForecast, RiskLevel
from app.models.governance import SystemSetting, AuditLog
from app.services.auth_service import get_password_hash
from app.services.ai_forecast_service import AITemperatureForecaster

logger = logging.getLogger("pharma.seed")

def seed_database(*args, **kwargs):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # 1. Create Roles
        roles_data = [
            (RoleEnum.SUPER_ADMIN.value, "Complete enterprise administrative privileges"),
            (RoleEnum.COMPANY_ADMIN.value, "Company-level administrator"),
            (RoleEnum.MANAGER.value, "Logistics cold-chain operations manager"),
            (RoleEnum.OPERATOR.value, "Floor operator with manual tray actuation override rights"),
            (RoleEnum.VIEWER.value, "Read-only auditor and dashboard viewer"),
        ]
        role_map = {}
        for r_name, r_desc in roles_data:
            existing = db.query(Role).filter(Role.name == r_name).first()
            if not existing:
                existing = Role(name=r_name, description=r_desc)
                db.add(existing)
                db.commit()
                db.refresh(existing)
            role_map[r_name] = existing

        # 2. Create Company
        company = db.query(Company).filter(Company.code == "BIOPHARMA").first()
        if not company:
            company = Company(
                name="BioPharma Global Cold Chain Logistics",
                code="BIOPHARMA",
                contact_email="operations@biopharma-logistics.io",
                contact_phone="+41 61 284 8000",
                is_active=True
            )
            db.add(company)
            db.commit()
            db.refresh(company)

        # 3. Create Users
        users_seed = [
            ("admin@pharmaprotect.com", "Admin123!", "Dr. Alexander Vance (Super Admin)", RoleEnum.SUPER_ADMIN.value),
            ("operator@pharmaprotect.com", "Operator123!", "Elena Rostova (Floor Operator)", RoleEnum.OPERATOR.value),
            ("manager@pharmaprotect.com", "Manager123!", "Marcus Sterling (Cold Chain Mgr)", RoleEnum.MANAGER.value),
            ("viewer@pharmaprotect.com", "Viewer123!", "Sarah Connor (Quality Auditor)", RoleEnum.VIEWER.value),
        ]
        for email, password, full_name, r_name in users_seed:
            user = db.query(User).filter(User.email == email).first()
            if not user:
                user = User(
                    email=email,
                    full_name=full_name,
                    hashed_password=get_password_hash(password),
                    role_id=role_map[r_name].id,
                    company_id=company.id,
                    is_active=True
                )
                db.add(user)
                db.commit()

        # 4. Create Site and Station
        site = db.query(Site).filter(Site.code == "SITE-BSL-01").first()
        if not site:
            site = Site(
                company_id=company.id,
                name="Basel Cold Storage Hub Alpha",
                code="SITE-BSL-01",
                location="Basel, Switzerland"
            )
            db.add(site)
            db.commit()
            db.refresh(site)

        station = db.query(Station).filter(Station.station_code == "STN-PK4").first()
        if not station:
            station = Station(
                site_id=site.id,
                name="Vaccine Automated Packaging & Dispatch Line 4",
                station_code="STN-PK4"
            )
            db.add(station)
            db.commit()
            db.refresh(station)

        # 5. Create Gateway
        gateway = db.query(Gateway).filter(Gateway.gateway_eui == "GW-COLD-8842-A1").first()
        if not gateway:
            gateway = Gateway(
                company_id=company.id,
                station_id=station.id,
                gateway_eui="GW-COLD-8842-A1",
                name="GAO Industrial Cold-Chain Gateway #1 (Simulated)",
                ip_address="127.0.0.1",
                host_url="http://127.0.0.1:8000",
                api_base_path="/api/v1",
                auth_method="NONE",
                polling_interval=3,
                timeout_seconds=5,
                is_enabled=True,
                is_monitoring=True,
                verify_ssl=False,
                adapter_type="SIMULATED",
                status=GatewayStatus.ONLINE,
                last_seen_at=datetime.utcnow(),
                last_communication_at=datetime.utcnow()
            )
            db.add(gateway)
            db.commit()
            db.refresh(gateway)
        else:
            gateway.adapter_type = "SIMULATED"
            gateway.is_monitoring = True
            gateway.is_enabled = True
            gateway.polling_interval = 3
            gateway.status = GatewayStatus.ONLINE
            db.commit()

        # 6. Create BLE Device
        ble_dev = db.query(BLEDevice).filter(BLEDevice.device_mac == "CC:50:E3:88:42:01").first()
        if not ble_dev:
            ble_dev = BLEDevice(
                company_id=company.id,
                device_mac="CC:50:E3:88:42:01",
                name="BLE ColdTag Ultra #8021",
                battery_level=98.5,
                status=BLEDeviceStatus.ONLINE,
                last_seen_at=datetime.utcnow()
            )
            db.add(ble_dev)
            db.commit()
            db.refresh(ble_dev)

        # 7. Create Tray
        tray = db.query(Tray).filter(Tray.tray_code == "TRAY-UNIT-A1").first()
        if not tray:
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

        # 8. Create Demo Shipments if not present
        shp1 = db.query(Shipment).filter(Shipment.shipment_code == "SHP-2026-001").first()
        if not shp1:
            shp1 = Shipment(
                shipment_code="SHP-2026-001",
                package_id="PKG-mRNA-892",
                company_id=company.id,
                product_name="mRNA Vaccine BNT162b2 (Ultra-Sensitive)",
                batch_number="LOT-2026-9948",
                customer_name="Novartis Healthcare / Charité Hospital",
                origin="Basel Cold Hub, Switzerland",
                destination="Berlin Central Hospital, Germany",
                temp_limit=8.0,
                temp_safe_min=2.0,
                forecast_horizon_minutes=15,
                status=ShipmentStatus.NORMAL,
                risk_level=RiskLevel.LOW.value,
                ble_device_id=ble_dev.id,
                tray_id=tray.id
            )
            db.add(shp1)
            db.commit()
            db.refresh(shp1)

        shp2 = db.query(Shipment).filter(Shipment.shipment_code == "SHP-2026-002").first()
        if not shp2:
            shp2 = Shipment(
                shipment_code="SHP-2026-002",
                package_id="PKG-INS-441",
                company_id=company.id,
                product_name="Recombinant Human Insulin (Glargine)",
                batch_number="LOT-2026-3312",
                customer_name="Roche Diagnostics",
                origin="Frankfurt Cold Facility",
                destination="Zurich Pharmacy Hub",
                temp_limit=8.0,
                temp_safe_min=2.0,
                forecast_horizon_minutes=15,
                status=ShipmentStatus.NORMAL,
                risk_level=RiskLevel.LOW.value,
                ble_device_id=ble_dev.id,
                tray_id=tray.id
            )
            db.add(shp2)
            db.commit()
            db.refresh(shp2)

        # 9. AI Studio Virtual Hardware Simulator & API Server Dataset
        # Gateway: GW-BLE-EAST-01
        gw_ais = db.query(Gateway).filter(Gateway.gateway_eui == "GW-BLE-EAST-01").first()
        if not gw_ais:
            gw_ais = Gateway(
                company_id=company.id,
                station_id=station.id,
                gateway_eui="GW-BLE-EAST-01",
                name="BLE East Gateway 01 (Virtual AI Studio)",
                ip_address="127.0.0.1",
                host_url="http://127.0.0.1:8000",
                api_base_path="/api/v1",
                auth_method="NONE",
                polling_interval=3,
                timeout_seconds=5,
                is_enabled=True,
                is_monitoring=True,
                verify_ssl=False,
                adapter_type="SIMULATED",
                status=GatewayStatus.ONLINE,
                last_seen_at=datetime.utcnow(),
                last_communication_at=datetime.utcnow()
            )
            db.add(gw_ais)
            db.commit()
            db.refresh(gw_ais)

        # Sensor Probe: PROBE-BLE-T901 (Sensirion ThermoTrack BLE-X)
        probe_ais = db.query(BLEDevice).filter(BLEDevice.device_mac == "PROBE-BLE-T901").first()
        if not probe_ais:
            probe_ais = BLEDevice(
                company_id=company.id,
                device_mac="PROBE-BLE-T901",
                name="Sensirion ThermoTrack BLE-X (Dock Bay 4)",
                battery_level=99.2,
                status=BLEDeviceStatus.ONLINE,
                last_seen_at=datetime.utcnow()
            )
            db.add(probe_ais)
            db.commit()
            db.refresh(probe_ais)

        # Tray: tray-default-01 (Standard Tray Alpha)
        tray_ais = db.query(Tray).filter(Tray.tray_code == "tray-default-01").first()
        if not tray_ais:
            tray_ais = Tray(
                station_id=station.id,
                tray_code="tray-default-01",
                name="Standard Tray Alpha (AI Studio Virtual Rig)",
                state=TrayState.EXTENDED,
                position_percentage=0.0,
                temp_cold_pack=3.8,
                target_temp=4.0
            )
            db.add(tray_ais)
            db.commit()
            db.refresh(tray_ais)

        # Shipment: SHIP-VAX-2026-094 (mRNA-427 Lyophilized Vaccine Batch #48)
        shp_ais = db.query(Shipment).filter(Shipment.shipment_code == "SHIP-VAX-2026-094").first()
        if not shp_ais:
            shp_ais = Shipment(
                shipment_code="SHIP-VAX-2026-094",
                package_id="PKG-mRNA-427",
                company_id=company.id,
                product_name="mRNA-427 Lyophilized Vaccine Batch #48",
                batch_number="LOT-2026-mRNA427-B48",
                customer_name="Charité University Hospital - Berlin Depot",
                origin="Dock Bay 4 - Virtual Warehouse, Basel",
                destination="Berlin Central Hospital, Germany",
                temp_limit=8.0,
                temp_safe_min=2.0,
                forecast_horizon_minutes=15,
                status=ShipmentStatus.NORMAL,
                risk_level=RiskLevel.LOW.value,
                ble_device_id=probe_ais.id,
                tray_id=tray_ais.id
            )
            db.add(shp_ais)
            db.commit()
            db.refresh(shp_ais)

        # 10. Ensure baseline telemetry readings for shipment 1 & AI Studio shipment
        for s_target, dev_target, gw_target in [
            (shp1, ble_dev, gateway),
            (shp_ais, probe_ais, gw_ais)
        ]:
            readings_count = db.query(TemperatureReading).filter(TemperatureReading.shipment_id == s_target.id).count()
            now = datetime.utcnow()
            if readings_count < 3:
                baseline_temps = [5.12, 5.18, 5.25, 5.31, 5.38]
                for i, t in enumerate(baseline_temps):
                    db.add(TemperatureReading(
                        shipment_id=s_target.id,
                        device_id=dev_target.id,
                        gateway_id=gw_target.id,
                        temperature=t,
                        battery=98.5,
                        humidity=42.0,
                        signal_rssi=-62,
                        data_source="SIMULATED",
                        validation_status="VALID",
                        timestamp=now - timedelta(seconds=(len(baseline_temps) - i) * 10),
                        server_timestamp=now
                    ))
                db.commit()

                forecast_data = AITemperatureForecaster.forecast_shipment_temperature(db, s_target)
                if forecast_data:
                    db.add(TemperatureForecast(
                        shipment_id=s_target.id,
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
                    s_target.risk_level = forecast_data["risk_level"]
                    db.commit()

        logger.info("Database seeding successfully verified.")
    except Exception as e:
        logger.error(f"Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
