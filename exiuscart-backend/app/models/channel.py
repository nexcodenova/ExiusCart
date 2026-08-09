from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from app.core.database import Base


class ChannelConnection(Base):
    __tablename__ = "channel_connections"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)
    channel_type = Column(String(50), nullable=False)       # "thedersi" | "shopify" | "woocommerce"
    channel_api_key = Column(Text, nullable=True)            # API key to call channel's product API —
                                                              # for Noon this holds a JSON blob (key_id,
                                                              # private_key, channel_identifier, project_code)
                                                              # since the RSA private key alone is ~1750 chars
    channel_api_url = Column(String(500), nullable=True)    # override default channel API URL
    channel_seller_id = Column(String(100), nullable=True)  # seller ID on the channel
    # 2-letter ISO country the seller's account is REGISTERED under on this
    # channel — eBay in particular requires this to match your own item
    # location or it rejects the listing outright. Never inferred from the
    # shop's general profile country (that's for invoicing/VAT and can
    # legitimately differ) — the seller states it explicitly when
    # connecting, since only they know what they registered with eBay.
    seller_country = Column(String(2), nullable=True)
    channel_warehouse_code = Column(String(100), nullable=True)  # Noon: seller's own chosen warehouse
                                                                   # (their own licensed space, or Noon's
                                                                   # own consolidation center) — fetched
                                                                   # from their account, never assumed
    webhook_secret = Column(String(100), nullable=False, unique=True)  # channel calls this back
    is_active = Column(Boolean, default=True)
    seller_status = Column(String(20), nullable=True)  # approved | suspended | rejected (set by channel partner)
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # TheDersi payout automation — opt-in, off by default. When enabled, ExiusCart
    # automatically submits the seller's payout request every Monday 00:00 Sri
    # Lanka time, so a request never gets missed just because the seller forgot.
    auto_payout_enabled = Column(Boolean, default=False)
    last_auto_payout_attempt_at = Column(DateTime(timezone=True), nullable=True)

    # OAuth2 fields — used by channels that authorize per-seller (e.g. Daraz),
    # as opposed to a single static channel_api_key. Text, not a bounded
    # VARCHAR — eBay's real production tokens run several thousand
    # characters (much longer than sandbox tokens), so a fixed cap silently
    # truncates and fails the save. See migration a7c3e91f4d68.
    access_token = Column(Text, nullable=True)
    refresh_token = Column(Text, nullable=True)
    token_expires_at = Column(DateTime(timezone=True), nullable=True)
    oauth_state = Column(String(100), nullable=True)  # CSRF token for the in-flight authorize request

    # Payment gateway credentials — Custom Website channel only. Gateway-
    # agnostic on purpose: `payment_gateway` names which one is active
    # (e.g. "payhere" today), `gateway_merchant_id`/`gateway_merchant_secret`
    # hold whatever that gateway calls its credentials. Swapping to a
    # different gateway later is a new value + new checkout/webhook logic,
    # not a schema change. gateway_merchant_secret is used server-side only
    # (signing/verifying checkout requests and webhooks) — never sent to
    # the browser.
    payment_gateway = Column(String(30), nullable=True)
    gateway_merchant_id = Column(String(100), nullable=True)
    gateway_merchant_secret = Column(String(255), nullable=True)

    # Cached product-fields spec from the channel's own API (TheDersi's
    # /exiuscart/product-fields — Brand, Material, Metal Type, etc.), so we
    # never hardcode a field list that only they can keep current. Refetched
    # when stale (see PRODUCT_FIELDS_CACHE_TTL in channels.py) rather than
    # on every form load, so a busy seller opening the product form
    # repeatedly doesn't hammer the channel's API.
    field_defs_cache = Column(JSON, nullable=True)
    field_defs_synced_at = Column(DateTime(timezone=True), nullable=True)
