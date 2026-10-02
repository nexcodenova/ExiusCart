"""Prodora scores: the plain 0-100 numbers a seller reads on a product card.

Every score is worked out from data we really hold and says where it came from. A score we cannot
measure is None with a reason, never a guess: a made-up "TikTok potential 93/100" would end the trust
that makes Prodora different. So the seller sees, honestly, "3 of 7 measured".

Nothing here touches the network or the database, so every formula is tested on its own.

  margin        estimated profit per sale after fees (from the analysis), or the catalogue's own numbers
  competition   how crowded the market is: higher = more same-product listings (a WARNING score)
  demand        Google search interest and its trend (needs Google Trends; not measured until then)
  shipping      0 to 10: how little the shipping eats of the selling price
  supplier      the supplier's rating and fulfilment rate as entered on the product (our team's entry)
  content       not measured in this version
  tiktok        hashtag videos and views from TikTok (via Apify), after a full market check

The overall Prodora score blends only what was measured, and says how much that was. It is only given once the
product has had a real market check (competition measured); before that a card shows the parts, not a total.
"""
import math
import re
from statistics import mean
from typing import Any, Dict, List, Optional

# Weights of the overall score, and whether a higher raw score is better (competition is inverted).
WEIGHTS = {"margin": 0.35, "demand": 0.25, "competition": 0.20, "shipping": 0.10, "supplier": 0.10}
COMPONENTS = ["demand", "competition", "content", "margin", "shipping", "supplier", "tiktok"]

NOT_MEASURED_WHY = {
    "demand": "Needs Google Trends data, which is not connected yet.",
    "competition": "Needs a market check on eBay. This product has not been checked yet.",
    "content": "Not measured in this version.",
    "shipping": "No shipping cost or time is recorded for this product.",
    "supplier": "No supplier rating is recorded for this product.",
    "tiktok": "Not checked yet. It is part of a full market check.",
    "margin": "No supplier cost is recorded for this product.",
}


def clamp(v: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, v))


def _score(value: Optional[float], source: Optional[str], why: Optional[str] = None, **extra) -> Dict[str, Any]:
    out = {"value": None if value is None else int(round(value)), "measured": value is not None, "source": source, "why": why}
    out.update(extra)
    return out


def margin_score(pct: Optional[float]) -> Optional[float]:
    """10% margin is 0, 50% or more is 100: the range a dropshipper actually cares about."""
    return None if pct is None else clamp((pct - 10.0) / 40.0 * 100.0)


def competition_score(same_product_listings: Optional[int]) -> Optional[float]:
    """0 for an empty market up to 100 for a crowded one. 6 listings is about 45, 12 about 70, 25 about 92."""
    if same_product_listings is None:
        return None
    return clamp(100.0 * (1.0 - math.exp(-max(0, same_product_listings) / 10.0)))


def saturation_label(competition: Optional[float]) -> Optional[str]:
    if competition is None:
        return None
    return "Low" if competition < 35 else "Medium" if competition < 65 else "High"


def demand_score(demand: Optional[dict]) -> Optional[float]:
    """From Google search interest: how high it is now and which way it is moving. None unless really measured."""
    if not demand or demand.get("status") != "ok" or demand.get("direction") in (None, "unknown"):
        return None
    level = clamp(float(demand.get("level") or 0))
    yoy = demand.get("yoy_change")
    trend = clamp(50.0 + 100.0 * float(yoy)) if yoy is not None else 50.0
    score = 0.5 * level + 0.5 * trend
    if demand.get("direction") == "low_interest":
        score = min(score, 20.0)
    return clamp(score)


def _days(text: Optional[str]) -> Optional[float]:
    """The longest number of days in text like "7-12 Days" -> 12."""
    nums = [float(n) for n in re.findall(r"\d+(?:\.\d+)?", text or "")]
    return max(nums) if nums else None


def shipping_score(shipping_cost: Optional[float], price: Optional[float], shipping_time: Optional[str] = None) -> Optional[float]:
    """0 to 10. Shipping that is a small share of the price scores high; a very long delivery takes points off."""
    if shipping_cost is None or not price or price <= 0:
        return None
    score = 10.0 - (float(shipping_cost) / float(price)) * 25.0
    days = _days(shipping_time)
    if days is not None and days > 15:
        score -= min(3.0, (days - 15) / 5.0)
    return clamp(score, 0.0, 10.0)


def supplier_score(rating: Optional[float], fulfilment_rate: Optional[float]) -> Optional[float]:
    """From the supplier's star rating (of 5) and fulfilment rate (%), as entered on the product."""
    parts: List[float] = []
    if rating is not None:
        parts.append(clamp(float(rating) * 20.0))
    if fulfilment_rate is not None:
        parts.append(clamp(float(fulfilment_rate)))
    return mean(parts) if parts else None


def catalogue_margin_pct(price: Optional[float], cost: Optional[float], shipping: Optional[float]) -> Optional[float]:
    """A rough margin from the catalogue's own numbers, before payment fees, refunds and ads."""
    if not price or price <= 0 or cost is None:
        return None
    return (float(price) - float(cost) - float(shipping or 0)) / float(price) * 100.0


def compute(product: dict, analysis: Optional[dict] = None) -> Dict[str, Any]:
    """product: price, cost_price, shipping_cost, shipping_time, supplier_rating, fulfillment_rate.
    analysis: {"snapshot": {...}, "evaluation": {...}} from the intelligence engine, or None if not checked yet."""
    snap = (analysis or {}).get("snapshot") or {}
    ev = (analysis or {}).get("evaluation") or {}
    price = product.get("price")

    # margin: the analysis' real number when there is one, otherwise the catalogue's rough one
    econ = ev.get("economics") or {}
    if econ.get("contribution_margin_pct") is not None:
        m_pct, m_src, m_why = float(econ["contribution_margin_pct"]), "market analysis (after fees, refunds, shipping)", None
    else:
        m_pct = catalogue_margin_pct(price, product.get("cost_price"), product.get("shipping_cost"))
        m_src, m_why = "catalogue prices (before fees)", None if m_pct is not None else NOT_MEASURED_WHY["margin"]
    margin = _score(margin_score(m_pct), m_src if m_pct is not None else None, m_why, pct=None if m_pct is None else round(m_pct, 1))

    # competition: only when a real market check found which sources answered
    answered = any(s.get("status") == "ok" for s in snap.get("sources", []))
    listings = snap.get("listings") or []
    n = len(listings) if answered else None
    comp_raw = competition_score(n)
    competition = _score(comp_raw, f"{n} same-product listings on eBay" if n is not None else None,
                         None if n is not None else NOT_MEASURED_WHY["competition"], listings=n)

    d_raw = demand_score(snap.get("demand"))
    demand = _score(d_raw, "Google search interest" if d_raw is not None else None, None if d_raw is not None else NOT_MEASURED_WHY["demand"],
                    direction=(snap.get("demand") or {}).get("direction") if d_raw is not None else None)

    s_raw = shipping_score(product.get("shipping_cost"), price, product.get("shipping_time"))
    shipping = _score(None if s_raw is None else s_raw * 10.0, "shipping cost against the price" if s_raw is not None else None,
                      None if s_raw is not None else NOT_MEASURED_WHY["shipping"], out_of_10=None if s_raw is None else round(s_raw, 1))

    sup_raw = supplier_score(product.get("supplier_rating"), product.get("fulfillment_rate"))
    supplier = _score(sup_raw, "supplier rating as entered by our team" if sup_raw is not None else None,
                      None if sup_raw is not None else NOT_MEASURED_WHY["supplier"])

    from app.intel.tiktok import score as tiktok_score_fn
    tt = snap.get("tiktok") or {}
    t_raw = tiktok_score_fn(tt)
    tiktok = _score(t_raw, f"#{tt.get('hashtag')} on TikTok: {tt.get('videos_found', 0)} recent videos" if t_raw is not None else None,
                    None if t_raw is not None else (tt.get("note") or NOT_MEASURED_WHY["tiktok"]),
                    median_views=tt.get("median_views") if t_raw is not None else None)

    scores = {"demand": demand, "competition": competition, "content": _score(None, None, NOT_MEASURED_WHY["content"]),
              "margin": margin, "shipping": shipping, "supplier": supplier, "tiktok": tiktok}

    # overall: only what was measured, with competition turned round so that "less crowded" scores higher
    parts = {"margin": margin["value"], "demand": demand["value"], "shipping": shipping["value"], "supplier": supplier["value"],
             "competition": None if competition["value"] is None else 100 - competition["value"]}
    used = {k: v for k, v in parts.items() if v is not None}
    weight = sum(WEIGHTS[k] for k in used)
    overall = round(sum(WEIGHTS[k] * v for k, v in used.items()) / weight) if weight else None
    if not answered:
        overall = None      # no market check yet: a rough catalogue margin alone must never look like a 91/100
    measured = sum(1 for k in COMPONENTS if scores[k]["measured"])
    return {
        "scores": scores, "overall": overall, "measured": measured, "of": len(COMPONENTS),
        "saturation": saturation_label(comp_raw), "checked": answered,
        "verdict": ev.get("verdict"), "confidence": ev.get("confidence"), "headline": ev.get("headline"),
        "competitor_count": n, "why": why_line(scores, snap.get("demand")),
    }


def why_line(scores: Dict[str, Dict[str, Any]], demand: Optional[dict]) -> str:
    """One plain sentence built ONLY from the measured numbers above (never written by an AI)."""
    bits: List[str] = []
    m = scores["margin"]
    if m["measured"]:
        bits.append(f"{m['pct']:.0f}% estimated margin")
    c = scores["competition"]
    if c["measured"]:
        bits.append("no same-product listings found on eBay" if c["listings"] == 0 else f"{c['listings']} same-product listings on eBay")
    if scores["demand"]["measured"] and demand and demand.get("summary"):
        bits.append(str(demand["summary"]).rstrip("."))
    s = scores["shipping"]
    if s["measured"] and s["out_of_10"] is not None:
        bits.append(f"shipping {s['out_of_10']:.0f}/10")
    if not bits:
        return "Not enough data yet to say more."
    return ", ".join(bits) + "."
