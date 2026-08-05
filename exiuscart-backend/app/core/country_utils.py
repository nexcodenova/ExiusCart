import re

# Shared across every channel that gates on a shop's country (eBay
# marketplace/location, Daraz's per-market API domain, and any future
# one) — pulled out after the same bug showed up twice: shop.country is a
# free-text field ("Srilanka", "UAE", "Sri Lanka"), not a dropdown, so a
# raw uppercase-string lookup against a 2-letter-code dict misses real,
# supported countries whenever the text doesn't happen to match exactly.
COUNTRY_NAME_TO_ISO = {
    "UAE": "AE",
    "UNITED ARAB EMIRATES": "AE",
    "SRI LANKA": "LK",
    "USA": "US",
    "UNITED STATES": "US",
    "UK": "GB",
    "UNITED KINGDOM": "GB",
    "CANADA": "CA",
    "INDIA": "IN",
    "PAKISTAN": "PK",
    "BANGLADESH": "BD",
    "NEPAL": "NP",
    "MYANMAR": "MM",
}


def shop_country_iso(country: str | None) -> str | None:
    """Returns a 2-letter ISO code, or None when it can't be resolved —
    never a guess, since this can end up deciding a real listing's
    location or which country-specific API domain to call. Matches with
    spaces/punctuation stripped ("SriLanka", "Sri-Lanka", "Sri Lanka" all
    hit the same key)."""
    raw = (country or "").strip()
    if len(raw) == 2:
        return raw.upper()
    normalized = re.sub(r"[^A-Z]", "", raw.upper())
    for name, iso in COUNTRY_NAME_TO_ISO.items():
        if re.sub(r"[^A-Z]", "", name) == normalized:
            return iso
    return None
