"""Building the order we send to CJ Dropshipping (createOrderV2).

Pure functions, no network and no database, so every rule here can be tested without a CJ
account. The rules come from CJ's own API documentation (createOrderV2 and freightCalculate):

  * orderNumber, shippingCountryCode, shippingCountry, shippingProvince, shippingCity,
    shippingCustomerName, shippingAddress, fromCountryCode, logisticName and products are REQUIRED.
  * logisticName must be a shipping method CJ itself quoted for that route (freightCalculate).
  * payType: 1 = page payment (deprecated), 2 = pay from the CJ balance, 3 = create the order only.

The one rule that is ours: we never guess where a parcel goes. A missing country, city or
recipient means the order is NOT sent and the seller is told exactly what is missing.
"""
import json
import os
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from app.core.country_utils import COUNTRY_NAME_TO_ISO

PAY_BALANCE = 2
CREATE_ONLY = 3


class FulfilProblem(Exception):
    """Something the seller can fix. `code` is stable for the screen and the tests."""

    def __init__(self, message: str, code: str = "fulfil_problem"):
        super().__init__(message)
        self.message, self.code = message, code


# Country names CJ expects in shippingCountry, for the codes a shop is likely to ship to.
ISO_NAMES = {
    "US": "United States", "CA": "Canada", "GB": "United Kingdom", "AU": "Australia", "NZ": "New Zealand", "IE": "Ireland",
    "DE": "Germany", "FR": "France", "ES": "Spain", "IT": "Italy", "NL": "Netherlands", "BE": "Belgium", "AT": "Austria",
    "CH": "Switzerland", "SE": "Sweden", "NO": "Norway", "DK": "Denmark", "FI": "Finland", "PL": "Poland", "PT": "Portugal",
    "CZ": "Czech Republic", "GR": "Greece", "HU": "Hungary", "RO": "Romania", "AE": "United Arab Emirates", "SA": "Saudi Arabia",
    "QA": "Qatar", "KW": "Kuwait", "BH": "Bahrain", "OM": "Oman", "JO": "Jordan", "IL": "Israel", "TR": "Turkey", "EG": "Egypt",
    "LK": "Sri Lanka", "IN": "India", "PK": "Pakistan", "BD": "Bangladesh", "NP": "Nepal", "MY": "Malaysia", "SG": "Singapore",
    "TH": "Thailand", "ID": "Indonesia", "PH": "Philippines", "VN": "Vietnam", "JP": "Japan", "KR": "South Korea", "HK": "Hong Kong",
    "TW": "Taiwan", "CN": "China", "MX": "Mexico", "BR": "Brazil", "AR": "Argentina", "CL": "Chile", "CO": "Colombia", "PE": "Peru",
    "ZA": "South Africa", "NG": "Nigeria", "KE": "Kenya", "GH": "Ghana", "MA": "Morocco",
}


@dataclass
class Shipping:
    name: str
    phone: str
    address: str
    city: str
    province: str
    zip: str
    country_code: str
    country: str


def _first(d: Dict[str, Any], *keys: str) -> str:
    for k in keys:
        v = d.get(k)
        if v is not None and str(v).strip():
            return str(v).strip()
    return ""


def _country_code(d: Dict[str, Any]) -> str:
    code = _first(d, "country_code", "countryCode", "country_iso")
    if len(code) == 2 and code.isalpha():
        return code.upper()
    name = _first(d, "country", "country_name")
    if len(name) == 2 and name.isalpha():
        return name.upper()
    key = re.sub(r"[^A-Z]", "", name.upper())
    if key:
        for n, iso in COUNTRY_NAME_TO_ISO.items():
            if re.sub(r"[^A-Z]", "", n) == key:
                return iso
        for iso, n in ISO_NAMES.items():
            if re.sub(r"[^A-Z]", "", n.upper()) == key:
                return iso
    return ""


def parse_shipping(raw: Optional[str], fallback_name: str = "", fallback_phone: str = "") -> Shipping:
    """The order's stored shipping address as structured fields, or FulfilProblem naming what is missing.

    The address is stored as a JSON string with name, phone, address, city, province, zip and
    country_code (or country). Plain free text cannot be shipped safely: it does not say which
    country, so it is refused instead of guessed."""
    if not raw or not str(raw).strip():
        raise FulfilProblem("This order has no shipping address. Add one to the order, then send it again.", "no_address")
    d: Dict[str, Any] = {}
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            d = parsed
    except (ValueError, TypeError):
        pass
    if not d:
        raise FulfilProblem(
            "The shipping address is plain text, so we cannot tell which country and city it is for. "
            "Fulfil this order by hand, or have your website send the address as separate fields "
            "(name, address, city, province, zip, country_code).", "unstructured_address")

    line2 = _first(d, "address2", "address_line2", "apartment", "unit")
    address = _first(d, "address", "address1", "address_line1", "street", "line1")
    if address and line2:
        address = f"{address}, {line2}"
    code = _country_code(d)
    city = _first(d, "city", "town")
    province = _first(d, "province", "state", "region", "county") or city      # some countries have no province: CJ still needs one
    name = _first(d, "name", "full_name", "customer_name", "recipient", "shipping_name") or (fallback_name or "").strip()

    missing = [label for label, v in (("recipient name", name), ("street address", address), ("city", city), ("country", code)) if not v]
    if missing:
        raise FulfilProblem(f"The shipping address is missing: {', '.join(missing)}. Fix it on the order, then send it again.", "incomplete_address")
    country = _first(d, "country", "country_name")
    if not country or (len(country) == 2 and country.isalpha()):
        country = ISO_NAMES.get(code, code)
    return Shipping(name=name[:50], phone=(_first(d, "phone", "telephone", "mobile") or fallback_phone or "")[:20], address=address[:500],
                    city=city[:50], province=province[:50], zip=_first(d, "zip", "postal_code", "postcode", "zipcode")[:20],
                    country_code=code, country=country[:50])


def origin_country(warehouse_countries: List[Optional[str]]) -> str:
    """Where the parcel ships from. One CJ order has one origin, so a mixed order is refused."""
    codes = {(c or "CN").strip().upper()[:2] or "CN" for c in warehouse_countries}
    if len(codes) > 1:
        raise FulfilProblem("The items in this order ship from different CJ warehouses, which CJ cannot combine into one order. "
                            "Send them separately by hand.", "mixed_origin")
    return codes.pop() if codes else "CN"


def _days(v: Any) -> float:
    m = re.search(r"\d+(\.\d+)?", str(v or ""))
    return float(m.group(0)) if m else 999.0


def pick_logistics(options: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """The cheapest shipping method CJ quoted (faster wins a tie), the same basis the profit estimate uses."""
    usable = [o for o in options if o.get("logisticName")]
    if not usable:
        return None
    return sorted(usable, key=lambda o: (float(o.get("logisticPrice") or 0), _days(o.get("logisticAging"))))[0]


def pay_type() -> int:
    """2 = pay from the CJ balance (normal). 3 = create only, for a live test that must not spend money.
    Set CJ_PAY_TYPE=3 on the server for the test, then remove it."""
    return CREATE_ONLY if os.getenv("CJ_PAY_TYPE", "").strip() == str(CREATE_ONLY) else PAY_BALANCE


def cj_order_number(order_number: str) -> str:
    """CJ needs a unique id per order from us. Ours is already unique, so CJ also refuses a second send of the same order."""
    return f"EC-{order_number}"[:50]


def build_payload(order_number: str, ship: Shipping, from_country: str, logistic_name: str, lines: List[Dict[str, Any]], pay: Optional[int] = None) -> Dict[str, Any]:
    if not lines:
        raise FulfilProblem("Order has no items.", "no_items")
    return {
        "orderNumber": cj_order_number(order_number),
        "shippingCountryCode": ship.country_code,
        "shippingCountry": ship.country,
        "shippingProvince": ship.province,
        "shippingCity": ship.city,
        "shippingZip": ship.zip,
        "shippingCustomerName": ship.name,
        "shippingAddress": ship.address,
        "shippingPhone": ship.phone,
        "fromCountryCode": from_country,
        "logisticName": logistic_name,
        "payType": pay if pay is not None else pay_type(),
        "remark": f"ExiusCart order {order_number}",
        "products": lines,
    }


# ── Addresses in and out ─────────────────────────────────────────────────────

def address_to_text(v: Any) -> Optional[str]:
    """What gets stored on the order. A structured address (an object) is kept as JSON so it can be
    shipped later; plain text is kept as it is."""
    if v is None:
        return None
    if isinstance(v, dict):
        clean = {k: v[k] for k in v if v[k] not in (None, "")}
        return json.dumps(clean, ensure_ascii=False) if clean else None
    s = str(v).strip()
    return s or None


def address_display(text: Optional[str]) -> Optional[str]:
    """A one-line, human-readable form for screens that show an address (customer record, packing slip)."""
    if not text:
        return text
    try:
        d = json.loads(text)
    except (ValueError, TypeError):
        return text
    if not isinstance(d, dict):
        return text
    parts = [_first(d, "name", "full_name"), _first(d, "address", "address1", "street"), _first(d, "address2"),
             _first(d, "city"), _first(d, "province", "state", "region"), _first(d, "zip", "postal_code", "postcode"),
             _first(d, "country", "country_code")]
    return ", ".join(p for p in parts if p) or text


# ── State / province codes (Printful needs them for the US, Canada and Australia) ─────────────

STATE_REQUIRED = {"US", "CA", "AU"}

_STATES = {
    "US": {"AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California", "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware",
           "DC": "District of Columbia", "FL": "Florida", "GA": "Georgia", "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "IA": "Iowa",
           "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland", "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota",
           "MS": "Mississippi", "MO": "Missouri", "MT": "Montana", "NE": "Nebraska", "NV": "Nevada", "NH": "New Hampshire", "NJ": "New Jersey",
           "NM": "New Mexico", "NY": "New York", "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma", "OR": "Oregon",
           "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina", "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah",
           "VT": "Vermont", "VA": "Virginia", "WA": "Washington", "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming"},
    "CA": {"AB": "Alberta", "BC": "British Columbia", "MB": "Manitoba", "NB": "New Brunswick", "NL": "Newfoundland and Labrador", "NS": "Nova Scotia",
           "NT": "Northwest Territories", "NU": "Nunavut", "ON": "Ontario", "PE": "Prince Edward Island", "QC": "Quebec", "SK": "Saskatchewan", "YT": "Yukon"},
    "AU": {"ACT": "Australian Capital Territory", "NSW": "New South Wales", "NT": "Northern Territory", "QLD": "Queensland", "SA": "South Australia",
           "TAS": "Tasmania", "VIC": "Victoria", "WA": "Western Australia"},
}


def state_code(country_code: str, province: str) -> str:
    """The short code for a state or province ("Texas" -> "TX"), or "" when it is not known. Codes pass through."""
    table = _STATES.get((country_code or "").upper())
    if not table:
        return ""
    p = (province or "").strip()
    if p.upper() in table:
        return p.upper()
    key = re.sub(r"[^A-Z]", "", p.upper())
    for code, name in table.items():
        if re.sub(r"[^A-Z]", "", name.upper()) == key:
            return code
    return ""
