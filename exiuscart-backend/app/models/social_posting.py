from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class SocialAccountConnection(Base):
    """A seller's own connected Facebook Page / Instagram Business account /
    TikTok account, used ONLY for posting content on their behalf (Meta
    Content Publishing API, TikTok Content Posting API) — a completely
    different product/app registration than tiktok.py's TikTok Shop
    (selling channel) or meta_ad_library.py's Ad Library search (read-only,
    no seller auth at all). BYOK in spirit: each seller authorizes
    ExiusCart's app against THEIR OWN social accounts, same as CJ/HyperSKU/
    Higgsfield — tokens are encrypted at rest via app.core.encryption.

    For Instagram specifically: publishing goes through the Instagram
    Business Account that's linked to a Facebook Page, so an "instagram" row
    always carries page_id (the parent Page) alongside account_id (the IG
    Business Account id) — both discovered from the same /me/accounts call
    during the Facebook connect flow, not a separate Instagram login."""
    __tablename__ = "social_account_connections"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    platform = Column(String(20), nullable=False)  # "facebook" | "instagram" | "tiktok"

    account_id = Column(String(100), nullable=False)   # FB Page id / IG Business Account id / TikTok open_id
    account_name = Column(String(255), nullable=True)
    page_id = Column(String(100), nullable=True)        # instagram rows only: the parent FB Page id

    access_token = Column(Text, nullable=True)          # encrypted (Fernet) — Page token (FB/IG) or user token (TikTok)
    refresh_token = Column(Text, nullable=True)          # encrypted — TikTok only, FB page tokens don't expire in practice
    token_expires_at = Column(DateTime(timezone=True), nullable=True)

    # Staging for the Facebook flow: a long-lived USER token is held here,
    # encrypted, between the OAuth callback and the seller picking which
    # Page to connect (a seller can manage multiple Pages) — cleared once
    # connect-page finalizes real connection row(s) below.
    pending_user_token = Column(Text, nullable=True)
    oauth_state = Column(String(100), nullable=True, index=True)  # CSRF token while a connection is pending

    is_active = Column(Boolean, default=False, nullable=False)
    connected_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (UniqueConstraint("shop_id", "platform", "account_id", name="uq_social_account_shop_platform_account"),)


class SocialPost(Base):
    """One composed post, fanned out to one or more connected platforms.
    Publishing results are per-platform (a post can succeed on Facebook and
    fail on TikTok) so status/results_json are intentionally a summary +
    detail pair rather than a single pass/fail flag."""
    __tablename__ = "social_posts"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True, index=True)

    platforms = Column(Text, nullable=False)   # JSON list, e.g. ["facebook","instagram","tiktok"]
    caption = Column(Text, nullable=True)
    media_url = Column(Text, nullable=False)
    media_type = Column(String(10), nullable=False)  # "image" | "video"

    status = Column(String(20), nullable=False, default="scheduled")  # scheduled|publishing|published|partial|failed|canceled
    scheduled_at = Column(DateTime(timezone=True), nullable=False)
    published_at = Column(DateTime(timezone=True), nullable=True)

    results_json = Column(Text, nullable=True)   # {"facebook": {"success": true, "post_id": "..."}, ...}
    error_message = Column(Text, nullable=True)  # top-level fallback, e.g. "no active connections"

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    product = relationship("Product")
