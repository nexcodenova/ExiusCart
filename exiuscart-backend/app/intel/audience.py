"""Who to target: the audience to show a product's ads to.

An AI SUGGESTION built on top of whatever REAL data the product has (it is
always labelled that way on screen):
  * Google Trends countries / direction   -> where to advertise first
  * TikTok hashtag videos and views        -> whether TikTok is worth it
  * Amazon/eBay ratings and review counts  -> how established the market is
  * the product itself (name, description, price, category)

The AI never invents numbers: it is told to use the real ones it is given and to
reason about the rest (age, interests, angles). Countries come from Google Trends
when we have them. The result is saved on the product (products.audience_json),
so it is paid for once and shared by everyone viewing that product.
"""
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

PLATFORMS = ["Facebook", "Instagram", "TikTok", "Pinterest", "YouTube", "Google Shopping", "Snapchat"]


def _real_signals(snap: Optional[dict]) -> Dict[str, Any]:
    snap = snap or {}
    out: Dict[str, Any] = {}
    d = snap.get("demand") or {}
    if d.get("status") == "ok":
        out["google_trends"] = {"direction": d.get("direction"), "summary": d.get("summary"), "peak_month": d.get("peak_month"),
                                "top_regions": [c.get("country") for c in (d.get("countries") or [])[:5]]}
    t = snap.get("tiktok") or {}
    if t.get("status") == "ok":
        out["tiktok"] = {"hashtag": t.get("hashtag"), "videos_found": t.get("videos_found"), "median_views": t.get("median_views"),
                         "recent_videos": t.get("recent_videos"), "top_video_captions": [v.get("text") for v in (t.get("top") or []) if v.get("text")][:3]}
    listings = snap.get("listings") or []
    if listings:
        reviews = [l.get("review_count") for l in listings if l.get("review_count")]
        out["marketplaces"] = {"competitor_listings": len(listings), "most_reviews": max(reviews) if reviews else None,
                               "price_range": [min(l["price"] for l in listings), max(l["price"] for l in listings)],
                               "example_titles": [l.get("title") for l in listings[:4]]}
    return out


def prompt(product: dict, signals: dict) -> str:
    return (
        "You are a senior performance marketer for ecommerce. Decide who this product's ads should target.\n"
        "Rules: use the REAL DATA numbers exactly as given and never invent statistics, sales or follower counts. "
        "Where the data says nothing, reason from the product itself and say so briefly. Be specific and practical "
        "(things a seller can type into Meta or TikTok Ads Manager).\n"
        f"PRODUCT: {json.dumps(product, ensure_ascii=False)[:3000]}\n"
        f"REAL DATA: {json.dumps(signals, ensure_ascii=False)[:3000] if signals else 'none yet'}\n"
        "Reply with JSON only, exactly these keys:\n"
        '{"summary": "one sentence: who buys this and why",'
        ' "age_range": "e.g. 25-44", "gender": "mostly women | mostly men | everyone",'
        ' "personas": [{"name": "short label", "who": "one line", "why_they_buy": "one line"}] (2-3),'
        ' "interests": ["Meta/TikTok interest targets"] (6-10),'
        ' "countries": ["best countries to start with"] (3-5, prefer the Google Trends regions when given),'
        f' "platforms": [{{"name": "one of {PLATFORMS}", "why": "one line"}}] (2-3, best first),'
        ' "ad_angles": ["hooks for the first 3 seconds of a video ad"] (4-5),'
        ' "hashtags": ["#..."] (6-10)}'
    )


def _ask(p: str) -> Optional[dict]:
    """Claude first (already on the spend meter), then GPT, then Gemini."""
    from app.intel import ai
    out = ai.ask_json(p, max_tokens=1500, purpose="audience")
    if isinstance(out, dict) and out:
        return out
    from app.core import ai_studio
    for fn in (ai_studio._openai_text, ai_studio._gemini_text):
        try:
            r = fn(p)
            if isinstance(r, dict) and r:
                return r
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[audience] provider failed: {type(e).__name__}")
    return None


def _clean_list(v: Any, n: int, maxlen: int = 80) -> List[str]:
    return [str(x).strip()[:maxlen] for x in (v or []) if str(x).strip()][:n]


def build(product: dict, snap: Optional[dict]) -> Optional[dict]:
    """The audience dict, or None when no AI provider answered."""
    signals = _real_signals(snap)
    raw = _ask(prompt(product, signals))
    if not raw:
        return None
    countries = _clean_list(raw.get("countries"), 5, 40)
    real_regions = (signals.get("google_trends") or {}).get("top_regions") or []
    platforms = [{"name": str(p.get("name", ""))[:30], "why": str(p.get("why", ""))[:160]}
                 for p in (raw.get("platforms") or []) if isinstance(p, dict) and p.get("name")][:3]
    tt = signals.get("tiktok")
    return {
        "summary": str(raw.get("summary") or "")[:240],
        "age_range": str(raw.get("age_range") or "")[:20] or None,
        "gender": str(raw.get("gender") or "")[:20] or None,
        "personas": [{"name": str(p.get("name", ""))[:60], "who": str(p.get("who", ""))[:160], "why_they_buy": str(p.get("why_they_buy", ""))[:160]}
                     for p in (raw.get("personas") or []) if isinstance(p, dict) and p.get("name")][:3],
        "interests": _clean_list(raw.get("interests"), 10, 60),
        "countries": countries,
        "search_regions": real_regions[:5],      # REAL: where Google searches for it come from
        "platforms": platforms,
        "ad_angles": _clean_list(raw.get("ad_angles"), 5, 160),
        "hashtags": [h if h.startswith("#") else f"#{h}" for h in _clean_list(raw.get("hashtags"), 10, 40)],
        "tiktok_proof": {"hashtag": tt.get("hashtag"), "videos": tt.get("videos_found"), "median_views": tt.get("median_views")} if tt else None,
        "based_on": [k for k in ("google_trends", "tiktok", "marketplaces") if k in signals] + ["product details"],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def latest_snapshot(db, product_id: int) -> Optional[dict]:
    from app.models.intel import ProductIntelResult
    row = (db.query(ProductIntelResult).filter(ProductIntelResult.product_id == product_id)
           .order_by(ProductIntelResult.id.desc()).first())
    return row.snapshot if row else None


def product_brief(p) -> dict:
    import re
    return {"name": p.name, "category": p.category.name if getattr(p, "category", None) else None,
            "price": float(p.price) if p.price is not None else None,
            "description": re.sub(r"<[^>]+>", " ", p.description or "")[:1500]}
