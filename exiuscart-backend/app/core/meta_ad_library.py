"""
Meta Ad Library search — shared core, used by both the admin-side Prodora
curation flow (admin.py's admin_meta_ads_search) and the seller-facing
product research endpoint (endpoints/ad_intelligence.py). One real call
site instead of two copies of the same httpx request, same discipline as
every other channel integration's single "_x_request" chokepoint.

Meta's Ad Library API (/ads_archive) is free and public — it serves
already-public archive data, no per-seller OAuth, no app review needed
for this endpoint specifically. It does need a real access token from a
verified Meta developer account (identity verification is required on
Meta's side, something only a human can do) — until META_AD_LIBRARY_TOKEN
is set, callers get a clear "not configured" error, never a silent
empty result or faked data.

CONFIRMED live against Meta's own Graph API reference this session:
  - Endpoint: GET https://graph.facebook.com/<version>/ads_archive
  - ad_reached_countries is required (JSON array string, e.g. '["US"]').
  - ad_type defaults to political/issue ads only — MUST be set to "ALL"
    to search regular commercial/product ads, confirmed via Meta's own
    docs (not the API's default behavior, an easy silent-wrong-results
    mistake to make).
"""
import os
import re
from typing import Optional
from urllib.parse import urlencode

import httpx
from fastapi import HTTPException

META_AD_LIBRARY_TOKEN = os.getenv("META_AD_LIBRARY_TOKEN", "")
META_GRAPH_BASE = "https://graph.facebook.com/v21.0"
META_AD_LIBRARY_WEB = "https://www.facebook.com/ads/library/"

# Words supplier titles are padded with that never appear in a real ad's
# copy — left in, Meta's keyword search matches nothing ("2024 New Hot Sale
# Adjustable Posture Corrector For Women" finds 0 ads, "Posture Corrector"
# finds thousands).
_TITLE_NOISE = {
    "new", "hot", "sale", "best", "top", "quality", "high", "free", "shipping",
    "fashion", "style", "arrival", "arrivals", "selling", "seller", "premium",
    "for", "with", "and", "the", "a", "an", "of", "in", "to", "on", "by", "set",
    "pcs", "pc", "piece", "pieces", "women", "womens", "men", "mens", "kids",
    "unisex", "portable", "mini", "upgraded", "original", "wholesale",
}


def ad_library_keyword(name: str, max_words: int = 3) -> str:
    """Short, searchable keyword from a (often long, supplier-written)
    product title — the admin can still overwrite it."""
    words = re.sub(r"[\(\[\{].*?[\)\]\}]|[^\w\s-]", " ", name or "").split()
    kept = [w for w in words if w.lower() not in _TITLE_NOISE and not any(c.isdigit() for c in w)]
    return " ".join(kept[:max_words]) or (name or "").strip()


def ad_library_search_url(query: str, country: str = "US", platform: Optional[str] = None) -> str:
    """Public Meta Ad Library page listing every active ad matching `query`.
    A plain facebook.com link anyone can open — no token, no developer
    account, no login — the fallback for everything above while
    META_AD_LIBRARY_TOKEN isn't available."""
    params = {
        "active_status": "active",
        "ad_type": "all",
        "country": country or "ALL",
        "q": query,
        "search_type": "keyword_unordered",
        "media_type": "all",
    }
    if platform:
        params["publisher_platforms[0]"] = platform
    return f"{META_AD_LIBRARY_WEB}?{urlencode(params)}"


async def search_meta_ad_library(query: str, country: str = "US", limit: int = 20) -> list[dict]:
    if not META_AD_LIBRARY_TOKEN:
        raise HTTPException(status_code=400, detail={
            "error": "meta_not_configured",
            "message": "Meta Ad Library isn't connected yet. Generate a long-lived access token from a verified Meta developer account and set META_AD_LIBRARY_TOKEN on the server.",
        })

    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(f"{META_GRAPH_BASE}/ads_archive", params={
            "search_terms": query,
            "ad_reached_countries": f'["{country}"]',
            "ad_active_status": "ACTIVE",
            "ad_type": "ALL",
            "fields": "id,ad_snapshot_url,page_name,ad_creative_bodies,publisher_platforms",
            "limit": limit,
            "access_token": META_AD_LIBRARY_TOKEN,
        })
    data = r.json()
    if "error" in data:
        raise HTTPException(status_code=502, detail=f"Meta Ad Library error: {data['error'].get('message', 'Unknown error')}")

    return [
        {
            "id": a.get("id"),
            "page_name": a.get("page_name"),
            "snapshot_url": a.get("ad_snapshot_url"),
            "body": (a.get("ad_creative_bodies") or [None])[0],
            "platforms": a.get("publisher_platforms") or [],
        }
        for a in (data.get("data") or [])
    ]
