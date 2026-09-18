"""
SMS utility — sends via ExiusCart's own centralized providers (wholesale/
reseller model, not BYOK — see the reasoning below).

TWO providers, chosen by destination country:

  - Sri Lanka (+94) numbers go through a local gateway (Notify.lk).
    CONFIRMED via Twilio's own published Sri Lanka pricing: Twilio charges
    roughly $0.24-0.40 per SMS delivered to a Sri Lankan number — a
    completely different cost class from local Sri Lankan gateways, which
    charge around LKR 0.54-0.64/message (~$0.0017-0.002), confirmed against
    several Sri Lankan gateways' public 2026 pricing (Notify.lk, Text.lk,
    QuickSend.lk, SMSGo.lk all cluster in that band). Sending TheDersi
    sellers' SMS through Twilio would cost MORE per message than TheDersi
    Pro's entire 1699 LKR/month subscription price — routing Sri Lankan
    destinations locally isn't an optimization, it's the only way this
    feature doesn't lose money on every Sri Lankan send.
  - Everywhere else goes through Twilio (see app/core/sms.py's original
    reasoning: SMS costs ~100-200x AWS SES's per-email cost even in the
    cheapest markets, so BYOK-per-seller would be real friction for
    something ExiusCart can otherwise fold into the plan itself).

UNVERIFIED: Notify.lk's exact request shape below (endpoint, param names,
local-number formatting) is built from their publicly documented API
pattern, not a live-tested call against a real account — needs a real
NOTIFY_LK_USER_ID/NOTIFY_LK_API_KEY and one real test send to confirm
before this is trusted in production, same "flag it, don't fake certainty"
discipline as every other integration in this codebase that hasn't been
tested against a live account yet (e.g. TikTok's own image-upload guess).
"""
import os
import logging

import httpx

logger = logging.getLogger(__name__)

# ── Twilio (everywhere except Sri Lanka) ────────────────────────────────────
TWILIO_API_BASE = "https://api.twilio.com/2010-04-01"
_TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
_TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
# A Messaging Service (not a bare phone number) so Twilio's own sender
# selection/registration (A2P 10DLC campaign, alphanumeric sender ID,
# international number pool) is configured once on the Twilio console,
# not hardcoded per-message here.
_TWILIO_MESSAGING_SERVICE_SID = os.getenv("TWILIO_MESSAGING_SERVICE_SID", "")
TWILIO_ENABLED = bool(_TWILIO_ACCOUNT_SID and _TWILIO_AUTH_TOKEN and _TWILIO_MESSAGING_SERVICE_SID)

# ── Notify.lk (Sri Lanka only) ───────────────────────────────────────────────
NOTIFY_LK_API_BASE = "https://app.notify.lk/api/v1/send"
_NOTIFY_LK_USER_ID = os.getenv("NOTIFY_LK_USER_ID", "")
_NOTIFY_LK_API_KEY = os.getenv("NOTIFY_LK_API_KEY", "")
_NOTIFY_LK_SENDER_ID = os.getenv("NOTIFY_LK_SENDER_ID", "")
NOTIFY_LK_ENABLED = bool(_NOTIFY_LK_USER_ID and _NOTIFY_LK_API_KEY and _NOTIFY_LK_SENDER_ID)

# "Is SMS sending possible at all right now" — true if either provider is
# configured. Per-send routing (_is_sri_lanka_number) decides which one.
SMS_ENABLED = TWILIO_ENABLED or NOTIFY_LK_ENABLED


def _is_sri_lanka_number(phone: str) -> bool:
    p = (phone or "").strip().replace(" ", "").replace("-", "")
    return p.startswith("+94") or p.startswith("94")


def _send_via_notify_lk(to_phone: str, body: str) -> tuple[bool, str | None, str | None]:
    if not NOTIFY_LK_ENABLED:
        return False, None, "Sri Lanka SMS sending isn't configured on this server yet."
    # Notify.lk's documented format expects a local number (0XXXXXXXXX), not
    # E.164 — convert +94/94-prefixed input rather than assuming the
    # customer record already stores it that way.
    local_number = to_phone.strip().lstrip("+")
    if local_number.startswith("94"):
        local_number = "0" + local_number[2:]
    try:
        with httpx.Client(timeout=15) as client:
            resp = client.get(NOTIFY_LK_API_BASE, params={
                "user_id": _NOTIFY_LK_USER_ID, "api_key": _NOTIFY_LK_API_KEY,
                "sender_id": _NOTIFY_LK_SENDER_ID, "to": local_number, "message": body,
            })
        data = resp.json()
        if resp.status_code >= 300 or data.get("status") != "success":
            error = data.get("message") or resp.text[:500]
            logger.error(f"[SMS/notify.lk] to={to_phone} FAILED: {error}")
            return False, None, error
        uid = (data.get("data") or {}).get("uid")
        logger.info(f"[SMS/notify.lk SENT] To: {to_phone} | uid={uid}")
        return True, uid, None
    except Exception as e:
        logger.error(f"[SMS/notify.lk] to={to_phone} FAILED: {e}")
        return False, None, str(e)[:500]


def _send_via_twilio(to_phone: str, body: str) -> tuple[bool, str | None, str | None]:
    if not TWILIO_ENABLED:
        return False, None, "SMS sending isn't configured on this server yet."
    try:
        with httpx.Client(timeout=15) as client:
            resp = client.post(
                f"{TWILIO_API_BASE}/Accounts/{_TWILIO_ACCOUNT_SID}/Messages.json",
                auth=(_TWILIO_ACCOUNT_SID, _TWILIO_AUTH_TOKEN),
                data={"To": to_phone, "MessagingServiceSid": _TWILIO_MESSAGING_SERVICE_SID, "Body": body},
            )
        data = resp.json()
        if resp.status_code >= 300:
            error = data.get("message") or resp.text[:500]
            logger.error(f"[SMS/twilio] to={to_phone} FAILED: {error}")
            return False, None, error
        logger.info(f"[SMS/twilio SENT] To: {to_phone} | sid={data.get('sid')}")
        return True, data.get("sid"), None
    except Exception as e:
        logger.error(f"[SMS/twilio] to={to_phone} FAILED: {e}")
        return False, None, str(e)[:500]


def send_sms(to_phone: str, body: str) -> tuple[bool, str | None, str | None]:
    """Send one SMS via whichever provider actually makes sense for this
    destination (see module docstring). Returns (success, message_id,
    error). Never raises — a real send failure (bad number, provider
    outage, unregistered destination) is a per-recipient result, not a
    request-ending exception, since a campaign to hundreds of customers
    must keep going past one bad number."""
    if _is_sri_lanka_number(to_phone):
        return _send_via_notify_lk(to_phone, body)
    return _send_via_twilio(to_phone, body)
