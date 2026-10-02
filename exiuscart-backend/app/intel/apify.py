"""The one place Prodora intelligence talks to Apify (founder's choice, 2026-10-02):
three ready-made scrapers ("Actors") on one account and token (APIFY_TOKEN):

  Amazon         competitor price, rating, review count       (paid lookup, shortlisted products only)
  Google Trends  5 years of search interest                    (stand-in until Google's own Trends API alpha)
  TikTok         recent videos for the product's hashtag       (paid lookup, shortlisted products only)

Actors are run synchronously ("run-sync-get-dataset-items": start, wait, get the
rows in one call), so no webhook is needed. Actor names and their per-result
prices can be changed without a deploy:

  APIFY_AMAZON_ACTOR   (junglee~amazon-crawler)       APIFY_AMAZON_USD_PER_ITEM  (0.003)
  APIFY_TRENDS_ACTOR   (apify~google-trends-scraper)  APIFY_TRENDS_USD_PER_ITEM  (0.0003)
  APIFY_TIKTOK_ACTOR   (clockworks~tiktok-scraper)    APIFY_TIKTOK_USD_PER_ITEM  (0.004)

Every run is logged as an `apify_run` event with its estimated cost, for the spend meter.
Parsing is deliberately tolerant: Actors are third-party and name fields slightly
differently, so each parser reads every spelling seen in their docs.
"""
import logging
import os
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

APIFY_BASE = "https://api.apify.com/v2"
RUN_EVENT = "apify_run"
SessionLocal = None  # replaced in tests

ACTORS = {
    "amazon": ("APIFY_AMAZON_ACTOR", "junglee~amazon-crawler", "APIFY_AMAZON_USD_PER_ITEM", 0.003),
    "trends": ("APIFY_TRENDS_ACTOR", "apify~google-trends-scraper", "APIFY_TRENDS_USD_PER_ITEM", 0.0003),
    "tiktok": ("APIFY_TIKTOK_ACTOR", "clockworks~tiktok-scraper", "APIFY_TIKTOK_USD_PER_ITEM", 0.004),
}


class ApifyError(Exception):
    pass


def token() -> str:
    return (os.getenv("APIFY_TOKEN") or "").strip()


def configured() -> bool:
    return bool(token())


def actor_id(kind: str) -> str:
    env, default, _, _ = ACTORS[kind]
    return (os.getenv(env) or default).strip().replace("/", "~")


def price_per_item(kind: str) -> float:
    _, _, env, default = ACTORS[kind]
    try:
        return max(0.0, float(os.getenv(env, default)))
    except ValueError:
        return default


def _log(kind: str, items: int, note: str = "") -> None:
    """One event per run with its estimated cost. Never raises."""
    try:
        from app.core import database
        from app.core.intel import record_event
        db = (SessionLocal or database.SessionLocal)()
        try:
            record_event(db, RUN_EVENT, entity_type="apify", payload={
                "kind": kind, "actor": actor_id(kind), "items": items, "cost": round(items * price_per_item(kind), 5), "note": note[:120]})
        finally:
            db.close()
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[apify] could not log run: {type(e).__name__}")


def run(kind: str, actor_input: dict, max_items: int = 20, timeout_s: int = 120) -> List[dict]:
    """Runs the Actor for `kind` and returns its rows. Raises ApifyError with a plain reason."""
    if not configured():
        raise ApifyError("APIFY_TOKEN is not set on the server.")
    try:
        r = httpx.post(f"{APIFY_BASE}/acts/{actor_id(kind)}/run-sync-get-dataset-items",
                       params={"token": token(), "timeout": timeout_s, "maxItems": max_items, "format": "json", "clean": "true"},
                       json=actor_input, timeout=timeout_s + 30)
    except httpx.HTTPError as e:
        raise ApifyError(f"Could not reach Apify ({type(e).__name__}).")
    if r.status_code == 401:
        raise ApifyError("Apify rejected the token. Check APIFY_TOKEN.")
    if r.status_code == 402:
        raise ApifyError("Apify says the account is out of credit for this month.")
    if r.status_code == 408:
        raise ApifyError("The Apify scraper took too long. Try again.")
    if r.status_code >= 300:
        raise ApifyError(f"Apify answered {r.status_code}: {r.text[:160]}")
    try:
        rows = r.json()
    except ValueError:
        raise ApifyError("Apify returned something that is not JSON.")
    rows = rows if isinstance(rows, list) else []
    _log(kind, len(rows))
    return rows


# ── tolerant field readers ───────────────────────────────────────────────────

def _first(d: dict, *keys) -> Any:
    for k in keys:
        cur: Any = d
        for part in k.split("."):
            cur = cur.get(part) if isinstance(cur, dict) else None
        if cur not in (None, "", []):
            return cur
    return None


def num(v: Any) -> Optional[float]:
    if v is None or v == "":
        return None
    if isinstance(v, dict):
        v = v.get("value") if v.get("value") is not None else v.get("amount")
    if isinstance(v, str):
        v = v.replace("$", "").replace(",", "").strip().split(" ")[0]
    try:
        n = float(v)
        return n if n >= 0 else None
    except (TypeError, ValueError):
        return None


# ── Amazon ───────────────────────────────────────────────────────────────────

def amazon_search(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    """Amazon.com search results for `query`, as plain dicts (title, price, asin, url, image, rating, reviews)."""
    from urllib.parse import quote_plus
    url = f"https://www.amazon.com/s?k={quote_plus(query)}"
    rows = run("amazon", {
        "categoryOrProductUrls": [{"url": url}], "startUrls": [{"url": url}], "search": query, "keyword": query,
        "maxItemsPerStartUrl": limit, "maxItems": limit, "maxSearchPagesPerStartUrl": 1,
        "proxyCountry": "AUTO_SELECT_PROXY_COUNTRY", "scrapeProductDetails": False,
    }, max_items=limit)
    out = []
    for it in rows:
        title = _first(it, "title", "name", "productTitle")
        price = num(_first(it, "price", "price.value", "currentPrice", "priceValue", "offer.price", "extracted_price"))
        if not title or not price:
            continue
        out.append({
            "title": str(title), "price": price,
            "currency": _first(it, "price.currency", "currency") or "USD",
            "asin": _first(it, "asin", "productAsin", "id"),
            "url": _first(it, "url", "productUrl", "link"),
            "image": _first(it, "thumbnailImage", "image", "imageUrl", "thumbnail", "mainImage"),
            "rating": num(_first(it, "stars", "rating", "averageRating", "productRating")),
            "reviews": int(num(_first(it, "reviewsCount", "reviews", "ratingsCount", "numberOfReviews", "countReview")) or 0) or None,
            "brand": _first(it, "brand", "manufacturer"),
        })
    return out[:limit]


# ── Google Trends ────────────────────────────────────────────────────────────

def trends_series(keyword: str, geo: str = "US"):
    """(series, countries) in the shape app/intel/trends.py expects:
    series [(unix_ts, 0-100)] weekly over 5 years; countries [{country, code, index}];
    related {"rising": [{query, value}], "top": [{query, value}]} - what else people search for."""
    rows = run("trends", {"searchTerms": [keyword], "timeRange": "today 5-y", "geo": "" if geo in ("", "WW", "ALL") else geo,
                          "isMultiple": False, "isPublic": False, "skipDebugScreen": True, "maxItems": 1}, max_items=3)
    series, countries, related = [], [], {"rising": [], "top": []}
    for it in rows:
        for kind in ("rising", "top"):
            for q in (_first(it, f"relatedQueries_{kind}") or [])[:10]:
                if isinstance(q, dict) and q.get("query"):
                    related[kind].append({"query": str(q["query"])[:80], "value": q.get("formattedValue") or q.get("value")})
        timeline = _first(it, "interestOverTime_timelineData", "interestOverTime.timelineData", "timelineData", "interestOverTime") or []
        for p in timeline if isinstance(timeline, list) else []:
            t = num(_first(p, "time", "timestamp"))
            val = p.get("value")
            v = num(val[0] if isinstance(val, list) and val else val)
            if t is not None and v is not None:
                series.append((int(t), v))
        regions = _first(it, "interestBy", "interestByCountry", "interestByRegion", "interestBySubregion", "geoMapData") or []
        for g in regions if isinstance(regions, list) else []:
            val = g.get("value")
            v = num(val[0] if isinstance(val, list) and val else val)
            name = _first(g, "geoName", "name", "location")
            if name and v:
                countries.append({"country": name, "code": _first(g, "geoCode", "code"), "index": int(v)})
        if series:
            break
    countries.sort(key=lambda c: c["index"], reverse=True)
    return sorted(series), countries, related


# ── TikTok ───────────────────────────────────────────────────────────────────

def hashtag_for(keyword: str) -> str:
    return "".join(ch for ch in (keyword or "").lower() if ch.isalnum())[:40]


def tiktok_hashtag(keyword: str, limit: int = 20) -> Dict[str, Any]:
    """Recent videos for the product's hashtag (#posturecorrector), summed up."""
    tag = hashtag_for(keyword)
    if not tag:
        raise ApifyError("No hashtag to look up.")
    rows = run("tiktok", {"hashtags": [tag], "resultsPerPage": limit, "maxItems": limit, "shouldDownloadVideos": False,
                          "shouldDownloadCovers": False, "shouldDownloadSubtitles": False, "shouldDownloadSlideshowImages": False},
               max_items=limit, timeout_s=150)
    videos = []
    for it in rows:
        views = num(_first(it, "playCount", "stats.playCount", "views", "viewCount"))
        if views is None:
            continue
        videos.append({
            "url": _first(it, "webVideoUrl", "url", "videoUrl"), "views": int(views),
            "likes": int(num(_first(it, "diggCount", "stats.diggCount", "likes")) or 0),
            "shares": int(num(_first(it, "shareCount", "stats.shareCount", "shares")) or 0),
            "created": _first(it, "createTimeISO", "createTime", "createdAt"),
            "author": _first(it, "authorMeta.name", "author.uniqueId", "authorMeta.nickName"),
            "text": (str(_first(it, "text", "desc", "description") or ""))[:140],
            "cover": _first(it, "videoMeta.coverUrl", "covers.default", "cover"),
        })
    return {"hashtag": tag, "videos": sorted(videos, key=lambda v: v["views"], reverse=True)}
