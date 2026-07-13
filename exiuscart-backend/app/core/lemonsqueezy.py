"""
Lemon Squeezy payment gateway integration — billing for direct ExiusCart
Starter/Premium plans. TheDersi-sourced plans (thedersi_basic/thedersi_pro) are
billed through TheDersi and never touch this module.
"""
import os
import hmac
import hashlib
import logging
import httpx

logger = logging.getLogger(__name__)

LEMONSQUEEZY_API_KEY = os.getenv("LEMONSQUEEZY_API_KEY", "")
LEMONSQUEEZY_STORE_ID = os.getenv("LEMONSQUEEZY_STORE_ID", "")
LEMONSQUEEZY_WEBHOOK_SECRET = os.getenv("LEMONSQUEEZY_WEBHOOK_SECRET", "")

LEMONSQUEEZY_API_BASE = "https://api.lemonsqueezy.com/v1"

# (plan_type, billing_type) -> Lemon Squeezy variant ID
VARIANT_MAP: dict = {
    ("starter", "monthly"): os.getenv("LEMONSQUEEZY_STARTER_MONTHLY_VARIANT_ID", ""),
    ("starter", "yearly"): os.getenv("LEMONSQUEEZY_STARTER_YEARLY_VARIANT_ID", ""),
    ("premium", "monthly"): os.getenv("LEMONSQUEEZY_PREMIUM_MONTHLY_VARIANT_ID", ""),
    ("premium", "yearly"): os.getenv("LEMONSQUEEZY_PREMIUM_YEARLY_VARIANT_ID", ""),
}


def is_configured() -> bool:
    return bool(LEMONSQUEEZY_API_KEY and LEMONSQUEEZY_STORE_ID)


def get_variant_id(plan_type: str, billing_type: str) -> str:
    return VARIANT_MAP.get((plan_type, billing_type), "")


async def create_checkout(
    *,
    shop_id: int,
    plan_type: str,
    billing_type: str,
    customer_email: str,
    customer_name: str,
) -> str:
    """
    Creates a Lemon Squeezy-hosted checkout session and returns the checkout URL.
    shop_id/plan_type/billing_type are embedded as custom_data so the webhook
    handler can identify which ExiusCart subscription this payment is for.
    """
    if not is_configured():
        raise RuntimeError(
            "Lemon Squeezy is not configured. Set LEMONSQUEEZY_API_KEY and "
            "LEMONSQUEEZY_STORE_ID in the backend .env."
        )
    variant_id = get_variant_id(plan_type, billing_type)
    if not variant_id:
        raise RuntimeError(
            f"No Lemon Squeezy variant configured for {plan_type}/{billing_type}. "
            "Create the product/variants in Lemon Squeezy and set the variant ID env var."
        )

    payload = {
        "data": {
            "type": "checkouts",
            "attributes": {
                "checkout_data": {
                    "email": customer_email,
                    "name": customer_name,
                    "custom": {
                        "shop_id": str(shop_id),
                        "plan_type": plan_type,
                        "billing_type": billing_type,
                    },
                },
                "product_options": {
                    "redirect_url": "https://store.exiuscart.com/dashboard/billing?checkout=success",
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
