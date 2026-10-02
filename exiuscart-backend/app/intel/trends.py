"""Demand: what Google search interest says about a product.

WHAT THIS IS, AND IS NOT: Google Trends shows how much people SEARCH for a term
(a relative 0 to 100 scale, where 100 is the peak), not how many units sell.
Everything here is labelled "search interest" for that reason.

Data comes from Google's own Trends API (alpha, application-only). Google does not
publish its request format, sign-in method or response shape; approved testers get
them privately. So the ONE place that talks to Google is `_google_query()` below,
and it stays switched off until the alpha documentation is in hand. Everything else
(direction, seasonality, summary, cache, screens) is finished and independent of it.

From the raw numbers we work out, in plain code (no AI):
  * direction   rising / steady / falling, from this year against last year
  * seasonality does interest peak in the same month every year
  * countries   where it is searched most
  * a 52-week line for a small chart

Results are cached per KEYWORD (not per product) for a week and shared by
everyone, so two sellers checking similar products never look up the same term twice.
Google's own API is not one of the paid marketplace lookups, so a fetch is not counted against that budget.

`check()` powers the admin "Test connection" button.
"""
import logging
import os
import re
from datetime import datetime, timedelta, timezone
from statistics import mean
from typing import Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.intel import KeywordTrend

logger = logging.getLogger(__name__)

TTL = timedelta(days=7)
LOOKUPS_PER_FETCH = 0          # Google's own API: nothing is counted against the paid-lookup budget
TIMEOUT = 25.0
MIN_POINTS = 26                # about half a year of weekly data, or we say "not enough"
LOW_INTEREST = 5               # average interest below this = hardly anyone searches
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]


NOT_CONFIGURED_HINT = "Add APIFY_TOKEN on the server (or GOOGLE_TRENDS_API_KEY once Google's own Trends API alpha is approved)."


def _apify_on() -> bool:
    from app.intel import apify
    return apify.configured()


def configured() -> bool:
    return bool(os.getenv("GOOGLE_TRENDS_API_KEY", "")) or _apify_on()


def normalise(keyword: str) -> str:
    """One cache key for "Pet Water Fountain!" and "pet  water fountain"."""
    words = re.sub(r"[^\w\s-]", " ", (keyword or "").lower()).split()
    return " ".join(words[:6])


# ── Turning raw numbers into statements (pure functions, easy to test) ───────

def _pct(a: float, b: float) -> Optional[float]:
    return None if not b else a / b - 1.0


def analyze_series(points: List[Tuple[int, float]]) -> dict:
    """points: (unix_timestamp, interest 0-100), oldest first, ideally weekly over 5 years."""
    pts = sorted((int(t), float(v)) for t, v in points)
    vals = [v for _, v in pts]
    if len(vals) < MIN_POINTS:
        return {"direction": "unknown", "note": "Not enough search history for this term."}

    last52 = vals[-52:]
    level = mean(vals[-4:])
    avg52 = mean(last52)
    momentum = _pct(mean(vals[-8:]), mean(vals[-16:-8])) if len(vals) >= 16 else None
    yoy = _pct(mean(vals[-13:]), mean(vals[-65:-52])) if len(vals) >= 65 else None

    if avg52 < LOW_INTEREST:
        direction = "low_interest"
    else:
        ref = yoy if yoy is not None else momentum
        if ref is None:
            direction = "unknown"
        elif ref >= 0.15 and (momentum is None or momentum > -0.10):
            direction = "rising"
        elif ref <= -0.15 and (momentum is None or momentum < 0.10):
            direction = "falling"
        else:
            direction = "steady"

    seasonal, peak_month, strength = _seasonality(pts)
    return {
        "direction": direction,
        "yoy_change": None if yoy is None else round(yoy, 3),
        "recent_change": None if momentum is None else round(momentum, 3),
        "level": round(level),                       # latest 4 weeks, on Google's 0-100 scale
        "average_52w": round(avg52, 1),
        "seasonal": seasonal, "peak_month": peak_month, "seasonality_strength": strength,
        "sparkline": [{"date": datetime.fromtimestamp(t, tz=timezone.utc).strftime("%Y-%m-%d"), "value": round(v)} for t, v in pts[-52:]],
    }


def _seasonality(pts: List[Tuple[int, float]]) -> Tuple[Optional[bool], Optional[str], Optional[float]]:
    """Seasonal = the same calendar month is the peak in most years AND stands well above
    the yearly average. Needs about three years of data; otherwise None ("unknown")."""
    if len(pts) < 150:
        return None, None, None
    by_year: Dict[int, Dict[int, List[float]]] = {}
    for t, v in pts:
        d = datetime.fromtimestamp(t, tz=timezone.utc)
        by_year.setdefault(d.year, {}).setdefault(d.month, []).append(v)
    peaks, strengths = [], []
    for year, months in by_year.items():
        if len(months) < 12:                         # skip partial years
            continue
        avgs = {m: mean(vs) for m, vs in months.items()}
        overall = mean(avgs.values())
        if overall <= 0:
            continue
        top = max(avgs, key=avgs.get)
        peaks.append(top)
        strengths.append(avgs[top] / overall)
    if len(peaks) < 2:
        return None, None, None
    common = max(set(peaks), key=peaks.count)
    share = peaks.count(common) / len(peaks)
    strength = mean(s for p, s in zip(peaks, strengths) if p == common)
    if share >= 0.6 and strength >= 1.4:
        return True, MONTHS[common - 1], round(strength, 2)
    return False, None, round(strength, 2)


def monthly(points: List[Tuple[int, float]]) -> List[dict]:
    """The whole (5-year) series as monthly averages, for a bigger chart than the 52-week sparkline."""
    buckets: Dict[str, List[float]] = {}
    for t, v in sorted(points):
        key = datetime.fromtimestamp(int(t), tz=timezone.utc).strftime("%Y-%m")
        buckets.setdefault(key, []).append(float(v))
    return [{"month": k, "value": round(mean(vs))} for k, vs in buckets.items()]


def summarise(d: dict) -> str:
    """One plain-English line for the screen and the verdict."""
    if d.get("direction") in (None, "unknown"):
        return d.get("note") or "Not enough search history to judge demand."
    bits = []
    yoy = d.get("yoy_change")
    if d["direction"] == "low_interest":
        bits.append("Very few people search for this")
    elif yoy is not None:
        word = {"rising": "up", "falling": "down", "steady": "about the same"}[d["direction"]]
        bits.append(f"Search interest is {word} {abs(yoy) * 100:.0f}% on last year" if d["direction"] != "steady" else "Search interest is steady compared with last year")
    if d.get("seasonal") and d.get("peak_month"):
        bits.append(f"peaks around {d['peak_month']} each year")
    return ", ".join(bits) + "."


# ── Fetching ─────────────────────────────────────────────────────────────────

def _google_query(keyword: str, geo: str) -> Tuple[List[Tuple[int, float]], List[dict]]:
    """THE ONLY PLACE THAT TALKS TO GOOGLE. Must return:
      series    [(unix_timestamp, interest 0-100), ...] weekly, oldest first, about 5 years
      countries [{"country": "Canada", "code": "CA", "index": 72}, ...] highest first

    Not written yet on purpose: Google's alpha request format, sign-in method and
    response fields are only given to approved testers, and guessing them would ship
    a connection that fails silently. Fill this in from Google's private alpha
    documentation; nothing else in the demand feature needs to change.

    Until then, Apify's Google Trends scraper supplies the same numbers (app/intel/apify.py)."""
    if not os.getenv("GOOGLE_TRENDS_API_KEY", "") and _apify_on():
        from app.intel import apify
        try:
            return apify.trends_series(keyword, geo)       # (series, countries, related)
        except apify.ApifyError as e:
            raise RuntimeError(str(e))
    raise NotImplementedError("Google Trends API connection is waiting for alpha documentation.")


def fetch(keyword: str, geo: str = "US") -> dict:
    """One live lookup through Google's API. Returns a demand dict; never raises."""
    try:
        res = _google_query(keyword, geo)
        series, countries = res[0], res[1]
        related = res[2] if len(res) > 2 else {}
        analysis = analyze_series(series)
        out = {"status": "insufficient" if analysis.get("direction") == "unknown" else "ok", "keyword": keyword, "geo": geo,
               "source": "Google Trends" if os.getenv("GOOGLE_TRENDS_API_KEY", "") else "Google Trends (via Apify)", "fetched_at": datetime.now(timezone.utc).isoformat(), "lookups": LOOKUPS_PER_FETCH,
               "countries": countries[:8], "related": related, "monthly": monthly(series), **analysis}
        out["summary"] = summarise(out)
        return out
    except NotImplementedError:
        return {"status": "not_configured", "keyword": keyword, "geo": geo, "lookups": 0, "note": NOT_CONFIGURED_HINT}
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[trends] fetch failed: {type(e).__name__}")
        return {"status": "error", "keyword": keyword, "geo": geo, "lookups": 0, "note": "Could not reach Google Trends."}


def check() -> dict:
    """One real fetch for the admin Test connection button."""
    if not configured():
        return {"source": "google_trends", "ok": False, "status": "not_configured", "detail": NOT_CONFIGURED_HINT}
    d = fetch("phone case", "US")
    return {"source": "google_trends", "ok": d["status"] == "ok", "status": d["status"],
            "detail": d.get("summary") or d.get("note") or "No data returned.", "lookups": 0}


# ── Cache shared by everyone ─────────────────────────────────────────────────

def cached(db: Session, keyword: str, geo: str = "US") -> Optional[dict]:
    row = db.query(KeywordTrend).filter(KeywordTrend.keyword == normalise(keyword), KeywordTrend.geo == geo).first()
    if not row:
        return None
    fetched = row.fetched_at if row.fetched_at.tzinfo else row.fetched_at.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) - fetched > TTL:
        return None
    return row.payload


def store(db: Session, keyword: str, geo: str, payload: dict) -> None:
    key = normalise(keyword)
    row = db.query(KeywordTrend).filter(KeywordTrend.keyword == key, KeywordTrend.geo == geo).first()
    if row:
        row.payload, row.fetched_at = payload, datetime.now(timezone.utc)
    else:
        db.add(KeywordTrend(keyword=key, geo=geo, payload=payload, fetched_at=datetime.now(timezone.utc)))
    db.commit()
