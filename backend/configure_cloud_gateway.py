import logging
from app.database import SessionLocal
from app.models.logistics import Gateway, GatewayStatus, Station

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pharma.configure_gateway")

def configure_cloud_gateway():
    db = SessionLocal()
    try:
        url = "https://ais-dev-q7bubcyu5drcfwewqploj4-579074576008.asia-southeast1.run.app"
        eui = "GW-AIS-RUN-01"
        station = db.query(Station).first()
        station_id = station.id if station else None

        gw = db.query(Gateway).filter(Gateway.gateway_eui == eui).first()
        if not gw:
            # Also check if any existing gateway has empty or default host
            gw = db.query(Gateway).first()

        if gw:
            logger.info(f"Updating gateway id={gw.id} ({gw.gateway_eui}) with Cloud Run API URL...")
            gw.name = "Cloud Run BLE Telemetry Gateway (Asia-SE1)"
            gw.host_url = url
            gw.api_base_path = "/api/v1"
            gw.auth_method = "BEARER_TOKEN"
            gw.status = GatewayStatus.OFFLINE
            gw.last_error = "Authentication required (Google Cloud / AI Studio login redirect)"
            db.commit()
            db.refresh(gw)
            logger.info(f"Gateway id={gw.id} successfully updated with host_url={gw.host_url}")
        else:
            logger.info("Creating new Gateway entity with Cloud Run API URL...")
            new_gw = Gateway(
                gateway_eui=eui,
                name="Cloud Run BLE Telemetry Gateway (Asia-SE1)",
                host_url=url,
                api_base_path="/api/v1",
                auth_method="BEARER_TOKEN",
                station_id=station_id,
                adapter_type="GAO_BLE",
                status=GatewayStatus.OFFLINE,
                last_error="Authentication required (Google Cloud / AI Studio login redirect)"
            )
            db.add(new_gw)
            db.commit()
            logger.info("Gateway created successfully.")
    except Exception as e:
        logger.error(f"Error configuring gateway: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    configure_cloud_gateway()
