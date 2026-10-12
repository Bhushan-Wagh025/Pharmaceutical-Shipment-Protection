from app.models.logistics import Gateway
from app.adapters.base import BaseGatewayAdapter
from app.adapters.simulated_adapter import SimulatedGatewayAdapter
from app.adapters.gao_adapter import GAOBLEGatewayAdapter
from app.services.encryption_service import decrypt_credential

def get_gateway_adapter(gateway: Gateway) -> BaseGatewayAdapter:
    """Instantiates the appropriate gateway adapter for a Gateway database entity."""
    adapter_type = (gateway.adapter_type or "GAO_BLE").upper()
    
    if adapter_type == "SIMULATED":
        return SimulatedGatewayAdapter(gateway_eui=gateway.gateway_eui)
    
    # Decrypt credentials for network use
    api_key = decrypt_credential(gateway.api_key_encrypted) if gateway.api_key_encrypted else None
    
    return GAOBLEGatewayAdapter(
        host_url=gateway.host_url or gateway.ip_address or "",
        api_base_path=gateway.api_base_path or "/api/v1",
        auth_method=gateway.auth_method or "NONE",
        api_key=api_key,
        timeout_seconds=gateway.timeout_seconds or 5,
        verify_ssl=gateway.verify_ssl if gateway.verify_ssl is not None else True,
        gateway_eui=gateway.gateway_eui
    )
