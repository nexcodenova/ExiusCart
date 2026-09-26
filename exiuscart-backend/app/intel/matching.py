"""Step 3: keep only listings that are genuinely the SAME kind of product.

A search for "portable juicer" returns blenders, replacement blades and a $4
sticker. Comparing a price to those would be worse than having no data, so every
candidate is checked. Claude judges each one; with no AI available a strict
keyword-overlap check is used instead and the result is labelled as lower
confidence. Wild price outliers are then dropped (and counted) so one absurd
listing can't drag the market price around.
"""
import re
from statistics import median
from typing import List, Tuple

from app.intel import ai
from app.intel.types import Fingerprint, Listing, ProductSource

MIN_SCORE = 70            # a listing needs this to count as "the same product"
MAX_CANDIDATES = 40       # one AI call judges up to this many at once
# Words that mark a listing as a part or add-on rather than the product itself.
# Only used by the no-AI fallback: overlap alone can't tell "fountain" from
# "fountain replacement filter". A listing is rejected when it has one of these
# and OUR product does not.
_ACCESSORY = {"replacement", "refill", "refills", "filter", "filters", "cartridge", "cartridges", "spare", "parts", "part", "cover",
              "sticker", "stickers", "adapter", "adaptor", "accessory", "accessories", "holder", "case", "protector", "brush", "pump"}
_STOP = {"the", "a", "an", "for", "and", "with", "of", "in", "to", "new", "hot", "sale", "free", "shipping", "set", "pcs", "pc",
         "portable", "mini", "usb", "smart", "automatic", "electric"}


def _tokens(text: str) -> set:
    return {w for w in re.sub(r"[^\w\s]", " ", (text or "").lower()).split() if len(w) > 2 and w not in _STOP}


def _keyword_judge(fp: Fingerprint, source: ProductSource, listings: List[Listing]) -> None:
    """Fallback without AI. Conservative: needs real overlap with the product type."""
    want = _tokens(fp.product_type) or _tokens(source.title)
    if not want:
        return
    ours = _tokens(source.title) | want
    for l in listings:
        got = _tokens(l.title)
        overlap = len(want & got) / len(want)
        extra = (got & _ACCESSORY) - ours
        if extra:
            l.match_score = 0
            l.match_reason = f"Looks like a part or add-on ({', '.join(sorted(extra))}). Keyword check, no AI"
            continue
        l.match_score = int(min(100, overlap * 100))
        l.match_reason = f"{len(want & got)} of {len(want)} key words match (keyword check, no AI)"


def _ai_judge(fp: Fingerprint, source: ProductSource, listings: List[Listing]) -> bool:
    """Returns True if the AI answered (scores were set), False to fall back."""
    lines = "\n".join(f"{i}. [{l.marketplace}] {l.title[:110]} (${l.price:.2f})" for i, l in enumerate(listings))
    attrs = "; ".join(f"{k}: {v}" for k, v in fp.attributes.items())
    prompt = f"""A seller wants to know which marketplace listings compete directly with their product.

Their product: {fp.product_type}
Supplier title: {source.title[:140]}
Key facts: {attrs or 'none'}

Candidate listings:
{lines}

For each candidate decide: is it the SAME kind of product a shopper would compare against this one (same function and similar form)?
Accessories, replacement parts, different product types, bundles of unrelated items and multi-packs sold as a different product are NOT the same.
Reply with ONLY a JSON array, one item per candidate:
[{{"i": 0, "score": 0-100, "reason": "max 12 words"}}]
score 85+ = clearly the same product, 70-84 = very similar, below 70 = not a match."""
    data = ai.ask_json(prompt, max_tokens=1800)
    if not isinstance(data, list):
        return False
    seen = set()
    for row in data:
        try:
            i = int(row["i"])
            if 0 <= i < len(listings):
                listings[i].match_score = max(0, min(100, int(row["score"])))
                listings[i].match_reason = str(row.get("reason") or "")[:120] or None
                seen.add(i)
        except (KeyError, TypeError, ValueError):
            continue
    for i, l in enumerate(listings):
        if i not in seen:
            l.match_score, l.match_reason = 0, "not judged"
    return bool(seen)


def drop_outliers(listings: List[Listing]) -> Tuple[List[Listing], int]:
    """Remove listings priced far outside the pack (under a quarter or over 4x the
    median). Only with 4+ listings, so a tiny sample is never thinned further."""
    if len(listings) < 4:
        return listings, 0
    m = median(l.price for l in listings)
    kept = [l for l in listings if m * 0.25 <= l.price <= m * 4]
    return kept, len(listings) - len(kept)


def find_competitors(fp: Fingerprint, source: ProductSource, candidates: List[Listing]) -> dict:
    """{'competitors': [...], 'method': 'ai'|'keyword', 'rejected': n, 'outliers_dropped': n}"""
    seen, unique = set(), []
    for l in candidates:                                      # the same listing can come back from two queries
        key = (l.marketplace, l.listing_id)
        if key not in seen:
            seen.add(key)
            unique.append(l)
    unique = unique[:MAX_CANDIDATES]
    if not unique:
        return {"competitors": [], "method": "none", "rejected": 0, "outliers_dropped": 0, "candidates": 0}
    method = "ai" if _ai_judge(fp, source, unique) else "keyword"
    if method == "keyword":
        _keyword_judge(fp, source, unique)
    threshold = MIN_SCORE if method == "ai" else 60          # keyword overlap is a cruder signal; require solid overlap
    matched = [l for l in unique if (l.match_score or 0) >= threshold]
    kept, dropped = drop_outliers(matched)
    kept.sort(key=lambda l: l.price)
    return {"competitors": kept, "method": method, "rejected": len(unique) - len(matched), "outliers_dropped": dropped, "candidates": len(unique)}
