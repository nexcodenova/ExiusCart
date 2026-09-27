"""Turning "Find me products for US pet owners under $30" into search filters.

This is the ONLY thing the AI does in Prodora search: understand the sentence. It never chooses products
or produces numbers; our own code searches the catalogue and scores every match from real data. If the AI
is off or answers badly, a plain rule-based reader does the same job, so search never depends on it.
"""
import re
from typing import Any, Dict, List, Optional

from app.intel import ai

MAX_KEYWORDS = 10

_STOP = set("""a an the and or of for to in on with without from by at as is are be me my our your find show get give need want looking look
search products product items item something anything any some best top good great cheap new trending popular winning ideas idea
under below over above less more than least most max maximum min minimum up about around dollars dollar usd us usa america american
selling sell sells price priced pricing margin profit profitable owners owner people lovers lover buyers buyer customers customer
market markets store stores shop shops dropshipping dropship please can could would""".split())

# A few obvious families so the fallback is not literal-only. The AI reader handles the rest.
_SYNONYMS = {
    "pet": ["pet", "dog", "cat", "puppy", "kitten"], "dog": ["dog", "puppy", "pet"], "cat": ["cat", "kitten", "pet"],
    "baby": ["baby", "infant", "newborn", "toddler"], "kitchen": ["kitchen", "cooking", "cook"],
    "car": ["car", "auto", "vehicle"], "phone": ["phone", "smartphone", "iphone", "mobile"],
    "fitness": ["fitness", "gym", "workout", "exercise"], "beauty": ["beauty", "skin", "skincare", "makeup", "hair"],
}


def _expand(word: str) -> List[str]:
    """The word plus its family, whichever member was typed: "puppy" brings "dog" and "pet" too."""
    out: List[str] = []
    for key, family in _SYNONYMS.items():
        if word == key or word in family:
            for w in family:
                if w not in out:
                    out.append(w)
    return out or [word]


def _num(s: str) -> float:
    return float(s.replace(",", ""))


def parse_rules(text: str) -> Dict[str, Any]:
    t = (text or "").lower()
    max_price = min_price = min_margin = None

    m = re.search(r"\$?\s*(\d+(?:[.,]\d+)?)\s*(?:-|to|and)\s*\$?\s*(\d+(?:[.,]\d+)?)", t)
    if m and ("$" in t or "dollar" in t or "usd" in t or "price" in t or "under" in t or "between" in t):
        lo, hi = sorted((_num(m.group(1)), _num(m.group(2))))
        min_price, max_price = lo, hi
    else:
        m = re.search(r"(?:under|below|less than|cheaper than|max(?:imum)?(?: price)?(?: of)?|up to|no more than|within|<=?)\s*\$?\s*(\d+(?:[.,]\d+)?)", t)
        if m:
            max_price = _num(m.group(1))
        m = re.search(r"(?:over|above|more than|at least|min(?:imum)?(?: price)?(?: of)?|from|>=?)\s*\$\s*(\d+(?:[.,]\d+)?)", t)
        if m:
            min_price = _num(m.group(1))
    m = re.search(r"(\d+(?:\.\d+)?)\s*%\s*(?:\+\s*)?(?:margin|profit)", t) or re.search(r"(?:margin|profit)\D{0,20}(\d+(?:\.\d+)?)\s*%", t)
    if m:
        min_margin = float(m.group(1))

    words = re.findall(r"[a-z][a-z\-]{1,}", re.sub(r"\$?\d+(?:[.,]\d+)?%?", " ", t))
    keywords: List[str] = []
    for w in words:
        if w in _STOP:
            continue
        singular = w[:-1] if w.endswith("s") and len(w) > 3 and not w.endswith("ss") else w
        for k in _expand(singular):
            if k not in keywords:
                keywords.append(k)
    return {"keywords": keywords[:MAX_KEYWORDS], "max_price": max_price, "min_price": min_price, "min_margin_pct": min_margin, "market": "US", "method": "rules"}


def _clean(data: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(data, dict):
        return None
    kws = data.get("keywords")
    if not isinstance(kws, list):
        return None
    keywords = []
    for k in kws:
        if isinstance(k, str):
            k = re.sub(r"[^a-z0-9 \-]", "", k.lower()).strip()
            if 1 < len(k) <= 30 and k not in keywords:
                keywords.append(k)
    def num(v: Any, lo: float, hi: float) -> Optional[float]:
        try:
            f = float(v)
        except (TypeError, ValueError):
            return None
        return f if lo <= f <= hi else None
    market = str(data.get("market") or "US").upper()[:2]
    return {"keywords": keywords[:MAX_KEYWORDS], "max_price": num(data.get("max_price"), 0.01, 100000), "min_price": num(data.get("min_price"), 0, 100000),
            "min_margin_pct": num(data.get("min_margin_pct"), 0, 95), "market": market if market.isalpha() else "US", "method": "ai"}


def parse(text: str) -> Dict[str, Any]:
    """The filters for a request, from the AI when it is on, otherwise from plain rules."""
    text = (text or "").strip()[:300]
    prompt = f"""You turn a dropshipper's request into search filters for a product catalogue. Reply with JSON only:
{{"keywords": [up to 8 lowercase words a product NAME or CATEGORY could contain: the product types asked for plus close synonyms, singular, no filler words],
 "max_price": a number or null (the selling price ceiling in US dollars),
 "min_price": a number or null,
 "min_margin_pct": a number or null,
 "market": "US" unless the person names another country, then its 2-letter code}}

Request: "{text}\""""
    parsed = _clean(ai.ask_json(prompt, max_tokens=300, purpose="search"))
    rules = parse_rules(text)
    if not parsed or not parsed["keywords"] and not any(parsed[k] is not None for k in ("max_price", "min_price", "min_margin_pct")):
        return rules
    # what the rules read reliably (prices, margin) wins over a sloppy AI number
    for k in ("max_price", "min_price", "min_margin_pct"):
        if rules[k] is not None:
            parsed[k] = rules[k]
    return parsed


def describe(f: Dict[str, Any]) -> List[str]:
    """The filters as short plain phrases, shown back to the seller so they can see what was understood."""
    out: List[str] = []
    if f.get("keywords"):
        out.append("About: " + ", ".join(f["keywords"][:5]))
    if f.get("max_price") is not None and f.get("min_price") is not None:
        out.append(f"Selling ${f['min_price']:.0f} to ${f['max_price']:.0f}")
    elif f.get("max_price") is not None:
        out.append(f"Selling under ${f['max_price']:.0f}")
    elif f.get("min_price") is not None:
        out.append(f"Selling over ${f['min_price']:.0f}")
    if f.get("min_margin_pct") is not None:
        out.append(f"Margin at least {f['min_margin_pct']:.0f}%")
    out.append(f"Market: {f.get('market', 'US')}")
    return out
