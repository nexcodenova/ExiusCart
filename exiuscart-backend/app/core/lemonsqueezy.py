"""
Lemon Squeezy payment gateway integration — billing for direct ExiusCart's
own Launch/Growth/Scale plans. TheDersi-sourced plans (thedersi_free_forever/
thedersi_lite, plus TheDersi Pro/Official which reuse the launch/scale
plan_types) are billed through TheDersi and never touch this module.
"""
import os
import hmac
import hashlib
import logging
import httpx
from typing import Optional

logger = logging.getLogger(__name__)

LEMONSQUEEZY_API_KEY = os.getenv("LEMONSQUEEZY_API_KEY", "")
LEMONSQUEEZY_STORE_ID = os.getenv("LEMONSQUEEZY_STORE_ID", "")
LEMONSQUEEZY_WEBHOOK_SECRET = os.getenv("LEMONSQUEEZY_WEBHOOK_SECRET", "")

LEMONSQUEEZY_API_BASE = "https://api.lemonsqueezy.com/v1"

# (plan_type, billing_type) -> Lemon Squeezy variant ID.
# plan_type is always one of ExiusCart's own three plan names — "launch",
# "growth", "scale" — never "starter"/"premium" (those names are retired
# everywhere in this codebase to avoid confusion between what the plan is
# called and what it's stored as). Any of these can be "" (not yet created
# in Lemon Squeezy's dashboard) — get_variant_id() returns "" and
# create_checkout() raises a clear "not configured" error rather than
# charging the wrong amount, so it's safe to leave unset as a placeholder
# until the real Lemon Squeezy products/variants exist.
VARIANT_MAP: dict = {
    ("launch", "monthly"): os.getenv("LEMONSQUEEZY_LAUNCH_MONTHLY_VARIANT_ID", ""),
    ("launch", "yearly"): os.getenv("LEMONSQUEEZY_LAUNCH_YEARLY_VARIANT_ID", ""),
    ("growth", "monthly"): os.getenv("LEMONSQUEEZY_GROWTH_MONTHLY_VARIANT_ID", ""),
    ("growth", "yearly"): os.getenv("LEMONSQUEEZY_GROWTH_YEARLY_VARIANT_ID", ""),
    ("scale", "monthly"): os.getenv("LEMONSQUEEZY_SCALE_MONTHLY_VARIANT_ID", ""),
    ("scale", "yearly"): os.getenv("LEMONSQUEEZY_SCALE_YEARLY_VARIANT_ID", ""),
    # $1-for-7-days trial variant (Growth/Scale's "Try for $1" CTA) — a
    # separate, lower-price Lemon Squeezy variant per plan that bills $1 for
    # the first cycle. Set up in Lemon Squeezy's dashboard as its own variant
    # with a one-time or first-cycle-discount price of $1; ExiusCart's own
    # Subscription state machine (not Lemon Squeezy) then tracks the 7-day
    # window and expects full price billing to take over after that. Launch
    # never uses this key — Launch has no $1 stage, only a free week then
    # full price.
    ("growth", "trial_dollar"): os.getenv("LEMONSQUEEZY_GROWTH_TRIAL_DOLLAR_VARIANT_ID", ""),
    ("scale", "trial_dollar"): os.getenv("LEMONSQUEEZY_SCALE_TRIAL_DOLLAR_VARIANT_ID", ""),
}

# Real trial structure, ExiusCart-side (not a Lemon Squeezy feature —
# enforced by our own Subscription state machine: see
# app/api/v1/endpoints/lemonsqueezy_webhook.py for how a checkout's payment
# starts the $1 stage, and app/core/subscription_lifecycle.py for how that
# stage ends and full billing begins). Cancel anytime and nothing further
# is ever charged.
#
# Launch: 7 days free, no card -> full price (no $1 stage at all).
TRIAL_FREE_DAYS = 7
# Growth / Scale: no free week — $1 for the first 7 days -> full price.
TRIAL_DOLLAR_DAYS = 7


def is_configured() -> bool:
    return bool(LEMONSQUEEZY_API_KEY and LEMONSQUEEZY_STORE_ID)


def get_variant_id(plan_type: str, billing_type: str) -> str:
    return VARIANT_MAP.get((plan_type, billing_type), "")


async def create_checkout(
    *,
    plan_type: str,
    billing_type: str,
    customer_email: str,
    customer_name: str,
    shop_id: Optional[int] = None,
    new_signup_business_name: Optional[str] = None,
    trial_dollar: bool = False,
) -> str:
    """
    Creates a Lemon Squeezy-hosted checkout session and returns the checkout URL.

    Two callers:
      - Existing shop upgrading (shop_id set) — webhook finds the subscription by shop_id.
      - Pre-signup checkout (shop_id=None, new_signup_business_name set) — no ExiusCart
        account exists yet; the webhook auto-creates User+Shop+Subscription from custom_data.

    `billing_type` is always the REAL future cadence ("monthly"/"yearly") —
    even when `trial_dollar` is set, since that's what the subscription
    bills at once the trial ends. `trial_dollar` only changes which Lemon
    Squeezy variant is used (a separate $1 variant, placeholder env var
    until the real one is created) and is passed through in custom_data so
    the webhook knows to apply the $1/7-day state instead of full billing.
    Launch never passes trial_dollar=True — it has no $1 stage.
    """
    if not is_configured():
        raise RuntimeError(
            "Lemon Squeezy is not configured. Set LEMONSQUEEZY_API_KEY and "
            "LEMONSQUEEZY_STORE_ID in the backend .env."
        )
    variant_id = get_variant_id(plan_type, "trial_dollar" if trial_dollar else billing_type)
    if not variant_id:
        raise RuntimeError(
            f"No Lemon Squeezy variant configured for {plan_type}/"
            f"{'trial_dollar' if trial_dollar else billing_type}. "
            "Create the product/variants in Lemon Squeezy and set the variant ID env var."
        )

    custom_data = {
        "plan_type": plan_type,
        "billing_type": billing_type,
        "trial_dollar": "true" if trial_dollar else "false",
    }
    if shop_id is not None:
        custom_data["shop_id"] = str(shop_id)
        redirect_url = "https://store.exiuscart.com/dashboard/billing?checkout=success"
    else:
        custom_data["new_signup"] = "true"
        custom_data["business_name"] = new_signup_business_name or ""
        redirect_url = "https://exiuscart.com/checkout?status=success"

    payload = {
        "data": {
            "type": "checkouts",
            "attributes": {
                "checkout_data": {
                    "email": customer_email,
                    "name": customer_name,
                    "custom": custom_data,
                },
                "product_options": {
                    "redirect_url": redirect_url,
                },
            },
            "relationships": {
                "store": {"data": {"type": "stores", "id": str(LEMONSQUEEZY_STORE_ID)}},
                "variant": {"data": {"type": "variants", "id": str(variant_id)}},
            },
        }
    }

    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(
            f"{LEMONSQUEEZY_API_BASE}/checkouts",
            json=payload,
            headers={
                "Authorization": f"Bearer {LEMONSQUEEZY_API_KEY}",
                "Content-Type": "application/vnd.api+json",
                "Accept": "application/vnd.api+json",
            },
        )
    data = r.json()
    if r.status_code >= 300:
        logger.error(f"[LemonSqueezy] checkout creation failed: {data}")
        raise RuntimeError("Failed to create checkout session with Lemon Squeezy.")

    return data["data"]["attributes"]["url"]


async def update_subscription_variant(
    lemon_squeezy_subscription_id: str, new_variant_id: str, *, invoice_immediately: bool = True
) -> None:
    """
    Switches an existing Lemon Squeezy subscription onto a different variant
    — this is how the $1-to-full-price trial is actually enforced on Lemon
    Squeezy's side, since Lemon Squeezy itself has no concept of a staged
    trial: it only knows "this subscription bills variant X on its normal
    interval." Ending the $1 stage means changing which variant it's on.
    `invoice_immediately=True` charges the new variant's price right away
    rather than waiting for the next renewal date — used here because our
    stage boundary (day 7) is ExiusCart's own trial clock, not Lemon
    Squeezy's renewal date, so waiting for the next renewal would apply the
    new price on the wrong day.

    Called by app/core/subscription_lifecycle.py when the $1 stage's end
    date passes — never called directly from a webhook handler.
    """
    if not is_configured():
        raise RuntimeError("Lemon Squeezy is not configured.")

    payload = {
        "data": {
            "type": "subscriptions",
            "id": str(lemon_squeezy_subscription_id),
            "attributes": {
                "variant_id": int(new_variant_id),
                "invoice_immediately": invoice_immediately,
            },
        }
    }

    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.patch(
            f"{LEMONSQUEEZY_API_BASE}/subscriptions/{lemon_squeezy_subscription_id}",
            json=payload,
            headers={
                "Authorization": f"Bearer {LEMONSQUEEZY_API_KEY}",
                "Content-Type": "application/vnd.api+json",
                "Accept": "application/vnd.api+json",
            },
        )
    if r.status_code >= 300:
        logger.error(f"[LemonSqueezy] failed to move subscription {lemon_squeezy_subscription_id} to variant {new_variant_id}: {r.json()}")
        raise RuntimeError(f"Lemon Squeezy rejected the subscription update for {lemon_squeezy_subscription_id}.")


async def get_customer_portal_url(lemon_squeezy_subscription_id: str) -> str:
    """
    Fetches the signed, self-service Customer Portal URL for a subscription —
    lets the seller cancel, pause, or update their payment method directly on
    Lemon Squeezy's hosted page. Valid for 24 hours per Lemon Squeezy's docs,
    so this must be fetched fresh each time, never cached/stored.
    """
    if not is_configured():
        raise RuntimeError("Lemon Squeezy is not configured.")

    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(
            f"{LEMONSQUEEZY_API_BASE}/subscriptions/{lemon_squeezy_subscription_id}",
            headers={
                "Authorization": f"Bearer {LEMONSQUEEZY_API_KEY}",
                "Accept": "application/vnd.api+json",
            },
        )
    data = r.json()
    if r.status_code >= 300:
        logger.error(f"[LemonSqueezy] fetching subscription {lemon_squeezy_subscription_id} failed: {data}")
        raise RuntimeError("Could not reach Lemon Squeezy to open the billing portal.")

    url = data.get("data", {}).get("attributes", {}).get("urls", {}).get("customer_portal")
    if not url:
        raise RuntimeError("Lemon Squeezy did not return a billing portal URL for this subscription.")
    return url


def verify_webhook_signature(raw_body: bytes, x_signature: str) -> bool:
    """Verify the X-Signature header Lemon Squeezy sends on every webhook."""
    if not LEMONSQUEEZY_WEBHOOK_SECRET:
        logger.warning("[LemonSqueezy] LEMONSQUEEZY_WEBHOOK_SECRET not set — rejecting webhook.")
        return False
    if not x_signature:
        return False
    expected = hmac.new(
        LEMONSQUEEZY_WEBHOOK_SECRET.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, x_signature)
