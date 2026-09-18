"""
Shared TheDersi integration helpers — used by partner.py and channels.py.
"""
import os
import hmac
import hashlib
import json
import logging
import httpx

logger = logging.getLogger(__name__)

THEDERSI_KEY           = os.getenv("THEDERSI_PARTNER_KEY", "")       # we send this TO TheDersi
THEDERSI_INBOUND_KEY   = os.getenv("THEDERSI_INBOUND_KEY", "")       # TheDersi sends this TO us (they call it their partner key for ExiusCart)
THEDERSI_HMAC_SECRET   = os.getenv("THEDERSI_HMAC_SECRET", "")       # TheDersi signs their webhooks with this → we verify incoming
THEDERSI_OUTGOING_SECRET = os.getenv("THEDERSI_OUTGOING_SECRET", "") # we sign our outgoing notifications → TheDersi verifies
THEDERSI_WEBHOOK_URL = os.getenv(
    "THEDERSI_WEBHOOK_URL",
    "https://thedersi.lk/api/exiuscart/webhook",
)
THEDERSI_ORDER_STATUS_URL = os.getenv(
    "THEDERSI_ORDER_STATUS_URL",
    "https://thedersi.lk/api/v1/exiuscart/order-status",
)

# Tier names TheDersi sends (their own names, never touched — a separate
# system from ExiusCart's own plans) → ExiusCart plan_type. Accepts both new
# names and old names (backward compat).
#
# 2026-09-17 restructure: TheDersi's 4 tiers now map to real, named
# ExiusCart plan_types instead of generic thedersi_basic/thedersi_pro:
#   Free Forever → thedersi_free_forever (own plan_type, was thedersi_basic)
#   Lite (renamed from "Growth")  → thedersi_lite (own plan_type — same
#     limits as Free Forever except unlimited orders; deliberately NOT
#     "launch", so a Lite seller is never confused with a real direct
#     ExiusCart Launch customer anywhere in reporting/admin)
#   Pro → "launch" (shares the real Launch plan_type/feature set), with
#     Pro-specific restrictions (no Prodora, limited to 2 sales channels)
#     layered on top via is_thedersi_pro_shop() below rather than a
#     dedicated plan_type — see that function for why this is derivable
#     without a new DB column.
#   Official (their own internal @thedersi.lk staff) → "scale". This tier
#     name is new and no such account exists yet — an @thedersi.lk email
#     already gets bumped to Scale automatically elsewhere (see
#     "domain_thedersi" in auth.py/partner.py), so this mapping mostly
#     matters if that email check is ever bypassed or a non-@thedersi.lk
#     account is ever tagged "official" by mistake — Scale is still the
#     correct, safe outcome either way.
# "growth"/"premium"/"starter"/"standard" are legacy wire values for what's
# now "lite" — kept mapped to thedersi_lite so an in-flight seller synced on
# an old value doesn't break.
THEDERSI_TIER_MAP: dict = {
    "free_forever": {"plan_type": "thedersi_free_forever"},
    "free":         {"plan_type": "thedersi_free_forever"},
    "official":     {"plan_type": "scale"},
    "lite":         {"plan_type": "thedersi_lite"},
    "growth":       {"plan_type": "thedersi_lite"},  # old wire value for the same tier
    "premium":      {"plan_type": "thedersi_lite"},  # legacy wire value, same tier
    "starter":      {"plan_type": "thedersi_lite"},  # legacy wire value, same tier
    "pro":          {"plan_type": "launch"},
    "standard":     {"plan_type": "thedersi_lite"},  # legacy wire value, same tier
}

def is_thedersi_shop(shop_id: int, db) -> bool:
    """True if this shop has an active TheDersi channel connection.

    This is the reliable way to detect a TheDersi-provisioned seller —
    plan_type alone is NOT enough for the Pro tier, which shares plan_type
    "launch" with real direct ExiusCart customers (see THEDERSI_TIER_MAP
    above and is_thedersi_pro_shop below).
    """
    from app.models.channel import ChannelConnection
    return db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.channel_type == "thedersi",
        ChannelConnection.is_active == True,
    ).first() is not None


def is_thedersi_pro_shop(shop_id: int, db) -> bool:
    """True if this is a TheDersi seller specifically on their Pro tier.

    Pro shares plan_type="launch" with real direct ExiusCart Launch
    customers (by design — Pro gets Launch's feature set) rather than
    getting its own plan_type, so plan_type alone can't tell them apart.
    Free Forever and Lite both get their own distinct plan_types
    (thedersi_free_forever, thedersi_lite), so "a TheDersi shop whose
    current subscription is plan_type=launch" can only mean Pro — no extra
    DB column needed to track this.
    """
    from app.models.subscription import Subscription
    if not is_thedersi_shop(shop_id, db):
        return False
    sub = db.query(Subscription).filter(
        Subscription.shop_id == shop_id
    ).order_by(Subscription.id.desc()).first()
    return bool(sub and sub.plan_type == "launch")


def is_thedersi_official_shop(shop_id: int, db) -> bool:
    """True for TheDersi's own internal @thedersi.lk staff accounts.

    Official shares plan_type="scale" with real direct ExiusCart Scale
    customers — same reasoning as is_thedersi_pro_shop above.
    """
    from app.models.subscription import Subscription
    if not is_thedersi_shop(shop_id, db):
        return False
    sub = db.query(Subscription).filter(
        Subscription.shop_id == shop_id
    ).order_by(Subscription.id.desc()).first()
    return bool(sub and sub.plan_type == "scale")


def is_thedersi_daraz_eligible_shop(shop_id: int, db) -> bool:
    """True for a TheDersi shop allowed to connect Daraz — Lite and Pro
    (Free Forever is TheDersi-only, no Daraz). Lite has its own distinct
    plan_type (thedersi_lite, never shared with anything else) so it needs
    no is_thedersi_shop() check; Pro shares "launch" and needs
    is_thedersi_pro_shop() to tell it apart from a real Launch customer.
    Official is exempt from this check entirely (see
    is_thedersi_restricted_shop) since it already gets every channel.
    """
    from app.models.subscription import Subscription
    sub = db.query(Subscription).filter(
        Subscription.shop_id == shop_id
    ).order_by(Subscription.id.desc()).first()
    if sub and sub.plan_type == "thedersi_lite":
        return True
    return is_thedersi_pro_shop(shop_id, db)


def is_thedersi_free_forever_shop(shop_id: int, db) -> bool:
    """True only for TheDersi's Free Forever tier specifically — used for
    the small number of things (Ad research, Customer Segments, Marketing
    hub/Campaigns) that Free Forever alone doesn't get, while Lite/Pro/
    Official all do. Free Forever has its own distinct plan_type
    (thedersi_free_forever, never shared with a real direct plan), so this
    needs no is_thedersi_shop() check first — the plan_type string alone is
    unambiguous, same shape as is_thedersi_daraz_eligible_shop's
    thedersi_lite check."""
    from app.models.subscription import Subscription
    sub = db.query(Subscription).filter(
        Subscription.shop_id == shop_id
    ).order_by(Subscription.id.desc()).first()
    return bool(sub and sub.plan_type == "thedersi_free_forever")


def is_thedersi_restricted_shop(shop_id: int, db) -> bool:
    """True for a TheDersi shop that should have TheDersi's usual
    restrictions applied (no Prodora, no dropshipping suppliers, no digital
    product delivery, channels limited to TheDersi+Daraz, etc.) — every
    TheDersi tier EXCEPT Official, which gets full, unrestricted Scale
    access with no TheDersi-specific carve-outs at all. Use this instead of
    is_thedersi_shop() for any blanket "TheDersi shops can't do X" check.
    """
    return is_thedersi_shop(shop_id, db) and not is_thedersi_official_shop(shop_id, db)


# Monthly order limits per plan (None = unlimited)
# Counts channel/online orders only — POS is always unlimited regardless of plan
MONTHLY_ORDER_LIMITS: dict = {
    "free_trial":            50,
    "thedersi_free_forever": 25,
    "thedersi_lite":         100,
    "launch":                1000,
    "growth":                5000,
    "scale":                 None,  # unlimited
}

TOTAL_ORDER_LIMITS = MONTHLY_ORDER_LIMITS


def _hmac_signature(body: str) -> str:
    """HMAC-SHA256 signature for outgoing notifications to TheDersi (they verify with EXIUSCART_WEBHOOK_SECRET)."""
    secret = THEDERSI_OUTGOING_SECRET or THEDERSI_HMAC_SECRET  # fallback for old single-secret setups
    if not secret:
        return ""
    return "sha256=" + hmac.new(
        secret.encode("utf-8"),
        body.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def verify_thedersi_signature(body: bytes, x_signature: str) -> bool:
    """
    Verify the X-Signature header on incoming webhooks from TheDersi.
    - If THEDERSI_HMAC_SECRET is not configured → always allow (URL secret is enough).
    - If X-Signature header is absent → always allow (TheDersi does not sign inbound webhooks).
    - If X-Signature is present → verify it; reject on mismatch.
    """
    if not THEDERSI_HMAC_SECRET:
        return True  # no secret configured — URL-based webhook_secret is sufficient
    if not x_signature:
        return True  # TheDersi doesn't sign inbound webhooks; URL secret is sufficient
    if not x_signature.startswith("sha256="):
        return False
    expected = "sha256=" + hmac.new(
        THEDERSI_HMAC_SECRET.encode("utf-8"),
        body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, x_signature)


def notify_thedersi(seller_id: str, plan: str, event: str = "plan_update") -> None:
    """
    Call TheDersi's webhook to notify them of a plan or limit event.
    Payload is HMAC-signed with X-Signature header so TheDersi can verify authenticity.
    Fire-and-forget — errors are logged but never raised.
    """
    if not THEDERSI_WEBHOOK_URL or not seller_id:
        return

    payload = {
        "seller_id": seller_id,
        "plan": plan,
        "source": "thedersi",
        "event": event,
    }
    body = json.dumps(payload, separators=(",", ":"))
    sig  = _hmac_signature(body)

    headers = {
        "Content-Type": "application/json",
        "X-Partner-Key": THEDERSI_KEY,
    }
    if sig:
        headers["X-Signature"] = sig

    try:
        with httpx.Client(timeout=5) as client:
            r = client.post(THEDERSI_WEBHOOK_URL, content=body, headers=headers)
            logger.info(f"[TheDersi webhook] {event} seller={seller_id} → {r.status_code}")
    except Exception as exc:
        logger.warning(f"[TheDersi webhook] failed seller={seller_id}: {exc}")


def notify_thedersi_receipt_uploaded(channel_order_id: str, receipt_url: str) -> None:
    """POST receipt_uploaded to TheDersi when a seller uploads a bank-transfer
    payment receipt from their ExiusCart dashboard, so it shows in TheDersi's
    own admin order view too. Per TheDersi's spec this only matters for
    bank-transfer orders — they ignore it for COD/PayHere on their end, and
    re-sending just overwrites the URL (idempotent), so this is safe to call
    unconditionally. Fire-and-forget — errors are logged but never raised."""
    if not THEDERSI_WEBHOOK_URL or not channel_order_id:
        return

    payload = {
        "event": "receipt_uploaded",
        "channel_order_id": channel_order_id,
        "receipt_url": receipt_url,
    }
    body = json.dumps(payload, separators=(",", ":"))
    sig = _hmac_signature(body)
    headers = {"Content-Type": "application/json", "X-Partner-Key": THEDERSI_KEY}
    if sig:
        headers["X-Signature"] = sig

    try:
        with httpx.Client(timeout=8) as client:
            r = client.post(THEDERSI_WEBHOOK_URL, content=body, headers=headers)
            logger.info(f"[TheDersi webhook] receipt_uploaded order={channel_order_id} → {r.status_code}")
    except Exception as exc:
        logger.warning(f"[TheDersi webhook] receipt_uploaded failed order={channel_order_id}: {exc}")


def notify_thedersi_profile_updated(
    thedersi_seller_id: str,
    logo_url: str | None,
    banner_url: str | None,
    about_text: str | None = None,
    social_instagram: str | None = None,
    social_tiktok: str | None = None,
    social_facebook: str | None = None,
    brand_color: str | None = None,
) -> None:
    """POST profile_updated event to TheDersi when seller changes profile fields. Fire-and-forget."""
    if not THEDERSI_WEBHOOK_URL or not thedersi_seller_id:
        return

    payload: dict = {
        "event": "profile_updated",
        "thedersi_seller_id": thedersi_seller_id,
    }
    if logo_url:
        payload["logo_url"] = logo_url
    if banner_url:
        payload["banner_url"] = banner_url
    if about_text:
        payload["about_text"] = about_text
    if social_instagram:
        payload["social_instagram"] = social_instagram
    if social_tiktok:
        payload["social_tiktok"] = social_tiktok
    if social_facebook:
        payload["social_facebook"] = social_facebook
    if brand_color:
        payload["brand_color"] = brand_color

    body = json.dumps(payload, separators=(",", ":"))
    sig = _hmac_signature(body)
    headers = {"Content-Type": "application/json", "X-Partner-Key": THEDERSI_KEY}
    if sig:
        headers["X-Signature"] = sig

    try:
        with httpx.Client(timeout=5) as client:
            r = client.post(THEDERSI_WEBHOOK_URL, content=body, headers=headers)
            logger.info(f"[TheDersi webhook] profile_updated seller={thedersi_seller_id} → {r.status_code}")
    except Exception as exc:
        logger.warning(f"[TheDersi webhook] profile_updated failed seller={thedersi_seller_id}: {exc}")


def notify_thedersi_order_status(
    channel_order_id: str,
    status: str,
    tracking_number: str | None = None,
    tracking_courier: str | None = None,
    delivery_cost: float | None = None,
    thedersi_seller_id: str | None = None,
) -> None:
    """POST order status update to TheDersi when a seller updates their order.
    delivery_cost/thedersi_seller_id are TheDersi's own payout-reimbursement
    fields (2026-08-26 spec) — the seller's real courier expense, capped-
    reimbursed against what the customer paid for delivery. Fire-and-forget."""
    if not channel_order_id:
        return

    payload: dict = {"channel_order_id": channel_order_id, "status": status}
    if tracking_number:
        payload["tracking_number"] = tracking_number
    if tracking_courier:
        payload["tracking_courier"] = tracking_courier
    if delivery_cost is not None:
        payload["delivery_cost"] = delivery_cost
    if thedersi_seller_id:
        payload["thedersi_seller_id"] = thedersi_seller_id

    body = json.dumps(payload, separators=(",", ":"))

    headers: dict = {"Content-Type": "application/json", "X-Partner-Key": THEDERSI_KEY}
    if THEDERSI_HMAC_SECRET:
        sig = "sha256=" + hmac.new(
            THEDERSI_HMAC_SECRET.encode("utf-8"),
            body.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        headers["X-Signature"] = sig

    try:
        with httpx.Client(timeout=8) as client:
            r = client.post(THEDERSI_ORDER_STATUS_URL, content=body, headers=headers)
            print(f"[TheDersi order-status] {channel_order_id} → {status} | HTTP {r.status_code} | {r.text[:200]}", flush=True)
            logger.info(f"[TheDersi order-status] {channel_order_id} → {status} | HTTP {r.status_code}")
    except Exception as exc:
        print(f"[TheDersi order-status] FAILED {channel_order_id}: {exc}", flush=True)
        logger.warning(f"[TheDersi order-status] failed {channel_order_id}: {exc}")
