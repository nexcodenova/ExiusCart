"""
Server-side currency conversion — shared by anything that needs a real
exchange rate outside the request/response cycle the frontend's own
currency-provider handles (e.g. converting a supplier's price into the
shop's base_currency at import time, or a channel push needing a
different currency than the shop stores prices in).

Same rate source and caching approach as GET /shops/exchange-rates
(shops.py) — duplicated here rather than imported from there because that
one is a request handler tied to the shops router, not an importable
helper, and this needs to be callable from plain Python (dropshipping.py,
channels.py) without going through HTTP.
"""
import logging
from datetime import datetime, timezone, timedelta

import httpx

logger = logging.getLogger(__name__)

_RATE_CACHE: dict = {}  # {base: {"rates": {...}, "fetched_at": datetime}}
_RATE_CACHE_TTL = timedelta(hours=12)


async def _rates_for_base(base: str) -> dict | None:
    base = base.upper()
    cached = _RATE_CACHE.get(base)
    now = datetime.now(timezone.utc)
    if cached and (now - cached["fetched_at"]) < _RATE_CACHE_TTL:
        return cached["rates"]

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"https://open.er-api.com/v6/latest/{base}")
        data = r.json()
        rates = data.get("rates")
        if not rates:
            raise ValueError(data.get("error-type") or "No rates returned")
    except Exception as exc:
        logger.warning(f"[Currency] Failed to fetch rates for base={base}: {exc}")
        return cached["rates"] if cached else None

    _RATE_CACHE[base] = {"rates": rates, "fetched_at": now}
    return rates


async def convert_amount(amount: float, from_currency: str, to_currency: str) -> float:
    """Converts amount from from_currency to to_currency using a live rate.
    Returns the original amount unconverted if either currency is missing,
    they're already the same, or the rate lookup fails — callers should
    treat an unchanged result as "conversion didn't happen", not assume
    success, since silently returning the raw number is safer than raising
    and blocking an import/push over a rate-service outage."""
    if not from_currency or not to_currency or from_currency.upper() == to_currency.upper():
        return amount
    rates = await _rates_for_base(from_currency.upper())
    if not rates:
        return amount
    rate = rates.get(to_currency.upper())
    if not rate:
        return amount
    return round(amount * rate, 2)


def _rates_for_base_sync(base: str) -> dict | None:
    """Sync twin of _rates_for_base — the channel product-push pipeline
    (channels.py's _bg_full_sync/_bg_push_product) runs as a plain
    threadpool background task, not inside an event loop, so it can't
    await the async version. Shares the same module-level cache."""
    base = base.upper()
    cached = _RATE_CACHE.get(base)
    now = datetime.now(timezone.utc)
    if cached and (now - cached["fetched_at"]) < _RATE_CACHE_TTL:
        return cached["rates"]

    try:
        with httpx.Client(timeout=10) as client:
            r = client.get(f"https://open.er-api.com/v6/latest/{base}")
        data = r.json()
        rates = data.get("rates")
        if not rates:
            raise ValueError(data.get("error-type") or "No rates returned")
    except Exception as exc:
        logger.warning(f"[Currency] Failed to fetch rates for base={base}: {exc}")
        return cached["rates"] if cached else None

    _RATE_CACHE[base] = {"rates": rates, "fetched_at": now}
    return rates


def convert_amount_sync(amount: float, from_currency: str, to_currency: str) -> float:
    """Sync twin of convert_amount — see _rates_for_base_sync."""
    if not from_currency or not to_currency or from_currency.upper() == to_currency.upper():
        return amount
    rates = _rates_for_base_sync(from_currency.upper())
    if not rates:
        return amount
    rate = rates.get(to_currency.upper())
    if not rate:
        return amount
    return round(amount * rate, 2)
