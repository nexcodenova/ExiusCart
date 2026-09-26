"""Step 1: understand what the product is, so we can search for it.

A supplier title is long and stuffed with keywords ("Automatic Pet Water
Fountain Cat Dog Drinking Dispenser USB"). Marketplaces search far better on a
short, plain description, and matching works better on attributes than on the
exact title. Claude writes that; if it can't, we fall back to the first plain
words of the title (and say so via `method`).
"""
import re
from typing import List

from app.intel import ai
from app.intel.types import Fingerprint, ProductSource

_STOP = {"the", "a", "an", "for", "and", "with", "of", "in", "to", "new", "hot", "sale", "2023", "2024", "2025", "2026",
         "cheap", "free", "shipping", "wholesale", "dropshipping", "pcs", "pc", "set", "style"}


def _words(text: str) -> List[str]:
    return [w for w in re.sub(r"[^\w\s-]", " ", (text or "").lower()).split() if w and w not in _STOP]


def title_only(source: ProductSource) -> Fingerprint:
    words = _words(source.title)
    queries = []
    if words:
        queries.append(" ".join(words[:5]))
        if len(words) > 3:
            queries.append(" ".join(words[:3]))
    return Fingerprint(product_type=" ".join(words[:4]) or (source.title or "")[:60], search_queries=queries, method="title-only")


def _clean_queries(qs) -> List[str]:
    out: List[str] = []
    for q in qs if isinstance(qs, list) else []:
        if isinstance(q, str) and q.strip():
            q = re.sub(r"\s+", " ", q.strip())[:80]
            if q.lower() not in [x.lower() for x in out]:
                out.append(q)
    return out[:3]


def build(source: ProductSource) -> Fingerprint:
    fallback = title_only(source)
    specs = "; ".join(f"{k}: {v}" for k, v in list((source.specs or {}).items())[:12])
    prompt = f"""You help a seller research a product before selling it online.

Supplier listing:
Title: {source.title}
Description: {(source.description or '')[:800]}
Specifications: {specs or 'none given'}

Reply with ONLY this JSON (no other text):
{{
  "product_type": "plain 2-5 word name a shopper would use, e.g. 'automatic pet water fountain'",
  "category": "one short category, e.g. 'pet supplies'",
  "attributes": {{"key": "value", "...": "at most 8 facts that define this product: capacity, power, material, size, connectivity"}},
  "search_queries": ["2 or 3 short marketplace search phrases, most specific first, no brand names, no supplier keyword-stuffing"],
  "audience": "who buys it, in a few words"
}}
Only state facts that appear in the listing. Do not invent specifications."""
    data = ai.ask_json(prompt, max_tokens=500)
    if not isinstance(data, dict):
        return fallback
    queries = _clean_queries(data.get("search_queries"))
    ptype = str(data.get("product_type") or "").strip()
    if not queries or not ptype:
        return fallback
    attrs = data.get("attributes") if isinstance(data.get("attributes"), dict) else {}
    return Fingerprint(
        product_type=ptype[:80], category=(str(data.get("category") or "").strip() or None),
        attributes={str(k)[:40]: str(v)[:80] for k, v in list(attrs.items())[:8]},
        search_queries=queries, audience=(str(data.get("audience") or "").strip()[:80] or None), method="ai",
    )
