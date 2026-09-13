"""
Symmetric encryption for third-party credentials at rest — CJ Dropshipping
password, supplier API keys (HyperSKU). These were previously
stored as base64 (CJ) or plain text (the others), neither of which is real
encryption: anyone with database read access — a backup, a leaked dump —
could recover every connected seller's real credentials instantly.

Fernet (AES-128-CBC + HMAC) with a key from CREDENTIALS_ENCRYPTION_KEY.
Generate one with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
"""
import base64
import logging
import os
from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy.types import TypeDecorator, Text

logger = logging.getLogger(__name__)

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


class EncryptedText(TypeDecorator):
    """A Text column that's transparently encrypted at rest — every ORM
    read/write through this type goes through encrypt()/decrypt() at the
    database boundary, so every call site (10+ channel integrations, the
    payment-gateway connect flow, etc.) gets this for free with no change
    to how it reads/writes the attribute.

    If CREDENTIALS_ENCRYPTION_KEY isn't set, writes fall back to storing
    the plaintext as-is (same behavior as before this existed) rather than
    raising — so a misconfigured/missing key degrades to "not encrypted
    yet" instead of taking down every channel-connect endpoint at once.
    Logs a warning each time that happens so it doesn't go unnoticed."""
    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None or value == "":
            return value
        if not _fernet:
            logger.warning("CREDENTIALS_ENCRYPTION_KEY not set — storing a credential as plaintext.")
            return value
        return encrypt(value)

    def process_result_value(self, value, dialect):
        if value is None or value == "":
            return value
        # Deliberately NOT the shared decrypt()'s base64 fallback above —
        # that exists only for CJ's specific legacy base64-encoded password,
        # a convention these columns never used. Falling back to "try
        # base64-decoding it anyway" here would risk silently corrupting a
        # genuinely plaintext pre-existing token that happens to look like
        # valid base64. Fernet's own HMAC means it only ever succeeds on a
        # real Fernet token, so this fails closed to "return as stored."
        if _fernet:
            try:
                return _fernet.decrypt(value.encode()).decode()
            except InvalidToken:
                pass
        return value
