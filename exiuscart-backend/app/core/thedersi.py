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

THEDERSI_KEY           = os.getenv("THEDERSI_PARTNER_KEY", "")       # we send this TO TheDersi
THEDERSI_INBOUND_KEY   = os.getenv("THEDERSI_INBOUND_KEY", "")       # TheDersi sends this TO us (they call it their partner key for ExiusCart)
THEDERSI_HMAC_SECRET   = os.getenv("THEDERSI_HMAC_SECRET", "")       # TheDersi signs their webhooks with this → we verify incoming
THEDERSI_OUTGOING_SECRET = os.getenv("THEDERSI_OUTGOING_SECRET", "") # we sign our outgoing notifications → TheDersi verifies
THEDERSI_WEBHOOK_URL = os.getenv(
    "THEDERSI_WEBHOOK_URL",
    "https://thedersi.lk/api/exiuscart/webhook",
)
THEDERSI_ORDER_STATUS_URL = os.getenv(
    "THEDERSI_ORDER_STATUS_URL",
    "https://thedersi.lk/api/v1/exiuscart/order-status",
)

# Tier names TheDersi sends → ExiusCart plan_type
# Accepts both new names (confirmed 2026-06) and old names (backward compat)
THEDERSI_TIER_MAP: dict = {
    "free_forever": {"plan_type": "thedersi_basic"},
    "free":         {"plan_type": "thedersi_basic"},
    "growth":       {"plan_type": "starter"},      # TheDersi Growth plan
    "premium":      {"plan_type": "starter"},      # TheDersi Premium plan
    "starter":      {"plan_type": "starter"},      # backward compat
    "pro":          {"plan_type": "thedersi_pro"}, # TheDersi Pro — starter features, unlimited orders
    "standard":     {"plan_type": "starter"},      # backward compat
}

# Monthly order limits per plan (None = unlimited)
# Counts ALL orders from any source (POS + every connected channel combined)
MONTHLY_ORDER_LIMITS: dict = {
    "free_trial":     50,    # matches pricing page
    "thedersi_basic": 50,
    "starter":        1000,  # matches pricing page
    "thedersi_pro":   None,  # unlimited
    "premium":        None,  # unlimited
}

TOTAL_ORDER_LIMITS = MONTHLY_ORDER_LIMITS


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
    - If THEDERSI_HMAC_SECRET is not configured → always allow (URL secret is enough).
    - If X-Signature header is absent → always allow (TheDersi does not sign inbound webhooks).
    - If X-Signature is present → verify it; reject on mismatch.
    """
    if not THEDERSI_HMAC_SECRET:
        return True  # no secret configured — URL-based webhook_secret is sufficient
    if not x_signature:
        return True  # TheDersi doesn't sign inbound webhooks; URL secret is sufficient
    if not x_signature.startswith("sha256="):
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


def notify_thedersi_profile_updated(
    thedersi_seller_id: str,
    logo_url: str | None,
    banner_url: str | None,
) -> None:
    """POST profile_updated event to TheDersi when seller changes logo/banner. Fire-and-forget."""
    if not THEDERSI_WEBHOOK_URL or not thedersi_seller_id:
        return

    payload: dict = {
        "event": "profile_updated",
        "thedersi_seller_id": thedersi_seller_id,
    }
    if logo_url:
        payload["logo_url"] = logo_url
    if banner_url:
        payload["banner_url"] = banner_url

    body = json.dumps(payload, separators=(",", ":"))
    sig = _hmac_signature(body)
    headers = {"Content-Type": "application/json", "X-Partner-Key": THEDERSI_KEY}
    if sig:
        headers["X-Signature"] = sig

    try:
        with httpx.Client(timeout=5) as client:
            r = client.post(THEDERSI_WEBHOOK_URL, content=body, headers=headers)
            logger.info(f"[TheDersi webhook] profile_updated seller={thedersi_seller_id} → {r.status_code}")
    except Exception as exc:
        logger.warning(f"[TheDersi webhook] profile_updated failed seller={thedersi_seller_id}: {exc}")


def notify_thedersi_order_status(
    channel_order_id: str,
    status: str,
    tracking_number: str | None = None,
    tracking_courier: str | None = None,
) -> None:
    """POST order status update to TheDersi when a seller updates their order. Fire-and-forget."""
    if not channel_order_id:
        return

    payload: dict = {"channel_order_id": channel_order_id, "status": status}
    if tracking_number:
        payload["tracking_number"] = tracking_number
    if tracking_courier:
        payload["tracking_courier"] = tracking_courier

    body = json.dumps(payload, separators=(",", ":"))

    headers: dict = {"Content-Type": "application/json", "X-Partner-Key": THEDERSI_KEY}
    if THEDERSI_HMAC_SECRET:
        sig = "sha256=" + hmac.new(
            THEDERSI_HMAC_SECRET.encode("utf-8"),
            body.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        headers["X-Signature"] = sig

    try:
        with httpx.Client(timeout=8) as client:
            r = client.post(THEDERSI_ORDER_STATUS_URL, content=body, headers=headers)
            print(f"[TheDersi order-status] {channel_order_id} → {status} | HTTP {r.status_code} | {r.text[:200]}", flush=True)
            logger.info(f"[TheDersi order-status] {channel_order_id} → {status} | HTTP {r.status_code}")
    except Exception as exc:
        print(f"[TheDersi order-status] FAILED {channel_order_id}: {exc}", flush=True)
        logger.warning(f"[TheDersi order-status] failed {channel_order_id}: {exc}")
