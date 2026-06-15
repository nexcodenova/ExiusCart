"""
Shared TheDersi integration helpers — used by partner.py and channels.py.
"""
import os
import hmac
import hashlib
import json
import logging
import httpx

logger = logging.getLogger(__name__)

THEDERSI_KEY           = os.getenv("THEDERSI_PARTNER_KEY", "")
THEDERSI_HMAC_SECRET   = os.getenv("THEDERSI_HMAC_SECRET", "")    # TheDersi signs their webhooks with this → we verify incoming
THEDERSI_OUTGOING_SECRET = os.getenv("THEDERSI_OUTGOING_SECRET", "")  # we sign our outgoing notifications → TheDersi verifies
THEDERSI_WEBHOOK_URL = os.getenv(
    "THEDERSI_WEBHOOK_URL",
    "https://thedersi.lk/api/exiuscart/webhook",
)

# Tier names TheDersi sends → ExiusCart plan_type
# Accepts both new names (confirmed 2026-06) and old names (backward compat)
THEDERSI_TIER_MAP: dict = {
    "free_forever": {"plan_type": "thedersi_basic"},
    "free":         {"plan_type": "thedersi_basic"},
    "growth":       {"plan_type": "starter"},   # TheDersi Growth plan
    "premium":      {"plan_type": "starter"},   # TheDersi Premium plan
    "starter":      {"plan_type": "starter"},   # backward compat
    "pro":          {"plan_type": "starter"},   # backward compat
    "standard":     {"plan_type": "starter"},   # backward compat
}

# Monthly order limits per plan (None = unlimited)
MONTHLY_ORDER_LIMITS: dict = {
    "thedersi_basic": 50,
    "starter":        1000,
    "premium":        None,
}


def _hmac_signature(body: str) -> str:
    """HMAC-SHA256 signature for outgoing notifications to TheDersi (they verify with EXIUSCART_WEBHOOK_SECRET)."""
    secret = THEDERSI_OUTGOING_SECRET or THEDERSI_HMAC_SECRET  # fallback for old single-secret setups
    if not secret:
        return ""
    return "sha256=" + hmac.new(
        secret.encode("utf-8"),
        body.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def verify_thedersi_signature(body: bytes, x_signature: str) -> bool:
    """
    Verify the X-Signature header on incoming webhooks from TheDersi.
    Returns True if valid, or if THEDERSI_HMAC_SECRET is not configured (dev mode).
    Always use hmac.compare_digest to prevent timing attacks.
    """
    if not THEDERSI_HMAC_SECRET:
        return True  # secret not configured — allow through (dev/staging)
    if not x_signature or not x_signature.startswith("sha256="):
        return False
    expected = "sha256=" + hmac.new(
        THEDERSI_HMAC_SECRET.encode("utf-8"),
        body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, x_signature)


def notify_thedersi(seller_id: str, plan: str, event: str = "plan_update") -> None:
    """
    Call TheDersi's webhook to notify them of a plan or limit event.
    Payload is HMAC-signed with X-Signature header so TheDersi can verify authenticity.
    Fire-and-forget — errors are logged but never raised.
    """
    if not THEDERSI_WEBHOOK_URL or not seller_id:
        return

    payload = {
        "seller_id": seller_id,
        "plan": plan,
        "source": "thedersi",
        "event": event,
    }
    body = json.dumps(payload, separators=(",", ":"))
    sig  = _hmac_signature(body)

    headers = {
        "Content-Type": "application/json",
        "X-Partner-Key": THEDERSI_KEY,
    }
    if sig:
        headers["X-Signature"] = sig

    try:
        with httpx.Client(timeout=5) as client:
            r = client.post(THEDERSI_WEBHOOK_URL, content=body, headers=headers)
            logger.info(f"[TheDersi webhook] {event} seller={seller_id} → {r.status_code}")
    except Exception as exc:
        logger.warning(f"[TheDersi webhook] failed seller={seller_id}: {exc}")
