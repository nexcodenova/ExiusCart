"""The data spend meter: what running Prodora Intelligence costs this month, and how that sits against the budget.

Only real, logged usage counts. Every Claude call is logged with the tokens it used (app/intel/ai.py), every paid
marketplace lookup and every free one is logged (app/intel/engine.py), and Google Trends lookups are the saved
keyword rows. The dollar figures are ESTIMATES from list prices, which can be changed with environment settings
when a supplier changes its price.

  INTEL_MONTHLY_BUDGET_USD               the monthly data budget (default 10)
  INTEL_CLAUDE_INPUT_USD_PER_MTOK        Claude Haiku input price per million tokens (default 1.0)
  INTEL_CLAUDE_OUTPUT_USD_PER_MTOK       output price per million tokens (default 5.0)
  INTEL_PAID_USD_PER_LOOKUP              one paid Amazon/Walmart search (default 0.025)
"""
import calendar
import os
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional

from sqlalchemy.orm import Session

from app.intel import ai, engine
from app.models.intel import KeywordTrend, PlatformEvent, ProductIntelResult

DAYS_SHOWN = 14


def _f(name: str, default: float) -> float:
    try:
        return max(0.0, float(os.getenv(name, default)))
    except ValueError:
        return default


def prices() -> Dict[str, float]:
    return {"claude_in": _f("INTEL_CLAUDE_INPUT_USD_PER_MTOK", 1.0), "claude_out": _f("INTEL_CLAUDE_OUTPUT_USD_PER_MTOK", 5.0),
            "paid_lookup": _f("INTEL_PAID_USD_PER_LOOKUP", 0.025), "budget": _f("INTEL_MONTHLY_BUDGET_USD", 10.0)}


def _aware(d: datetime) -> datetime:
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def report(db: Session, now: Optional[datetime] = None) -> dict:
    now = now or datetime.now(timezone.utc)
    p = prices()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    series_start = day_start - timedelta(days=DAYS_SHOWN - 1)
    since = min(month_start, series_start)

    events = (db.query(PlatformEvent.event_type, PlatformEvent.payload, PlatformEvent.created_at)
              .filter(PlatformEvent.event_type.in_([ai.AI_EVENT, engine.PAID_EVENT, engine.FREE_EVENT]), PlatformEvent.created_at >= since).all())

    month = {"ai_calls": 0, "tok_in": 0, "tok_out": 0, "paid": 0, "paid_costed": 0, "free": 0}
    from app.intel import apify as _apify
    apify_on = _apify.configured()
    today = {"ai_calls": 0, "paid": 0, "free": 0}
    by_purpose: Dict[str, int] = defaultdict(int)
    daily: Dict[str, Dict[str, float]] = {(series_start + timedelta(days=i)).date().isoformat(): {"ai": 0.0, "paid": 0.0} for i in range(DAYS_SHOWN)}

    def ai_cost(tin: int, tout: int) -> float:
        return tin / 1e6 * p["claude_in"] + tout / 1e6 * p["claude_out"]

    for etype, payload, created in events:
        when = _aware(created)
        day = when.date().isoformat()
        payload = payload or {}
        if etype == ai.AI_EVENT:
            tin, tout = int(payload.get("in") or 0), int(payload.get("out") or 0)
            if when >= month_start:
                month["ai_calls"] += 1; month["tok_in"] += tin; month["tok_out"] += tout
                by_purpose[str(payload.get("purpose") or "analysis")] += 1
            if when >= day_start:
                today["ai_calls"] += 1
            if day in daily:
                daily[day]["ai"] += ai_cost(tin, tout)
        elif etype == engine.PAID_EVENT:
            # Counted for the caps either way; costed here only when it did NOT go through Apify
            # (Apify runs carry their own real cost, added below, so they are not charged twice).
            via_apify = apify_on and str(payload.get("source") or "") in ("amazon", "tiktok")
            if when >= month_start:
                month["paid"] += 1
                if not via_apify:
                    month["paid_costed"] += 1
            if when >= day_start:
                today["paid"] += 1
            if day in daily and not via_apify:
                daily[day]["paid"] += p["paid_lookup"]
        else:
            if when >= month_start:
                month["free"] += 1
            if when >= day_start:
                today["free"] += 1

    # Apify (Amazon, Google Trends, TikTok): each run logged with its own estimated cost
    from app.intel.apify import RUN_EVENT as APIFY_EVENT
    apify_rows = (db.query(PlatformEvent.payload, PlatformEvent.created_at)
                  .filter(PlatformEvent.event_type == APIFY_EVENT, PlatformEvent.created_at >= since).all())
    apify_m = {"runs": 0, "cost": 0.0, "today": 0, "by_kind": defaultdict(int)}
    for payload, created in apify_rows:
        payload, when = payload or {}, _aware(created)
        cost = float(payload.get("cost") or 0)
        day = when.date().isoformat()
        if day in daily:
            daily[day]["paid"] += cost
        if when >= month_start:
            apify_m["runs"] += 1
            apify_m["cost"] += cost
            apify_m["by_kind"][str(payload.get("kind") or "other")] += 1
        if when >= day_start:
            apify_m["today"] += 1

    # AI Studio (product copy + images, app/core/ai_studio.py): each call logged with its own estimated cost
    from app.core.ai_studio import STUDIO_EVENT
    studio_rows = (db.query(PlatformEvent.payload, PlatformEvent.created_at)
                   .filter(PlatformEvent.event_type == STUDIO_EVENT, PlatformEvent.created_at >= since).all())
    studio = {"images": 0, "texts": 0, "cost": 0.0, "today": 0}
    for payload, created in studio_rows:
        payload, when = payload or {}, _aware(created)
        cost = float(payload.get("cost") or 0)
        day = when.date().isoformat()
        if day in daily:
            daily[day]["ai"] += cost
        if when >= month_start:
            studio["images" if payload.get("kind") == "image" else "texts"] += 1
            studio["cost"] += cost
        if when >= day_start:
            studio["today"] += 1

    trends_month = db.query(KeywordTrend).filter(KeywordTrend.fetched_at >= month_start).count()
    analyses_month = db.query(ProductIntelResult).filter(ProductIntelResult.created_at >= month_start).count()

    claude_cost = ai_cost(month["tok_in"], month["tok_out"])
    paid_cost = month["paid_costed"] * p["paid_lookup"]
    total = claude_cost + paid_cost + studio["cost"] + apify_m["cost"]
    days_in_month = calendar.monthrange(now.year, now.month)[1]
    projected = total / max(now.day, 1) * days_in_month
    limits = engine.paid_usage(db)
    budget = p["budget"]
    return {
        "month": month_start.strftime("%Y-%m"), "generated_at": now.isoformat(), "estimate_note": "Dollar amounts are estimates from list prices.",
        "lines": [
            {"key": "claude", "label": "Claude (understanding, matching, writing)", "uses": month["ai_calls"], "unit": "calls", "cost": round(claude_cost, 4),
             "detail": f"{month['tok_in']:,} tokens in, {month['tok_out']:,} out", "today": today["ai_calls"], "free": False,
             "by_purpose": dict(by_purpose)},
            {"key": "paid", "label": "Amazon and Walmart lookups (paid)", "uses": month["paid"], "unit": "lookups", "cost": round(paid_cost, 4),
             "detail": f"limit {limits['monthly_limit']} a month, {limits['daily_limit']} a day", "today": today["paid"], "free": False},
            {"key": "apify", "label": "Apify (Amazon, Google Trends, TikTok)", "uses": apify_m["runs"], "unit": "runs",
             "cost": round(apify_m["cost"], 4), "detail": ", ".join(f"{n} {k}" for k, n in apify_m["by_kind"].items()) or "no runs yet",
             "today": apify_m["today"], "free": False},
            {"key": "ai_studio", "label": "AI Studio (product images and copy, GPT/Gemini/Claude)", "uses": studio["images"] + studio["texts"],
             "unit": "calls", "cost": round(studio["cost"], 4), "detail": f"{studio['images']} images, {studio['texts']} copy calls",
             "today": studio["today"], "free": False},
            {"key": "ebay", "label": "eBay lookups", "uses": month["free"], "unit": "lookups", "cost": 0.0, "detail": "free, official API", "today": today["free"], "free": True},
            {"key": "trends", "label": "Google Trends", "uses": trends_month, "unit": "keywords", "cost": 0.0, "detail": "free, saved for a week per keyword", "today": None, "free": True},
        ],
        "analyses": analyses_month,
        "total": round(total, 4), "budget": budget, "percent": round(total / budget * 100, 1) if budget else None,
        "projected": round(projected, 4), "over_budget": bool(budget and projected > budget),
        "paid_limits": {"today": limits["today"], "month": limits["month"], "daily_limit": limits["daily_limit"], "monthly_limit": limits["monthly_limit"]},
        "daily": [{"date": d, "ai": round(v["ai"], 4), "paid": round(v["paid"], 4), "total": round(v["ai"] + v["paid"], 4)} for d, v in daily.items()],
    }
