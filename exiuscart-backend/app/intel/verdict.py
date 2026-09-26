"""Step 5: turn evidence into a decision a seller can act on: TEST, WATCH or AVOID.

Plain, readable rules, no black box, so every verdict can list its own reasons:

  AVOID  the product loses money before any advertising, or the margin is thin
         (under MIN_MARGIN_PCT of the price) even at the market price.
  WATCH  promising but not proven: no market evidence yet, a margin below the
         seller's target, advertising would need an unrealistic return, or the
         supplier's shipping cost is not known.
  TEST   the margin meets the target AND there is real competitor evidence
         (at least MIN_COMPETITORS same-product listings) AND ads are plausible.

TEST needs evidence on purpose: without competitor prices the best possible
answer is WATCH. A verdict is never stronger than the evidence behind it.

Demand, ad potential and content potential are NOT measured in this version and
are reported as such rather than guessed.
"""
from typing import List, Optional

MIN_MARGIN_PCT = 15.0        # below this margin before ads, the product is not worth the risk
MIN_COMPETITORS = 3          # same-product listings needed before TEST
MAX_TESTABLE_ROAS = 5.0      # if break-even ROAS is higher than this, paid ads are unrealistic
MANY_COMPETITORS = 25        # a crowded market is a concern, not a rule

NOT_MEASURED = [
    {"key": "demand", "label": "Demand", "why": "Needs a trend data source, not connected yet"},
    {"key": "ad_potential", "label": "Ad potential", "why": "Needs ad-library data, not connected yet"},
    {"key": "content_potential", "label": "Content potential", "why": "Not measured in this version"},
]

_RANK = {"low": 0, "medium": 1, "high": 2}


def _worst(*levels: str) -> str:
    return min(levels, key=lambda l: _RANK.get(l, 0))


def decide(*, economics: dict, price_range: dict, competitor_count: int, target_margin_pct: float,
           sources_ok: int, method: str, shipping_known: bool = True) -> dict:
    reasons_for: List[str] = []
    concerns: List[str] = []
    verdict = "TEST"
    margin = economics["margin_before_ads_pct"]
    roas = economics["break_even_roas"]

    if not economics["profitable_before_ads"]:
        verdict = "AVOID"
        concerns.append("It loses money on every sale before any advertising, at the price we checked.")
    elif margin < MIN_MARGIN_PCT:
        verdict = "AVOID"
        concerns.append(f"The margin before ads is only {margin:.1f}%, below the {MIN_MARGIN_PCT:.0f}% minimum. One refund or a small price cut wipes it out.")
    elif margin < target_margin_pct:
        verdict = "WATCH"
        concerns.append(f"The margin before ads is {margin:.1f}%, under your {target_margin_pct:.0f}% target.")
    else:
        reasons_for.append(f"The margin before ads is {margin:.1f}%, above your {target_margin_pct:.0f}% target.")

    if roas is not None:
        if roas > MAX_TESTABLE_ROAS and verdict == "TEST":
            verdict = "WATCH"
            concerns.append(f"Ads would have to return {roas:.1f}x their cost just to break even. That is hard to reach.")
        elif roas <= MAX_TESTABLE_ROAS and economics["profitable_before_ads"]:
            reasons_for.append(f"Break-even return on ad spend is {roas:.1f}x, a realistic target for a test.")

    if competitor_count == 0:
        if verdict == "TEST":
            verdict = "WATCH"
        concerns.append("No same-product competitor prices were found, so the market price is unproven.")
    elif competitor_count < MIN_COMPETITORS:
        if verdict == "TEST":
            verdict = "WATCH"
        concerns.append(f"Only {competitor_count} competing listing{'s' if competitor_count != 1 else ''} found. Not enough to trust the market price yet.")
    else:
        reasons_for.append(f"{competitor_count} same-product listings found, enough to see the market price.")
        if competitor_count >= MANY_COMPETITORS:
            concerns.append(f"{competitor_count} sellers already list it. A crowded market means you need a clear angle to stand out.")

    note = price_range.get("note")
    if competitor_count and note and "above the market median" in note:
        concerns.append("The price needed for your margin is above the market median, so expect fewer sales or look for a cheaper supplier.")
        if verdict == "TEST":
            verdict = "WATCH"

    if not shipping_known:
        # Without the supplier's shipping the profit is overstated, so a TEST verdict
        # would be built on a number we know is too good.
        if verdict == "TEST":
            verdict = "WATCH"
        concerns.append("Supplier shipping is not known yet, so the profit shown may be too high.")

    evidence = "low" if competitor_count == 0 else ("medium" if competitor_count < MIN_COMPETITORS + 2 else "high")
    if method == "keyword":                       # crude matching: never claim high confidence
        evidence = _worst(evidence, "medium")
    if sources_ok == 0:
        evidence = "low"
    confidence = _worst(economics["confidence"], evidence)
    if not shipping_known:
        confidence = _worst(confidence, "medium")

    headline = {
        "TEST": "Worth testing",
        "WATCH": "Promising, not proven",
        "AVOID": "Not worth testing at this cost",
    }[verdict]
    return {"verdict": verdict, "headline": headline, "reasons_for": reasons_for, "concerns": concerns,
            "confidence": confidence, "not_measured": NOT_MEASURED}
