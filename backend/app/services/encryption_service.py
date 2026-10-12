import base64
import hashlib
from typing import Optional
from app.config import settings

def _get_fernet_instance():
    try:
        from cryptography.fernet import Fernet
        key = base64.urlsafe_b64encode(hashlib.sha256(settings.GATEWAY_ENCRYPTION_KEY.encode()).digest())
        return Fernet(key)
    except Exception:
        return None

def encrypt_credential(raw_secret: Optional[str]) -> Optional[str]:
    """Encrypts raw API key or password for secure storage."""
    if not raw_secret:
        return None
    fernet = _get_fernet_instance()
    if fernet:
        return fernet.encrypt(raw_secret.encode("utf-8")).decode("utf-8")
    # Fallback obfuscation if cryptography not available
    salt = hashlib.sha256(settings.GATEWAY_ENCRYPTION_KEY.encode()).digest()
    raw_bytes = raw_secret.encode("utf-8")
    xor_bytes = bytes([b ^ salt[i % len(salt)] for i, b in enumerate(raw_bytes)])
    return "enc:" + base64.b64encode(xor_bytes).decode("utf-8")

def decrypt_credential(encrypted_secret: Optional[str]) -> Optional[str]:
    """Decrypts stored credential for internal use when communicating with gateway."""
    if not encrypted_secret:
        return None
    fernet = _get_fernet_instance()
    if fernet and not encrypted_secret.startswith("enc:"):
        try:
            return fernet.decrypt(encrypted_secret.encode("utf-8")).decode("utf-8")
        except Exception:
            pass
    if encrypted_secret.startswith("enc:"):
        salt = hashlib.sha256(settings.GATEWAY_ENCRYPTION_KEY.encode()).digest()
        cipher_bytes = base64.b64decode(encrypted_secret[4:])
        raw_bytes = bytes([b ^ salt[i % len(salt)] for i, b in enumerate(cipher_bytes)])
        return raw_bytes.decode("utf-8", errors="replace")
    return encrypted_secret

def mask_credential(secret: Optional[str]) -> Optional[str]:
    """Returns a masked version of credential for safe API return (e.g., sk_live_...4812)."""
    if not secret:
        return None
    # If already encrypted, decrypt first so we know real length
    if secret.startswith("gAAAAA") or secret.startswith("enc:"):
        real_secret = decrypt_credential(secret)
    else:
        real_secret = secret

    if not real_secret:
        return None
    if len(real_secret) <= 6:
        return "•" * len(real_secret)
    return f"{real_secret[:3]}••••••••{real_secret[-4:]}"
