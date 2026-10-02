"""TikTok: is this product actually being talked about on TikTok?

Recent videos for the product's hashtag (e.g. #posturecorrector) come from Apify's
TikTok scraper (app/intel/apify.py). From them, in plain code (no AI):
  * how many videos we found and their total / median views
  * how many were posted in the last 30 days (is it still alive?)
  * the top 3 videos, so the seller can watch real proof

Cached per keyword for a week and shared by everyone (KeywordTrend rows with geo
"TIKTOK"), like Google Trends. A lookup is a paid lookup: it only runs for
shortlisted products, inside the daily/monthly caps (engine.py).
"""
import logging
from datetime import datetime, timedelta, timezone
from statistics import median
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.intel import KeywordTrend

logger = logging.getLogger(__name__)

CACHE_GEO = "TIKTOK"
TTL = timedelta(days=7)
RECENT_DAYS = 30


def _when(v: Any) -> Optional[datetime]:
    if not v:
        return None
    try:
        if isinstance(v, (int, float)) or str(v).isdigit():
            return datetime.fromtimestamp(int(v), tz=timezone.utc)
        d = datetime.fromisoformat(str(v).replace("Z", "+00:00"))
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except (ValueError, OSError):
        return None


def analyze(hashtag: str, videos: List[Dict[str, Any]], now: Optional[datetime] = None) -> Dict[str, Any]:
    now = now or datetime.now(timezone.utc)
    if not videos:
        return {"status": "ok", "hashtag": hashtag, "videos_found": 0, "total_views": 0, "median_views": 0, "recent_videos": 0,
                "top": [], "summary": f"No TikTok videos found for #{hashtag}."}
    views = [v["views"] for v in videos]
    recent = sum(1 for v in videos if (_when(v.get("created")) or datetime.min.replace(tzinfo=timezone.utc)) >= now - timedelta(days=RECENT_DAYS))
    out = {"status": "ok", "hashtag": hashtag, "videos_found": len(videos), "total_views": sum(views), "median_views": int(median(views)),
           "recent_videos": recent, "top": videos[:3]}
    out["summary"] = (f"{len(videos)} recent videos for #{hashtag}, {sum(views):,} views in total "
                      f"(median {int(median(views)):,}); {recent} posted in the last {RECENT_DAYS} days.")
    return out


def score(t: Optional[dict]) -> Optional[float]:
    """0-100 from the median views of the top videos (10k ~ 40, 100k ~ 70, 1M+ ~ 100) and how fresh they are.
    None unless really measured."""
    import math
    if not t or t.get("status") != "ok":
        return None
    if not t.get("videos_found"):
        return 0.0
    med = max(1, int(t.get("median_views") or 0))
    reach = max(0.0, min(100.0, (math.log10(med) - 2.0) * 25.0))          # 100 views = 0, 1M = 100
    freshness = min(1.0, (t.get("recent_videos") or 0) / max(1, t["videos_found"]) * 2)  # half recent or more = full
    return round(max(0.0, min(100.0, reach * (0.6 + 0.4 * freshness))))


def cached(db: Session, keyword: str) -> Optional[dict]:
    from app.intel.trends import normalise
    row = db.query(KeywordTrend).filter(KeywordTrend.keyword == normalise(keyword), KeywordTrend.geo == CACHE_GEO).first()
    if not row:
        return None
    fetched = row.fetched_at if row.fetched_at.tzinfo else row.fetched_at.replace(tzinfo=timezone.utc)
    return row.payload if datetime.now(timezone.utc) - fetched <= TTL else None


def store(db: Session, keyword: str, payload: dict) -> None:
    from app.intel.trends import normalise
    key = normalise(keyword)
    row = db.query(KeywordTrend).filter(KeywordTrend.keyword == key, KeywordTrend.geo == CACHE_GEO).first()
    if row:
        row.payload, row.fetched_at = payload, datetime.now(timezone.utc)
    else:
        db.add(KeywordTrend(keyword=key, geo=CACHE_GEO, payload=payload, fetched_at=datetime.now(timezone.utc)))
    db.commit()


def fetch(keyword: str) -> dict:
    """One live lookup. Never raises."""
    from app.intel import apify
    if not apify.configured():
        return {"status": "not_configured", "note": "Add APIFY_TOKEN on the server."}
    try:
        r = apify.tiktok_hashtag(keyword)
    except apify.ApifyError as e:
        return {"status": "error", "note": str(e)}
    return {**analyze(r["hashtag"], r["videos"]), "keyword": keyword, "fetched_at": datetime.now(timezone.utc).isoformat()}
