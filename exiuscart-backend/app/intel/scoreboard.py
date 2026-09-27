"""The founder's scoreboard: are Prodora and ExiusCart actually working?

Each metric has a target you wrote down. Whatever data can say it, the system counts by itself from real records;
what no system holds (interviews, case studies, features built without validation) is a number a person keeps by hand.
Nothing here is estimated or made up: a number is either counted from the database or typed in by you.

  Metric                              Target          Where the number comes from
  Paying merchants                    5               active paid subscriptions (real shops, amount above zero)
  Monthly recurring revenue           $500 to $1,000  the same MRR the revenue report uses (yearly plans divided by 12)
  Completed launches                  10              products launched with Launch with ExiusCart (Price Coach or Prodora AI)
  Successful product tests            10+             launched products that then made at least one real paid sale
  Customer interviews                 20              kept by hand
  Case studies                        3               kept by hand
  Repeat customers                    Increasing      merchants who paid more than once, against a month ago
  Features customers actually use     Measured        how many shops used each feature in the last 30 days
  Major features built unvalidated    0               kept by hand
"""
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.coach import CoachItem
from app.models.dropship import DropshipOrder
from app.models.intel import PlatformEvent, ScoreboardEntry
from app.models.product import Product
from app.models.shop import Shop
from app.models.shop_staff import ShopStaff
from app.models.subscription import Subscription
from app.models.subscription_payment import SubscriptionPayment

MANUAL_KEYS = ("interviews", "case_studies", "unvalidated_features")
FEATURE_WINDOW_DAYS = 30


def _aware(d: datetime) -> datetime:
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def _real_shops():
    from app.api.v1.endpoints.admin import SYSTEM_SHOP_SLUGS
    return Shop.slug.notin_(SYSTEM_SHOP_SLUGS)


def paying_and_mrr(db: Session) -> Dict[str, float]:
    """Active subscriptions of real shops that actually charge money, and their monthly-equivalent revenue in USD."""
    from app.api.v1.endpoints.admin import _to_usd
    rows = (db.query(Subscription.shop_id, Subscription.billing_type, Subscription.currency, Subscription.amount_paid)
            .join(Shop, Subscription.shop_id == Shop.id).filter(_real_shops(), Subscription.status == "active").all())
    shops, mrr = set(), 0.0
    for shop_id, billing, currency, amount in rows:
        usd = _to_usd(amount, currency)
        if usd <= 0:
            continue                                  # a free or partner plan is not a paying merchant
        shops.add(shop_id)
        mrr += usd / 12 if billing == "yearly" else usd
    return {"paying": len(shops), "mrr": round(mrr, 2)}


def launches(db: Session) -> Dict[str, int]:
    total = db.query(func.count(CoachItem.id)).filter(CoachItem.status == "launched").scalar() or 0
    shops = db.query(func.count(func.distinct(CoachItem.shop_id))).filter(CoachItem.status == "launched").scalar() or 0
    sold = (db.query(func.count(CoachItem.id)).join(Product, Product.id == CoachItem.product_id)
            .filter(CoachItem.status == "launched", Product.shop_id == CoachItem.shop_id, Product.units_sold >= 1).scalar() or 0)
    return {"launches": total, "shops": shops, "tests_passed": sold}


def repeat_merchants(db: Session, now: datetime) -> Dict[str, int]:
    """Merchants who have paid more than once: now, and as of 30 days ago, so the direction is visible."""
    def count(before: Optional[datetime]) -> int:
        q = (db.query(SubscriptionPayment.shop_id, func.count(SubscriptionPayment.id))
             .join(Shop, SubscriptionPayment.shop_id == Shop.id).filter(_real_shops(), SubscriptionPayment.amount > 0, SubscriptionPayment.refunded_at.is_(None)))
        if before is not None:
            q = q.filter(SubscriptionPayment.created_at < before)
        return sum(1 for _, n in q.group_by(SubscriptionPayment.shop_id).all() if n >= 2)
    return {"now": count(None), "month_ago": count(now - timedelta(days=30))}


def feature_usage(db: Session, now: datetime) -> List[dict]:
    """For each feature, how many different shops used it in the last 30 days (and how many times)."""
    since = now - timedelta(days=FEATURE_WINDOW_DAYS)

    def events(event_type: str, who) -> tuple:
        q = db.query(func.count(PlatformEvent.id), func.count(func.distinct(who))).filter(PlatformEvent.event_type == event_type, PlatformEvent.created_at >= since)
        uses, distinct = q.one()
        return int(distinct or 0), int(uses or 0)

    feats = [
        ("Price Coach checks", *events("coach_check", PlatformEvent.shop_id)),
        ("Launch with ExiusCart (Price Coach)", *events("coach_launch", PlatformEvent.shop_id)),
        ("Prodora AI searches", *events("prodora_ai_search", PlatformEvent.user_id)),
        ("Launch with ExiusCart (Prodora AI)", *events("prodora_ai_launch", PlatformEvent.shop_id)),
        ("Prodora product imports", *events("prodora_product_imported", PlatformEvent.shop_id)),
    ]
    d_uses, d_shops = db.query(func.count(DropshipOrder.id), func.count(func.distinct(DropshipOrder.shop_id))).filter(DropshipOrder.created_at >= since).one()
    feats.append(("Orders sent to a supplier", int(d_shops or 0), int(d_uses or 0)))
    s_uses, s_shops = db.query(func.count(ShopStaff.id), func.count(func.distinct(ShopStaff.shop_id))).filter(ShopStaff.invited_at >= since).one()
    feats.append(("Team members invited", int(s_shops or 0), int(s_uses or 0)))
    out = [{"feature": name, "shops": shops, "uses": uses} for name, shops, uses in feats]
    return sorted(out, key=lambda f: (f["shops"], f["uses"]), reverse=True)


def manual_entries(db: Session) -> Dict[str, dict]:
    rows = {r.key: r for r in db.query(ScoreboardEntry).all()}
    return {k: {"value": rows[k].value if k in rows else 0, "note": rows[k].note if k in rows else None,
                "updated_at": rows[k].updated_at.isoformat() if k in rows and rows[k].updated_at else None} for k in MANUAL_KEYS}


def _state(value: float, target: float, zero_is_target: bool = False) -> str:
    if zero_is_target:
        return "on_target" if value == 0 else "off_target"
    if value >= target:
        return "reached"
    return "started" if value > 0 else "not_started"


def compute(db: Session, now: Optional[datetime] = None) -> dict:
    now = now or datetime.now(timezone.utc)
    pm, la, rp, man = paying_and_mrr(db), launches(db), repeat_merchants(db, now), manual_entries(db)
    feats = feature_usage(db, now)

    def row(key: str, label: str, value: float, target: float, unit: str, auto: bool, detail: str, **extra) -> dict:
        r = {"key": key, "label": label, "value": value, "target": target, "unit": unit, "auto": auto, "detail": detail,
             "state": _state(value, target), "progress": None if not target else round(min(1.0, value / target), 3)}
        r.update(extra)
        return r

    metrics = [
        row("paying_merchants", "Paying merchants", pm["paying"], 5, "merchants", True, "Active paid subscriptions on real shops."),
        row("mrr", "Monthly recurring revenue", pm["mrr"], 500, "USD", True, "Yearly plans counted as a twelfth. Target: first $500 to $1,000.", stretch=1000),
        row("launches", "Completed launches", la["launches"], 10, "launches", True, f"From {la['shops']} shop{'s' if la['shops'] != 1 else ''}, through Launch with ExiusCart."),
        row("tests", "Successful product tests", la["tests_passed"], 10, "products", True, "Launched products that made at least one real paid sale. Target: 10 or more."),
        row("interviews", "Customer interviews", man["interviews"]["value"], 20, "interviews", False, man["interviews"]["note"] or "Kept by hand."),
        row("case_studies", "Case studies", man["case_studies"]["value"], 3, "case studies", False, man["case_studies"]["note"] or "Kept by hand."),
        {"key": "repeat", "label": "Repeat customers", "value": rp["now"], "target": None, "unit": "merchants", "auto": True,
         "detail": f"Merchants who paid more than once. A month ago: {rp['month_ago']}.", "state": "rising" if rp["now"] > rp["month_ago"] else ("flat" if rp["now"] == rp["month_ago"] else "falling"),
         "progress": None, "previous": rp["month_ago"]},
        {"key": "features_used", "label": "Features customers actually use", "value": sum(1 for f in feats if f["shops"] > 0), "target": None, "unit": "features in use",
         "auto": True, "detail": f"Features that at least one shop used in the last {FEATURE_WINDOW_DAYS} days. The list is below.", "state": "measured", "progress": None},
        {"key": "unvalidated", "label": "Major features built without validation", "value": man["unvalidated_features"]["value"], "target": 0, "unit": "features", "auto": False,
         "detail": man["unvalidated_features"]["note"] or "Kept by hand. The target is zero.", "state": _state(man["unvalidated_features"]["value"], 0, True), "progress": None},
    ]
    return {"generated_at": now.isoformat(), "metrics": metrics, "features": feats, "feature_window_days": FEATURE_WINDOW_DAYS,
            "reached": sum(1 for m in metrics if m["state"] in ("reached", "on_target"))}
