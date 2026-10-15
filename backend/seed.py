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

        # 5. Create / Ensure Aperture Industrial BLE Gateway (Live Studio: 304A2657BF44)
        apt_url = "https://gateway.apertureventurestudio.com"
        apt_eui = "GW-304A2657BF44"
        apt_gw = db.query(Gateway).filter(Gateway.gateway_eui == apt_eui).first()
        if not apt_gw:
            apt_gw = Gateway(
                company_id=company.id,
                station_id=station.id,
                gateway_eui=apt_eui,
                name="Aperture Industrial BLE Gateway (GW-304A2657BF44)",
                host_url=apt_url,
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
            apt_gw.host_url = apt_url
            apt_gw.api_base_path = "/api/v1/gateway/ble"
            apt_gw.name = "Aperture Industrial BLE Gateway (GW-304A2657BF44)"
            apt_gw.adapter_type = "GAO_BLE"
            apt_gw.is_enabled = True
            apt_gw.is_monitoring = True
            apt_gw.status = GatewayStatus.ONLINE
            db.commit()

        # Delete any old hardcoded or test gateways
        for old_gw in db.query(Gateway).filter(Gateway.gateway_eui != apt_eui).all():
            db.delete(old_gw)
        db.commit()

        # 6. Synchronize purely real-time Aperture BLE Gateway telemetry & beacons
        from resync_aperture import resync
        resync()

        logger.info("Database seeding successfully verified.")
    except Exception as e:
        logger.error(f"Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
