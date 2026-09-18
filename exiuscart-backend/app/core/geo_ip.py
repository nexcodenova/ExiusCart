"""IP -> country resolution for auto-tagging a customer's country at
checkout, instead of relying on a free-text address a shopper may never
fill in accurately. Uses ip-api.com's free tier (no key, no signup) —
generous enough (45 req/min) for real checkout volume; never blocks or
fails a checkout if the lookup is slow/down, since this is a nice-to-have
enrichment, not a required field.
"""
import logging

import httpx

logger = logging.getLogger(__name__)

IP_API_BASE = "http://ip-api.com/json"

# Private/local ranges resolve to nothing useful — skip the network call
# entirely for dev/internal traffic rather than let ip-api.com 400 on them.
_PRIVATE_PREFIXES = ("127.", "10.", "192.168.", "::1", "localhost")


def resolve_country_from_ip(ip: str | None) -> str | None:
    """Returns a 2-letter ISO country code, or None on any failure/private
    IP — callers should treat None the same as "couldn't determine", not
    an error worth surfacing to the shopper."""
    if not ip or ip.startswith(_PRIVATE_PREFIXES):
        return None
    try:
        resp = httpx.get(f"{IP_API_BASE}/{ip}", params={"fields": "status,countryCode"}, timeout=2.0)
        data = resp.json()
        if data.get("status") == "success" and data.get("countryCode"):
            return data["countryCode"]
    except Exception:
        logger.warning(f"[GEO-IP] lookup failed for ip={ip}", exc_info=True)
    return None
