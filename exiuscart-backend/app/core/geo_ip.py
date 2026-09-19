"""IP -> country resolution for auto-tagging a customer's country at
checkout, instead of relying on a free-text address a shopper may never
fill in accurately. Uses ip-api.com's free tier (no key, no signup) —
generous enough (45 req/min) for real checkout volume; never blocks or
fails a checkout if the lookup is slow/down, since this is a nice-to-have
enrichment, not a required field.
"""
import logging
import time

import httpx

logger = logging.getLogger(__name__)

IP_API_BASE = "http://ip-api.com/json"

# Private/local ranges resolve to nothing useful — skip the network call
# entirely for dev/internal traffic rather than let ip-api.com 400 on them.
_PRIVATE_PREFIXES = ("127.", "10.", "192.168.", "::1", "localhost")


# Per-process cache: a storefront records an event per page view, so one
# visitor browsing 20 products would otherwise burn 20 of ip-api.com's 45
# lookups/minute. Countries for an IP effectively never change within a day.
_CACHE_TTL_SECONDS = 24 * 3600
_CACHE_MAX_ENTRIES = 5000
_cache: dict[str, tuple[float, str | None]] = {}


def resolve_country_from_ip(ip: str | None) -> str | None:
    """Returns a 2-letter ISO country code, or None on any failure/private
    IP — callers should treat None the same as "couldn't determine", not
    an error worth surfacing to the shopper."""
    if not ip or ip.startswith(_PRIVATE_PREFIXES):
        return None
    hit = _cache.get(ip)
    if hit and time.time() - hit[0] < _CACHE_TTL_SECONDS:
        return hit[1]
    country = _lookup(ip)
    # Only cache real answers — a failed lookup (rate limit, timeout) must be
    # retried on the next event, not remembered as "unknown" for a day.
    if country:
        if len(_cache) >= _CACHE_MAX_ENTRIES:
            _cache.clear()
        _cache[ip] = (time.time(), country)
    return country


def _lookup(ip: str) -> str | None:
    try:
        resp = httpx.get(f"{IP_API_BASE}/{ip}", params={"fields": "status,countryCode"}, timeout=2.0)
        data = resp.json()
        if data.get("status") == "success" and data.get("countryCode"):
            return data["countryCode"]
    except Exception:
        logger.warning(f"[GEO-IP] lookup failed for ip={ip}", exc_info=True)
    return None
