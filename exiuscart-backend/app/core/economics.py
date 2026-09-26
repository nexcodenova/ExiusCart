"""Product economics: what a sale really earns.

Plain arithmetic, no AI and no outside data - "$19.99 - $8.30" never needs a
language model. Every number that is a GUESS (payment fee, refund rate, ad cost)
is reported back in `assumptions` with where it came from, so the screen can
show "using our default of 3% refunds - set your own" instead of presenting a
default as a fact.

Money is handled as Decimal and rounded to cents only for output.
"""
from dataclasses import dataclass, field
from decimal import Decimal, ROUND_HALF_UP
from statistics import median
from typing import Dict, Iterable, List, Optional

CENT = Decimal("0.01")

# Defaults used ONLY when the caller doesn't supply their own. They are typical
# industry values, labelled as assumptions everywhere they surface.
DEFAULT_PAYMENT_FEE_PCT = Decimal("2.9")     # % of the sale (card processors)
DEFAULT_PAYMENT_FEE_FIXED = Decimal("0.30")  # per order
DEFAULT_REFUND_RATE_PCT = Decimal("3")       # % of orders refunded
DEFAULT_RETURN_COST_PCT = Decimal("2")       # % of price lost to returns/defects besides the refund itself


def _d(v, default: Decimal = Decimal("0")) -> Decimal:
    if v is None or v == "":
        return default
    return Decimal(str(v))


def _money(v: Decimal) -> float:
    return float(v.quantize(CENT, rounding=ROUND_HALF_UP))


def _pct(v: Decimal) -> float:
    return float(v.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


@dataclass
class EconomicsInput:
    selling_price: Decimal
    product_cost: Decimal
    shipping_cost: Decimal = Decimal("0")             # supplier shipping per order
    payment_fee_pct: Optional[Decimal] = None          # None -> default (an assumption)
    payment_fee_fixed: Optional[Decimal] = None
    platform_fee_pct: Decimal = Decimal("0")           # marketplace/channel commission, when selling there
    refund_rate_pct: Optional[Decimal] = None
    return_cost_pct: Optional[Decimal] = None
    ad_cost_per_order: Optional[Decimal] = None        # CAC; None = not known yet
    other_costs: Decimal = Decimal("0")
    assumptions_used: List[dict] = field(default_factory=list)


def calculate(
    selling_price, product_cost, shipping_cost=0, payment_fee_pct=None, payment_fee_fixed=None,
    platform_fee_pct=0, refund_rate_pct=None, return_cost_pct=None, ad_cost_per_order=None, other_costs=0,
) -> Dict:
    """Contribution profit for ONE order, and the break-even numbers that follow
    from it. Raises ValueError for a price that can't make sense."""
    price = _d(selling_price)
    cost = _d(product_cost)
    if price <= 0:
        raise ValueError("Selling price must be more than zero.")
    if cost < 0:
        raise ValueError("Product cost can't be negative.")

    assumptions: List[dict] = []

    def pick(value, default: Decimal, key: str, label: str, unit: str) -> Decimal:
        if value is None or value == "":
            assumptions.append({"key": key, "label": label, "value": float(default), "unit": unit,
                                "source": "ExiusCart default assumption. Set your own for a better number."})
            return default
        return _d(value)

    fee_pct = pick(payment_fee_pct, DEFAULT_PAYMENT_FEE_PCT, "payment_fee_pct", "Payment processing fee", "%")
    fee_fixed = pick(payment_fee_fixed, DEFAULT_PAYMENT_FEE_FIXED, "payment_fee_fixed", "Payment fee per order", "USD")
    refund_pct = pick(refund_rate_pct, DEFAULT_REFUND_RATE_PCT, "refund_rate_pct", "Orders refunded", "%")
    return_pct = pick(return_cost_pct, DEFAULT_RETURN_COST_PCT, "return_cost_pct", "Returns and defects", "%")

    ship = _d(shipping_cost)
    platform = price * _d(platform_fee_pct) / 100
    payment = price * fee_pct / 100 + fee_fixed
    refund_reserve = price * refund_pct / 100
    returns = price * return_pct / 100
    other = _d(other_costs)

    landed = cost + ship
    before_ads = price - landed - platform - payment - refund_reserve - returns - other

    ads_known = ad_cost_per_order is not None and ad_cost_per_order != ""
    ads = _d(ad_cost_per_order)
    contribution = before_ads - ads if ads_known else before_ads

    margin = (contribution / price * 100) if price else Decimal("0")
    margin_before_ads = before_ads / price * 100

    breakeven_cac = before_ads if before_ads > 0 else Decimal("0")
    breakeven_roas = (price / breakeven_cac) if breakeven_cac > 0 else None

    lines = [
        {"key": "selling_price", "label": "Selling price", "amount": _money(price), "kind": "revenue"},
        {"key": "product_cost", "label": "Product cost", "amount": -_money(cost), "kind": "cost"},
        {"key": "shipping", "label": "Supplier shipping", "amount": -_money(ship), "kind": "cost"},
    ]
    if platform:
        lines.append({"key": "platform_fee", "label": "Marketplace fee", "amount": -_money(platform), "kind": "cost"})
    lines += [
        {"key": "payment_fee", "label": "Payment fee", "amount": -_money(payment), "kind": "cost"},
        {"key": "refund_reserve", "label": "Refund reserve", "amount": -_money(refund_reserve), "kind": "cost"},
        {"key": "returns", "label": "Returns and defects", "amount": -_money(returns), "kind": "cost"},
    ]
    if other:
        lines.append({"key": "other", "label": "Other costs", "amount": -_money(other), "kind": "cost"})
    if ads_known:
        lines.append({"key": "advertising", "label": "Advertising cost per order", "amount": -_money(ads), "kind": "cost"})

    return {
        "lines": lines,
        "landed_cost": _money(landed),
        "profit_before_ads": _money(before_ads),
        "margin_before_ads_pct": _pct(margin_before_ads),
        "contribution_profit": _money(contribution),
        "contribution_margin_pct": _pct(margin),
        "advertising_included": bool(ads_known),
        # The most you can pay to win one order and still break even.
        "break_even_cac": _money(breakeven_cac),
        "break_even_roas": round(float(breakeven_roas), 2) if breakeven_roas is not None else None,
        "profitable_before_ads": before_ads > 0,
        "assumptions": assumptions,
        # High only when nothing was guessed; every default makes it a rough estimate.
        "confidence": "high" if not assumptions else ("medium" if len(assumptions) <= 2 else "low"),
    }


def price_for_margin(product_cost, shipping_cost=0, target_margin_pct=30, payment_fee_pct=None, payment_fee_fixed=None,
                     platform_fee_pct=0, refund_rate_pct=None, return_cost_pct=None, ad_cost_per_order=0, other_costs=0) -> Optional[float]:
    """The lowest price that still earns `target_margin_pct` contribution margin.
    Solved algebraically: price * (1 - variable_pct - margin) = fixed costs."""
    fee_pct = _d(payment_fee_pct, DEFAULT_PAYMENT_FEE_PCT)
    fee_fixed = _d(payment_fee_fixed, DEFAULT_PAYMENT_FEE_FIXED)
    refund_pct = _d(refund_rate_pct, DEFAULT_REFUND_RATE_PCT)
    return_pct = _d(return_cost_pct, DEFAULT_RETURN_COST_PCT)
    variable = (fee_pct + refund_pct + return_pct + _d(platform_fee_pct)) / 100
    margin = _d(target_margin_pct) / 100
    denom = Decimal("1") - variable - margin
    if denom <= 0:
        return None  # the target margin can't be reached at any price with these fees
    fixed = _d(product_cost) + _d(shipping_cost) + fee_fixed + _d(ad_cost_per_order) + _d(other_costs)
    return _money(fixed / denom)


def _quantile(sorted_vals: List[Decimal], q: float) -> Decimal:
    if len(sorted_vals) == 1:
        return sorted_vals[0]
    pos = (len(sorted_vals) - 1) * q
    lo = int(pos)
    hi = min(lo + 1, len(sorted_vals) - 1)
    return sorted_vals[lo] + (sorted_vals[hi] - sorted_vals[lo]) * Decimal(str(pos - lo))


def suggest_price_range(floor_price: Optional[float], competitor_prices: Optional[Iterable] = None) -> Dict:
    """A price RANGE, not a single number, and only ever from evidence.

    floor_price   the lowest price that still earns the target margin.
    competitor_prices  real listing prices we found (any currency-consistent list).

    With no competitor data the answer is just the floor and a note saying so:
    we do not invent a market price."""
    prices = sorted(_d(p) for p in (competitor_prices or []) if p is not None and _d(p) > 0)
    floor = _d(floor_price) if floor_price is not None else None
    out: Dict = {"floor": _money(floor) if floor is not None else None, "competitors_used": len(prices)}
    if not prices:
        out.update({"low": out["floor"], "high": None, "market": None,
                    "note": "No competitor prices yet. This is only the lowest price that meets your margin target.",
                    "confidence": "low"})
        return out
    stats = {
        "lowest": _money(prices[0]), "median": _money(Decimal(str(median(prices)))), "highest": _money(prices[-1]),
        "p25": _money(_quantile(prices, 0.25)), "p75": _money(_quantile(prices, 0.75)),
    }
    lo = _d(stats["p25"])
    hi = _d(stats["p75"])
    if floor is not None:
        lo = max(lo, floor)
        hi = max(hi, floor)
    out.update({"low": _money(lo), "high": _money(hi), "market": stats, "confidence": "high" if len(prices) >= 5 else ("medium" if len(prices) >= 3 else "low")})
    if floor is not None and floor > _d(stats["median"]):
        out["note"] = "Your margin target needs a price above the market median. Expect fewer sales, or look for a cheaper supplier."
    else:
        out["note"] = "Range runs from the lower to the upper quarter of real competitor prices, never below your margin floor."
    return out
