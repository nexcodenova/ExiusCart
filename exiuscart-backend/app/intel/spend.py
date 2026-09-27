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

    month = {"ai_calls": 0, "tok_in": 0, "tok_out": 0, "paid": 0, "free": 0}
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
            if when >= month_start:
                month["paid"] += 1
            if when >= day_start:
                today["paid"] += 1
            if day in daily:
                daily[day]["paid"] += p["paid_lookup"]
        else:
            if when >= month_start:
                month["free"] += 1
            if when >= day_start:
                today["free"] += 1

    trends_month = db.query(KeywordTrend).filter(KeywordTrend.fetched_at >= month_start).count()
    analyses_month = db.query(ProductIntelResult).filter(ProductIntelResult.created_at >= month_start).count()

    claude_cost = ai_cost(month["tok_in"], month["tok_out"])
    paid_cost = month["paid"] * p["paid_lookup"]
    total = claude_cost + paid_cost
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
            {"key": "ebay", "label": "eBay lookups", "uses": month["free"], "unit": "lookups", "cost": 0.0, "detail": "free, official API", "today": today["free"], "free": True},
            {"key": "trends", "label": "Google Trends", "uses": trends_month, "unit": "keywords", "cost": 0.0, "detail": "free, saved for a week per keyword", "today": None, "free": True},
        ],
        "analyses": analyses_month,
        "total": round(total, 4), "budget": budget, "percent": round(total / budget * 100, 1) if budget else None,
        "projected": round(projected, 4), "over_budget": bool(budget and projected > budget),
        "paid_limits": {"today": limits["today"], "month": limits["month"], "daily_limit": limits["daily_limit"], "monthly_limit": limits["monthly_limit"]},
        "daily": [{"date": d, "ai": round(v["ai"], 4), "paid": round(v["paid"], 4), "total": round(v["ai"] + v["paid"], 4)} for d, v in daily.items()],
    }
