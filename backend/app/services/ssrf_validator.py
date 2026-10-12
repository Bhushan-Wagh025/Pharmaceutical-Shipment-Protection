import socket
import ipaddress
import logging
from urllib.parse import urlparse
from typing import Tuple
from app.config import settings

logger = logging.getLogger("pharma.ssrf_validator")

# Blocked hostnames associated with cloud metadata or internal services
BLOCKED_HOSTNAMES = {
    "localhost",
    "127.0.0.1",
    "::1",
    "0.0.0.0",
    "metadata.google.internal",
    "instance-data",
    "169.254.169.254",
    "metadata.azure.com",
}

def validate_gateway_url(url: str, allow_private_override: bool = None) -> Tuple[bool, str]:
    """
    Validates a gateway target URL to prevent Server-Side Request Forgery (SSRF).
    
    Rules:
    - Must be a valid URL with http or https scheme.
    - Cloud metadata IPs and endpoints (e.g., 169.254.169.254) are unconditionally blocked.
    - Loopback, link-local, multicast, and unspecified addresses are unconditionally blocked.
    - Private RFC1918 IPs (192.168.x.x, 10.x.x.x, 172.16.x.x) are blocked unless
      administrator policy explicitly allows them (settings.ALLOW_PRIVATE_GATEWAY_IPS).
    - Public remote endpoints must use HTTPS.
    - Hostnames are resolved to IP addresses and re-validated.
    
    Returns:
        (is_valid: bool, error_message: str)
    """
    if not url or not isinstance(url, str):
        return False, "Gateway URL must be a non-empty string."

    url = url.strip()
    try:
        parsed = urlparse(url)
    except Exception as e:
        return False, f"Malformed URL: {e}"

    scheme = parsed.scheme.lower()
    if scheme not in ("http", "https"):
        return False, f"Unsupported URL scheme '{scheme}'. Only HTTP and HTTPS are permitted."

    hostname = parsed.hostname
    if not hostname:
        return False, "URL must include a valid hostname or IP address."

    hostname_lower = hostname.lower()
    if hostname_lower in BLOCKED_HOSTNAMES:
        return False, f"Access to '{hostname}' is forbidden for security (loopback/metadata protection)."

    # Resolve hostname to IP addresses
    try:
        addr_info = socket.getaddrinfo(hostname, parsed.port or (443 if scheme == "https" else 80), proto=socket.IPPROTO_TCP)
        ip_addresses = [info[4][0] for info in addr_info]
    except socket.gaierror as e:
        return False, f"Failed to resolve gateway host '{hostname}': {e}"
    except Exception as e:
        return False, f"DNS resolution error for '{hostname}': {e}"

    if not ip_addresses:
        return False, f"No IP addresses resolved for '{hostname}'."

    allow_private = allow_private_override if allow_private_override is not None else settings.ALLOW_PRIVATE_GATEWAY_IPS

    for ip_str in ip_addresses:
        try:
            ip = ipaddress.ip_address(ip_str)
        except ValueError:
            return False, f"Invalid IP address resolved: {ip_str}"

        # Unconditional blocks
        if ip.is_loopback:
            return False, f"Target IP {ip_str} is a loopback address and cannot be accessed."
        if ip.is_link_local:
            return False, f"Target IP {ip_str} is a link-local address (cloud metadata protection)."
        if ip.is_multicast:
            return False, f"Target IP {ip_str} is a multicast address."
        if ip.is_unspecified:
            return False, f"Target IP {ip_str} is an unspecified address."
        if str(ip) == "169.254.169.254":
            return False, "Target IP is cloud metadata endpoint (access blocked)."

        # Private IP evaluation
        if ip.is_private:
            if not allow_private:
                return False, (
                    f"Target IP {ip_str} is in a private network (RFC1918). "
                    "Private gateway IPs require administrator approval policy (ALLOW_PRIVATE_GATEWAY_IPS=true)."
                )
            # Allowed private network device: HTTP or HTTPS is permissible
        else:
            # Public internet target: enforce HTTPS
            if scheme != "https":
                return False, f"Remote public gateways must use HTTPS for secure transmission (got: {url})."

    return True, ""
