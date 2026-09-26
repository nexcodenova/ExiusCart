"""Step 2: find real competitor listings.

One adapter per marketplace, all returning the same `Listing` shape, so the rest
of the engine never cares where a price came from. Adding Walmart or Etsy later
means adding an adapter, nothing else.

Sources, cheapest first:
  * eBay Browse API   free, official, needs EBAY_APP_ID + EBAY_CERT_ID (production keys)
  * Amazon via SerpApi   PAID per search, needs SERPAPI_API_KEY
  * Walmart via SerpApi  PAID per search, needs SERPAPI_API_KEY

Paid adapters are only used when the caller asks for them AND the daily/monthly
budget allows (enforced in engine.py). Only the US market is wired up in v1;
other markets return `unsupported_market` instead of quietly returning US data.

The eBay and SerpApi response parsing follows their public documentation but has
not yet been run against live keys. Each adapter has a `check()` used by the
admin "Test connection" button, so the first real call shows exactly what works.
"""
import base64
import logging
import os
import time
from typing import List, Optional

import httpx

from app.intel.types import Listing, SourceResult

logger = logging.getLogger(__name__)
TIMEOUT = 20.0
SUPPORTED_MARKETS = {"US"}


def _f(v) -> Optional[float]:
    try:
        if v is None or v == "":
            return None
        if isinstance(v, str):
            v = v.replace("$", "").replace(",", "").strip()
        n = float(v)
        return n if n > 0 else None
    except (TypeError, ValueError):
        return None


class MarketplaceAdapter:
    name = "base"
    paid = False

    def configured(self) -> bool:
        raise NotImplementedError

    def search(self, query: str, market: str = "US", limit: int = 30) -> SourceResult:
        raise NotImplementedError

    def check(self) -> dict:
        """One real search, reported plainly, for the 'Test connection' button."""
        if not self.configured():
            return {"source": self.name, "ok": False, "status": "not_configured", "detail": self.missing_hint()}
        r = self.search("phone case", "US", limit=3)
        return {"source": self.name, "ok": r.status == "ok" and len(r.listings) > 0, "status": r.status,
                "detail": r.note or f"{len(r.listings)} listings returned", "sample": [l.title[:60] for l in r.listings[:2]]}

    def missing_hint(self) -> str:
        return "Not configured."


# ── eBay Browse API ───────────────────────────────────────────────────────────

class EbayAdapter(MarketplaceAdapter):
    name = "ebay"
    paid = False
    _token: Optional[str] = None
    _token_exp: float = 0.0

    def _keys(self):
        return os.getenv("EBAY_APP_ID", ""), os.getenv("EBAY_CERT_ID", "")

    def _base(self) -> str:
        return "https://api.sandbox.ebay.com" if os.getenv("EBAY_ENV", "sandbox") == "sandbox" else "https://api.ebay.com"

    def configured(self) -> bool:
        a, c = self._keys()
        return bool(a and c)

    def missing_hint(self) -> str:
        return "Add EBAY_APP_ID and EBAY_CERT_ID (production keys) and set EBAY_ENV=production on the server."

    def _access_token(self) -> str:
        if EbayAdapter._token and time.time() < EbayAdapter._token_exp - 60:
            return EbayAdapter._token
        app_id, cert_id = self._keys()
        basic = base64.b64encode(f"{app_id}:{cert_id}".encode()).decode()
        r = httpx.post(
            f"{self._base()}/identity/v1/oauth2/token", timeout=TIMEOUT,
            headers={"Authorization": f"Basic {basic}", "Content-Type": "application/x-www-form-urlencoded"},
            data={"grant_type": "client_credentials", "scope": "https://api.ebay.com/oauth/api_scope"},
        )
        r.raise_for_status()
        j = r.json()
        EbayAdapter._token = j["access_token"]
        EbayAdapter._token_exp = time.time() + float(j.get("expires_in", 7200))
        return EbayAdapter._token

    def search(self, query: str, market: str = "US", limit: int = 30) -> SourceResult:
        if market not in SUPPORTED_MARKETS:
            return SourceResult(self.name, "unsupported_market", note=f"Only the US market is supported so far (asked for {market}).")
        if not self.configured():
            return SourceResult(self.name, "not_configured", note=self.missing_hint())
        try:
            token = self._access_token()
            r = httpx.get(
                f"{self._base()}/buy/browse/v1/item_summary/search", timeout=TIMEOUT,
                headers={"Authorization": f"Bearer {token}", "X-EBAY-C-MARKETPLACE-ID": "EBAY_US"},
                params={"q": query, "limit": min(max(limit, 1), 50), "filter": "buyingOptions:{FIXED_PRICE},priceCurrency:USD"},
            )
            r.raise_for_status()
            items = r.json().get("itemSummaries") or []
        except httpx.HTTPStatusError as e:
            return SourceResult(self.name, "error", note=f"eBay answered {e.response.status_code}. Check the keys and that EBAY_ENV=production.")
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[intel] eBay search failed: {type(e).__name__}: {e}")
            return SourceResult(self.name, "error", note="Could not reach eBay.")
        out: List[Listing] = []
        for it in items:
            price = _f((it.get("price") or {}).get("value"))
            if price is None or not it.get("title"):
                continue
            seller = it.get("seller") or {}
            out.append(Listing(
                marketplace="ebay", listing_id=str(it.get("itemId") or it.get("itemWebUrl") or it["title"]), title=it["title"], price=price,
                currency=(it.get("price") or {}).get("currency", "USD"), url=it.get("itemWebUrl"),
                image_url=(it.get("image") or {}).get("imageUrl"), seller=seller.get("username"),
            ))
        return SourceResult(self.name, "ok", listings=out, lookups=1)


# ── SerpApi (Amazon, Walmart): paid per search ───────────────────────────────

class _SerpAdapter(MarketplaceAdapter):
    paid = True
    engine = ""
    query_param = ""

    def configured(self) -> bool:
        return bool(os.getenv("SERPAPI_API_KEY", ""))

    def missing_hint(self) -> str:
        return "Add SERPAPI_API_KEY on the server (serpapi.com has a free tier for testing)."

    def _parse(self, data: dict) -> List[Listing]:
        raise NotImplementedError

    def search(self, query: str, market: str = "US", limit: int = 30) -> SourceResult:
        if market not in SUPPORTED_MARKETS:
            return SourceResult(self.name, "unsupported_market", paid=True, note=f"Only the US market is supported so far (asked for {market}).")
        if not self.configured():
            return SourceResult(self.name, "not_configured", paid=True, note=self.missing_hint())
        try:
            r = httpx.get("https://serpapi.com/search.json", timeout=TIMEOUT,
                          params={"engine": self.engine, self.query_param: query, "api_key": os.getenv("SERPAPI_API_KEY", "")})
            r.raise_for_status()
            listings = self._parse(r.json())[:limit]
        except httpx.HTTPStatusError as e:
            return SourceResult(self.name, "error", paid=True, note=f"SerpApi answered {e.response.status_code}. Check the key and your plan's remaining searches.", lookups=1)
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[intel] {self.name} search failed: {type(e).__name__}: {e}")
            return SourceResult(self.name, "error", paid=True, note="Could not reach SerpApi.")
        return SourceResult(self.name, "ok", listings=listings, paid=True, lookups=1)


class AmazonSerpAdapter(_SerpAdapter):
    name = "amazon"
    engine = "amazon"
    query_param = "k"

    def _parse(self, data: dict) -> List[Listing]:
        out = []
        for it in data.get("organic_results") or []:
            price = _f(it.get("extracted_price")) or _f(it.get("price"))
            if price is None or not it.get("title"):
                continue
            out.append(Listing(
                marketplace="amazon", listing_id=str(it.get("asin") or it.get("link") or it["title"]), title=it["title"], price=price,
                url=it.get("link_clean") or it.get("link"), image_url=it.get("thumbnail"), rating=_f(it.get("rating")),
                review_count=int(_f(it.get("reviews")) or 0) or None,
            ))
        return out


class WalmartSerpAdapter(_SerpAdapter):
    name = "walmart"
    engine = "walmart"
    query_param = "query"

    def _parse(self, data: dict) -> List[Listing]:
        out = []
        for it in data.get("organic_results") or []:
            offer = it.get("primary_offer") or {}
            price = _f(offer.get("offer_price")) or _f(it.get("price")) or _f(it.get("extracted_price"))
            if price is None or not it.get("title"):
                continue
            out.append(Listing(
                marketplace="walmart", listing_id=str(it.get("us_item_id") or it.get("product_id") or it.get("product_page_url") or it["title"]),
                title=it["title"], price=price, url=it.get("product_page_url"), image_url=it.get("thumbnail"),
                seller=it.get("seller_name"), rating=_f(it.get("rating")), review_count=int(_f(it.get("reviews")) or 0) or None,
            ))
        return out


def all_adapters() -> List[MarketplaceAdapter]:
    """Free first, then paid."""
    return [EbayAdapter(), AmazonSerpAdapter(), WalmartSerpAdapter()]


def adapter_by_name(name: str) -> Optional[MarketplaceAdapter]:
    return next((a for a in all_adapters() if a.name == name), None)
