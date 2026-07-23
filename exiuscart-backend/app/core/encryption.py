"""
Symmetric encryption for third-party credentials at rest — CJ Dropshipping
password, supplier API keys (Zendrop/HyperSKU/Wiio). These were previously
stored as base64 (CJ) or plain text (the others), neither of which is real
encryption: anyone with database read access — a backup, a leaked dump —
could recover every connected seller's real credentials instantly.

Fernet (AES-128-CBC + HMAC) with a key from CREDENTIALS_ENCRYPTION_KEY.
Generate one with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
"""
import base64
import os
from cryptography.fernet import Fernet, InvalidToken

_KEY = os.getenv("CREDENTIALS_ENCRYPTION_KEY", "")
_fernet = Fernet(_KEY.encode()) if _KEY else None


def encrypt(plaintext: str) -> str:
    if not _fernet:
        raise RuntimeError("CREDENTIALS_ENCRYPTION_KEY is not set — cannot store credentials securely.")
    return _fernet.encrypt(plaintext.encode()).decode()


def decrypt(stored: str) -> str:
    """Decrypts a value written by encrypt(). Falls back to base64 decode,
    then to the raw value, so rows written before this module existed
    (legacy base64-encoded CJ passwords, or genuinely plaintext supplier
    api_keys) keep working until the seller reconnects and it's re-saved
    properly encrypted."""
    if _fernet:
        try:
            return _fernet.decrypt(stored.encode()).decode()
        except InvalidToken:
            pass
    try:
        return base64.b64decode(stored.encode()).decode()
    except Exception:
        return stored
