"""
Shared channel-slot rules for direct (non-TheDersi) ExiusCart plans.

Every channel type used to gate itself independently (eBay/Daraz hard-required
Growth+/a TheDersi-Pro-or-better carve-out, everything else just counted
toward a flat per-plan total) — this module is the single place all of that
now lives, so eBay, Etsy, Daraz, Noon, TikTok, Whop, Gumroad, BigCommerce,
WooCommerce, Shopify and Custom Website all draw from the same pool of
channel slots instead of eBay/Daraz being a special case.

Categories (a channel's "kind"):
  store        — shopify, woocommerce, bigcommerce, custom (a seller's own storefront)
  marketplace  — thedersi, ebay, etsy, daraz, noon, tiktok
  digital      — whop, gumroad

Slot rules:
  free_trial — 1 channel total, no category rule (only 1 slot to begin with)
  launch     — 3 channels total, capped at 1 PER CATEGORY (must be 1 store +
               1 marketplace + 1 digital channel — not "any 3 of one kind")
  growth     — 5 channels total, any mix, no per-category cap
  scale      — unlimited, any mix (absent from CHANNEL_LIMIT_BY_PLAN)

TheDersi shops never reach this: is_thedersi_restricted_shop's own
thedersi/daraz-only gate (checked first, in every channel endpoint) blocks
them before category rules would apply. TheDersi Official is a real Scale
customer under the hood and falls through to the scale case like any other
Scale shop — same for TheDersi Lite/Pro's fixed 2-slot (TheDersi + Daraz)
allowance, which is handled separately in channels.py, not here.

Shopify is a special case: every other channel type is a row in the shared
ChannelConnection table, but Shopify predates that table and still lives in
its own ShopifyStore table (see shopify_integration.py's connect_shopify).
_active_channel_types() below folds it in as a synthetic "shopify" entry so
it counts toward the total and the "store" category exactly like a real
ChannelConnection row would — otherwise a connected Shopify store would be
invisible to this whole module and a Launch shop could connect e.g.
WooCommerce too, going over its 1-store-channel cap without either check
ever noticing.
"""
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.channel import ChannelConnection
from app.models.shopify_integration import ShopifyStore

CHANNEL_CATEGORY = {
    "shopify": "store", "woocommerce": "store", "bigcommerce": "store", "custom": "store",
    "thedersi": "marketplace", "ebay": "marketplace", "etsy": "marketplace",
    "daraz": "marketplace", "noon": "marketplace", "tiktok": "marketplace",
    "whop": "digital", "gumroad": "digital",
}

CHANNEL_LIMIT_BY_PLAN = {"free_trial": 1, "launch": 3, "growth": 5}  # scale: unlimited (absent)

CATEGORY_LABEL = {"store": "custom/own store", "marketplace": "marketplace", "digital": "digital product"}

# Free Trial's own pricing copy names only Shopify, TheDersi, and Custom
# Website as its included channel — its 1-slot limit isn't "any 1 channel",
# it's specifically one of these three.
FREE_TRIAL_ALLOWED_CHANNELS = {"shopify", "thedersi", "custom"}


def _active_channel_types(shop_id: int, db: Session) -> list:
    """Every channel type this shop currently has connected, as plain type
    strings — ChannelConnection rows plus a synthetic "shopify" entry when a
    ShopifyStore row is connected (see module docstring for why Shopify
    needs its own lookup instead of a ChannelConnection query)."""
    types = [
        c.channel_type for c in db.query(ChannelConnection).filter(
            ChannelConnection.shop_id == shop_id,
            ChannelConnection.is_active == True,
        ).all()
    ]
    shopify = db.query(ShopifyStore).filter(
        ShopifyStore.shop_id == shop_id, ShopifyStore.is_connected == True,
    ).first()
    if shopify:
        types.append("shopify")
    return types


def check_channel_slot(shop_id: int, db: Session, channel_type: str, plan_type: str) -> None:
    """Raise HTTPException(403/429) if connecting `channel_type` would exceed
    this plan's channel slots. Call this AFTER any TheDersi-specific gate and
    AFTER confirming the seller isn't already connected to this exact channel."""
    if plan_type == "free_trial" and channel_type not in FREE_TRIAL_ALLOWED_CHANNELS:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "plan_required",
                "plan": plan_type,
                "message": f"{channel_type.title()} isn't available on Free Trial. Upgrade to Launch or higher to connect it.",
            },
        )

    active_types = _active_channel_types(shop_id, db)

    limit = CHANNEL_LIMIT_BY_PLAN.get(plan_type)
    if limit is not None and len(active_types) >= limit:
        raise HTTPException(
            status_code=429,
            detail={
                "error": "channel_limit_reached",
                "limit": limit,
                "plan": plan_type,
                "message": f"Your plan allows {limit} channel connection{'s' if limit != 1 else ''}. Upgrade for more channels.",
            },
        )

    # Launch's 3 slots are 1 store + 1 marketplace + 1 digital, not "any 3."
    if plan_type == "launch":
        category = CHANNEL_CATEGORY.get(channel_type)
        if category and any(CHANNEL_CATEGORY.get(t) == category for t in active_types):
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "channel_category_limit_reached",
                    "category": category,
                    "plan": plan_type,
                    "message": f"Launch includes 1 {CATEGORY_LABEL[category]} channel, and you already have one connected. Upgrade to Growth to connect more than one channel of the same type.",
                },
            )
