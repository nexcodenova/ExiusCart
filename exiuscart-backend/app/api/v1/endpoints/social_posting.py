"""
Social Media Post Automation — Facebook Page / Instagram Business / TikTok.

A seller connects THEIR OWN social accounts (BYOK, same spirit as CJ/
HyperSKU/Higgsfield — ExiusCart never posts as itself), composes one post
with an image or video, picks which connected platforms to publish to, and
either posts now or schedules it. A background thread (registered in
main.py, matching every other *_scheduler pattern there) picks up due posts
and actually publishes them.

This is a DIFFERENT product/app registration on both Meta's and TikTok's
side than anything else already in this codebase:
  - tiktok.py's TikTok Shop Partner Center app is for SELLING (an entirely
    separate TikTok "app"/API family) — TIKTOK_APP_KEY/SECRET there are not
    reusable here. This module needs its own TikTok Developer app with the
    Content Posting API product enabled (TIKTOK_CONTENT_CLIENT_KEY/SECRET).
  - meta_ad_library.py only ever does read-only, unauthenticated ad search
    (a system user token, no seller login at all) — this module needs a
    real Facebook Login (business) app with pages_manage_posts,
    pages_show_list, instagram_basic, instagram_content_publish scopes,
    which requires Meta App Review before any of this works for a real
    seller (the same 503-until-configured pattern used for AliExpress/
    Daraz/eBay's own APP_KEY-gated integrations).

Sourcing note (same discipline as tiktok.py's own docstring — confirmed vs
inferred, not presented as equally certain):
  - Instagram's two-step container flow (POST /{ig_id}/media → POST
    /{ig_id}/media_publish, fields image_url/video_url/media_type/caption/
    creation_id) — CONFIRMED against Meta's own Content Publishing docs.
  - Facebook Page posting (POST /{page_id}/feed for text/link, POST
    /{page_id}/photos with `url`) — CONFIRMED against Meta's own Pages
    Publishing docs. Page *video* posting is inferred (POST /{page_id}/videos
    with file_url/description, matching Meta's Video API's own documented
    field-naming convention elsewhere) — UNVERIFIED, re-check on first real
    attempt, same as TikTok Shop's own image-upload guess in tiktok.py.
  - TikTok's video init endpoint (POST https://open.tiktokapis.com/v2/post/
    publish/video/init/, source_info.source="PULL_FROM_URL"+video_url,
    post_info.title/privacy_level) and its OAuth token endpoint (POST
    https://open.tiktokapis.com/v2/oauth/token/, grant_type=
    "authorization_code" — TikTok's OWN Login Kit uses the OAuth-spec
    spelling here, unlike TikTok Shop's non-standard "authorized_code") —
    CONFIRMED against TikTok's own Content Posting API + OAuth docs.
  - TikTok's OAuth *authorize* URL — TikTok's docs confirm the base
    (https://www.tiktok.com/v2/auth/authorize/) but the query param names
    used below (client_key, scope, response_type=code, redirect_uri, state)
    are the standard OAuth names TikTok's own token endpoint already
    confirms it expects (client_key, redirect_uri) — UNVERIFIED as a whole
    URL until a real TIKTOK_CONTENT_CLIENT_KEY exists to test against.
  - Unaudited TikTok apps can only publish with privacy_level="SELF_ONLY"
    (TikTok's own well-documented sandbox restriction on any app that
    hasn't completed Content Posting API audit) — this is hardcoded below
    until TIKTOK_CONTENT_AUDITED=true is set, so a seller's first real posts
    don't fail on a scope they don't have yet.
"""
import os
import json
import logging
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.database import get_db, SessionLocal
from app.core.encryption import encrypt, decrypt
from app.core.storage import upload_social_media
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.shop import Shop
from app.models.subscription import Subscription
from app.models.social_posting import SocialAccountConnection, SocialPost

logger = logging.getLogger(__name__)
router = APIRouter()

META_APP_ID = os.getenv("META_APP_ID", "")
META_APP_SECRET = os.getenv("META_APP_SECRET", "")
META_OAUTH_REDIRECT_URI = os.getenv("META_OAUTH_REDIRECT_URI", "")
META_GRAPH_VERSION = "v19.0"
META_GRAPH_BASE = f"https://graph.facebook.com/{META_GRAPH_VERSION}"

TIKTOK_CONTENT_CLIENT_KEY = os.getenv("TIKTOK_CONTENT_CLIENT_KEY", "")
TIKTOK_CONTENT_CLIENT_SECRET = os.getenv("TIKTOK_CONTENT_CLIENT_SECRET", "")
TIKTOK_CONTENT_REDIRECT_URI = os.getenv("TIKTOK_CONTENT_REDIRECT_URI", "")
TIKTOK_CONTENT_AUDITED = os.getenv("TIKTOK_CONTENT_AUDITED", "false").lower() == "true"
TIKTOK_AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/"
TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/"
TIKTOK_API_BASE = "https://open.tiktokapis.com/v2"

STOREFRONT_BASE = os.getenv("STOREFRONT_BASE_URL", "https://store.exiuscart.com")


def _shop_or_404(shop_id: int, user: User, db: Session) -> Shop:
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


def _get_plan(shop_id: int, db: Session) -> str:
    sub = db.query(Subscription).filter(Subscription.shop_id == shop_id).order_by(Subscription.id.desc()).first()
    return sub.plan_type if sub else "free_trial"


def _require_premium(shop_id: int, db: Session):
    if _get_plan(shop_id, db) != "premium":
        raise HTTPException(status_code=403, detail={
            "error": "upgrade_required",
            "message": "Social media post automation is a Premium feature.",
        })


def _conn_out(c: SocialAccountConnection) -> dict:
    return {
        "id": c.id,
        "platform": c.platform,
        "account_id": c.account_id,
        "account_name": c.account_name,
        "connected_at": c.connected_at.isoformat() if c.connected_at else None,
    }


# ── Connections ──────────────────────────────────────────────────────────────

@router.get("/shops/{shop_id}/social/connections")
def list_social_connections(shop_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _shop_or_404(shop_id, current_user, db)
    conns = db.query(SocialAccountConnection).filter(
        SocialAccountConnection.shop_id == shop_id,
        SocialAccountConnection.is_active == True,
    ).all()
    return {
        "connections": [_conn_out(c) for c in conns],
        "facebook_configured": bool(META_APP_ID and META_APP_SECRET and META_OAUTH_REDIRECT_URI),
        "tiktok_configured": bool(TIKTOK_CONTENT_CLIENT_KEY and TIKTOK_CONTENT_CLIENT_SECRET and TIKTOK_CONTENT_REDIRECT_URI),
    }


@router.delete("/shops/{shop_id}/social/connections/{conn_id}")
def disconnect_social_account(shop_id: int, conn_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _shop_or_404(shop_id, current_user, db)
    conn = db.query(SocialAccountConnection).filter(
        SocialAccountConnection.id == conn_id, SocialAccountConnection.shop_id == shop_id,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    db.delete(conn)
    db.commit()
    return {"message": "Disconnected"}


# ── Facebook / Instagram OAuth connect ──────────────────────────────────────
#
# Facebook Login for Business dialog + long-lived-token exchange are Meta's
# own stable, extensively-documented endpoints (unchanged for years) —
# treated as CONFIRMED without a live fetch, same confidence level the rest
# of this codebase gives eBay's/Shopify's own equally-stable OAuth dialogs.

@router.get("/shops/{shop_id}/social/facebook/authorize")
def facebook_authorize(shop_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    shop = _shop_or_404(shop_id, current_user, db)
    _require_premium(shop_id, db)

    if not META_APP_ID or not META_OAUTH_REDIRECT_URI:
        raise HTTPException(status_code=503, detail="Facebook/Instagram posting isn't configured yet — ExiusCart's Meta app is still pending App Review.")

    import secrets
    state = secrets.token_urlsafe(32)

    pending = db.query(SocialAccountConnection).filter(
        SocialAccountConnection.shop_id == shop_id,
        SocialAccountConnection.platform == "facebook_pending",
    ).first()
    if pending:
        pending.oauth_state = state
    else:
        pending = SocialAccountConnection(
            shop_id=shop_id, platform="facebook_pending", account_id="pending",
            is_active=False, oauth_state=state,
        )
        db.add(pending)
    db.commit()

    scopes = "pages_show_list,pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish"
    authorize_url = (
        f"https://www.facebook.com/{META_GRAPH_VERSION}/dialog/oauth"
        f"?client_id={META_APP_ID}&redirect_uri={META_OAUTH_REDIRECT_URI}"
        f"&state={state}&scope={scopes}"
    )
    return {"authorize_url": authorize_url}


@router.get("/social/facebook/callback")
def facebook_callback(code: str = None, state: str = None, error: str = None, db: Session = Depends(get_db)):
    """Facebook redirects the browser here after the seller approves (or
    denies) access. Exchanges the code for a short-lived user token, then
    upgrades it to a long-lived one (~60 days) and stashes it — the seller
    still needs to pick which Page to connect (they may manage several),
    handled by the two authenticated endpoints below."""
    if error or not code or not state:
        logger.warning(f"[FB OAUTH] callback failed — error={error} code_present={bool(code)} state_present={bool(state)}")
        return RedirectResponse(f"{STOREFRONT_BASE}/dashboard/social-posting?fb=denied")

    pending = db.query(SocialAccountConnection).filter(
        SocialAccountConnection.platform == "facebook_pending",
        SocialAccountConnection.oauth_state == state,
    ).first()
    if not pending:
        logger.error(f"[FB OAUTH] callback with unknown/expired state={state[:8]}...")
        return RedirectResponse(f"{STOREFRONT_BASE}/dashboard/social-posting?fb=invalid_state")

    try:
        with httpx.Client(timeout=15) as client:
            resp = client.get(f"{META_GRAPH_BASE}/oauth/access_token", params={
                "client_id": META_APP_ID, "client_secret": META_APP_SECRET,
                "redirect_uri": META_OAUTH_REDIRECT_URI, "code": code,
            })
            short_token = resp.json().get("access_token")
            if not short_token:
                raise RuntimeError(f"no access_token in response: {resp.text[:300]}")

            resp2 = client.get(f"{META_GRAPH_BASE}/oauth/access_token", params={
                "grant_type": "fb_exchange_token", "client_id": META_APP_ID,
                "client_secret": META_APP_SECRET, "fb_exchange_token": short_token,
            })
            long_token = resp2.json().get("access_token") or short_token
    except Exception as e:
        logger.error(f"[FB OAUTH] token exchange failed: {e}")
        return RedirectResponse(f"{STOREFRONT_BASE}/dashboard/social-posting?fb=pending")

    pending.pending_user_token = encrypt(long_token)
    pending.oauth_state = None
    db.commit()
    return RedirectResponse(f"{STOREFRONT_BASE}/dashboard/social-posting?fb=select-page&shop_id={pending.shop_id}")


def _fetch_fb_pages(user_token: str) -> list:
    """GET /me/accounts — every Page the authorizing user manages, plus each
    Page's own access token and (if linked) its Instagram Business Account
    id, in one call."""
    with httpx.Client(timeout=15) as client:
        resp = client.get(f"{META_GRAPH_BASE}/me/accounts", params={
            "access_token": user_token,
            "fields": "id,name,access_token,instagram_business_account{id,username}",
        })
        if resp.status_code >= 300:
            logger.error(f"[FB OAUTH] /me/accounts failed: {resp.text[:300]}")
            return []
        return resp.json().get("data", [])


@router.get("/shops/{shop_id}/social/facebook/pages")
def list_facebook_pages(shop_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """The seller picks which Page to connect from here — called by the
    frontend right after the ?fb=select-page redirect."""
    _shop_or_404(shop_id, current_user, db)
    pending = db.query(SocialAccountConnection).filter(
        SocialAccountConnection.shop_id == shop_id,
        SocialAccountConnection.platform == "facebook_pending",
        SocialAccountConnection.pending_user_token.isnot(None),
    ).first()
    if not pending:
        raise HTTPException(status_code=400, detail="No pending Facebook connection — start from 'Connect Facebook' again.")

    pages = _fetch_fb_pages(decrypt(pending.pending_user_token))
    return {
        "pages": [
            {"id": p["id"], "name": p.get("name"), "has_instagram": bool(p.get("instagram_business_account"))}
            for p in pages
        ]
    }


class ConnectPageIn(BaseModel):
    page_id: str


@router.post("/shops/{shop_id}/social/facebook/connect-page")
def connect_facebook_page(shop_id: int, data: ConnectPageIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Finalizes the connection for the chosen Page — creates a "facebook"
    row (Page access token), and an "instagram" row too if that Page has a
    linked Instagram Business Account."""
    _shop_or_404(shop_id, current_user, db)
    pending = db.query(SocialAccountConnection).filter(
        SocialAccountConnection.shop_id == shop_id,
        SocialAccountConnection.platform == "facebook_pending",
        SocialAccountConnection.pending_user_token.isnot(None),
    ).first()
    if not pending:
        raise HTTPException(status_code=400, detail="No pending Facebook connection — start from 'Connect Facebook' again.")

    pages = _fetch_fb_pages(decrypt(pending.pending_user_token))
    page = next((p for p in pages if p["id"] == data.page_id), None)
    if not page:
        raise HTTPException(status_code=404, detail="That Page wasn't found among the ones you authorized.")

    page_token = page.get("access_token")
    if not page_token:
        raise HTTPException(status_code=502, detail="Facebook didn't return an access token for that Page.")

    existing_fb = db.query(SocialAccountConnection).filter(
        SocialAccountConnection.shop_id == shop_id, SocialAccountConnection.platform == "facebook",
        SocialAccountConnection.account_id == page["id"],
    ).first()
    if existing_fb:
        existing_fb.access_token = encrypt(page_token)
        existing_fb.account_name = page.get("name")
        existing_fb.is_active = True
    else:
        db.add(SocialAccountConnection(
            shop_id=shop_id, platform="facebook", account_id=page["id"],
            account_name=page.get("name"), access_token=encrypt(page_token), is_active=True,
        ))

    ig = page.get("instagram_business_account")
    if ig:
        existing_ig = db.query(SocialAccountConnection).filter(
            SocialAccountConnection.shop_id == shop_id, SocialAccountConnection.platform == "instagram",
            SocialAccountConnection.account_id == ig["id"],
        ).first()
        if existing_ig:
            existing_ig.access_token = encrypt(page_token)
            existing_ig.account_name = ig.get("username")
            existing_ig.page_id = page["id"]
            existing_ig.is_active = True
        else:
            db.add(SocialAccountConnection(
                shop_id=shop_id, platform="instagram", account_id=ig["id"], page_id=page["id"],
                account_name=ig.get("username"), access_token=encrypt(page_token), is_active=True,
            ))

    db.delete(pending)
    db.commit()
    return {"message": "Connected", "instagram_linked": bool(ig)}


# ── TikTok OAuth connect ─────────────────────────────────────────────────────

@router.get("/shops/{shop_id}/social/tiktok/authorize")
def tiktok_content_authorize(shop_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    shop = _shop_or_404(shop_id, current_user, db)
    _require_premium(shop_id, db)

    if not TIKTOK_CONTENT_CLIENT_KEY or not TIKTOK_CONTENT_REDIRECT_URI:
        raise HTTPException(status_code=503, detail="TikTok posting isn't configured yet — ExiusCart's Content Posting API app is still pending approval.")

    import secrets
    state = secrets.token_urlsafe(32)

    pending = db.query(SocialAccountConnection).filter(
        SocialAccountConnection.shop_id == shop_id,
        SocialAccountConnection.platform == "tiktok",
        SocialAccountConnection.is_active == False,
    ).first()
    if pending:
        pending.oauth_state = state
    else:
        pending = SocialAccountConnection(
            shop_id=shop_id, platform="tiktok", account_id="pending",
            is_active=False, oauth_state=state,
        )
        db.add(pending)
    db.commit()

    authorize_url = (
        f"{TIKTOK_AUTH_URL}?client_key={TIKTOK_CONTENT_CLIENT_KEY}&scope=video.publish"
        f"&response_type=code&redirect_uri={TIKTOK_CONTENT_REDIRECT_URI}&state={state}"
    )
    return {"authorize_url": authorize_url}


@router.get("/social/tiktok/callback")
def tiktok_content_callback(code: str = None, state: str = None, error: str = None, db: Session = Depends(get_db)):
    if error or not code or not state:
        logger.warning(f"[TIKTOK CONTENT OAUTH] callback failed — error={error} code_present={bool(code)} state_present={bool(state)}")
        return RedirectResponse(f"{STOREFRONT_BASE}/dashboard/social-posting?tiktok=denied")

    conn = db.query(SocialAccountConnection).filter(
        SocialAccountConnection.platform == "tiktok",
        SocialAccountConnection.oauth_state == state,
        SocialAccountConnection.is_active == False,
    ).first()
    if not conn:
        logger.error(f"[TIKTOK CONTENT OAUTH] callback with unknown/expired state={state[:8]}...")
        return RedirectResponse(f"{STOREFRONT_BASE}/dashboard/social-posting?tiktok=invalid_state")

    try:
        with httpx.Client(timeout=15) as client:
            resp = client.post(TIKTOK_TOKEN_URL, data={
                "client_key": TIKTOK_CONTENT_CLIENT_KEY, "client_secret": TIKTOK_CONTENT_CLIENT_SECRET,
                "code": code, "grant_type": "authorization_code", "redirect_uri": TIKTOK_CONTENT_REDIRECT_URI,
            }, headers={"Content-Type": "application/x-www-form-urlencoded"})
            data = resp.json()
            if resp.status_code >= 300 or "access_token" not in data:
                raise RuntimeError(f"token exchange failed: {resp.text[:300]}")
    except Exception as e:
        logger.error(f"[TIKTOK CONTENT OAUTH] shop={conn.shop_id} token exchange failed: {e}")
        return RedirectResponse(f"{STOREFRONT_BASE}/dashboard/social-posting?tiktok=pending")

    from datetime import timedelta
    conn.account_id = data.get("open_id", conn.account_id)
    conn.access_token = encrypt(data["access_token"])
    conn.refresh_token = encrypt(data["refresh_token"]) if data.get("refresh_token") else None
    conn.token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=data.get("expires_in", 0))
    conn.account_name = f"TikTok ({conn.account_id[:8]}…)"
    conn.is_active = True
    conn.oauth_state = None
    db.commit()
    return RedirectResponse(f"{STOREFRONT_BASE}/dashboard/social-posting?tiktok=connected")


# ── Posts ────────────────────────────────────────────────────────────────────

def _post_out(p: SocialPost) -> dict:
    return {
        "id": p.id,
        "platforms": json.loads(p.platforms),
        "caption": p.caption,
        "media_url": p.media_url,
        "media_type": p.media_type,
        "status": p.status,
        "scheduled_at": p.scheduled_at.isoformat() if p.scheduled_at else None,
        "published_at": p.published_at.isoformat() if p.published_at else None,
        "results": json.loads(p.results_json) if p.results_json else None,
        "error_message": p.error_message,
        "product_id": p.product_id,
    }


@router.post("/shops/{shop_id}/social/posts")
def create_social_post(
    shop_id: int,
    caption: str = Form(""),
    platforms: str = Form(...),  # comma-separated, e.g. "facebook,instagram"
    scheduled_at: str = Form(None),  # ISO datetime, omitted/blank = post now
    product_id: int = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shop = _shop_or_404(shop_id, current_user, db)
    _require_premium(shop_id, db)

    platform_list = [p.strip() for p in platforms.split(",") if p.strip()]
    if not platform_list:
        raise HTTPException(status_code=400, detail="Pick at least one platform to post to.")

    connected = {c.platform for c in db.query(SocialAccountConnection).filter(
        SocialAccountConnection.shop_id == shop_id, SocialAccountConnection.is_active == True,
        SocialAccountConnection.platform.in_(platform_list),
    ).all()}
    missing = set(platform_list) - connected
    if missing:
        raise HTTPException(status_code=400, detail=f"Not connected: {', '.join(sorted(missing))}. Connect them first.")

    contents = file.file.read()
    if len(contents) > 100 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (100MB max).")
    is_video = (file.content_type or "").startswith("video/")
    ext = (file.filename or "").rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else ("mp4" if is_video else "jpg")
    try:
        media_url = upload_social_media(contents, shop_id, ext, file.content_type or ("video/mp4" if is_video else "image/jpeg"))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    when = datetime.now(timezone.utc)
    if scheduled_at:
        try:
            when = datetime.fromisoformat(scheduled_at.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid scheduled_at — use ISO format.")

    post = SocialPost(
        shop_id=shop_id, product_id=product_id,
        platforms=json.dumps(platform_list), caption=caption,
        media_url=media_url, media_type="video" if is_video else "image",
        status="scheduled", scheduled_at=when,
    )
    db.add(post)
    db.commit()
    db.refresh(post)

    # Due now (or already past) → publish immediately rather than making the
    # seller wait for the scheduler's next tick.
    if when <= datetime.now(timezone.utc):
        _publish_post(post, db)

    return _post_out(post)


@router.get("/shops/{shop_id}/social/posts")
def list_social_posts(shop_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _shop_or_404(shop_id, current_user, db)
    posts = db.query(SocialPost).filter(SocialPost.shop_id == shop_id).order_by(SocialPost.created_at.desc()).limit(100).all()
    return {"posts": [_post_out(p) for p in posts]}


@router.delete("/shops/{shop_id}/social/posts/{post_id}")
def cancel_social_post(shop_id: int, post_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _shop_or_404(shop_id, current_user, db)
    post = db.query(SocialPost).filter(SocialPost.id == post_id, SocialPost.shop_id == shop_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.status not in ("scheduled",):
        raise HTTPException(status_code=400, detail=f"Can't cancel a post that's already {post.status}.")
    post.status = "canceled"
    db.commit()
    return {"message": "Canceled"}


# ── Publishing ───────────────────────────────────────────────────────────────

def _publish_to_facebook(conn: SocialAccountConnection, post: SocialPost) -> tuple[bool, str]:
    token = decrypt(conn.access_token)
    endpoint = f"{META_GRAPH_BASE}/{conn.account_id}/{'videos' if post.media_type == 'video' else 'photos'}"
    # Photos take `url`; Meta's Video API (UNVERIFIED shape, see module docstring) takes `file_url`+`description`.
    if post.media_type == "video":
        payload = {"access_token": token, "file_url": post.media_url, "description": post.caption or ""}
    else:
        payload = {"access_token": token, "url": post.media_url, "caption": post.caption or ""}
    try:
        with httpx.Client(timeout=60) as client:
            resp = client.post(endpoint, data=payload)
        if resp.status_code >= 300:
            return False, resp.text[:500]
        return True, resp.json().get("id") or resp.json().get("post_id", "")
    except Exception as e:
        return False, str(e)[:500]


def _publish_to_instagram(conn: SocialAccountConnection, post: SocialPost) -> tuple[bool, str]:
    token = decrypt(conn.access_token)
    try:
        with httpx.Client(timeout=60) as client:
            container_payload = {"access_token": token, "caption": post.caption or ""}
            if post.media_type == "video":
                container_payload["video_url"] = post.media_url
                container_payload["media_type"] = "REELS"
            else:
                container_payload["image_url"] = post.media_url

            resp = client.post(f"{META_GRAPH_BASE}/{conn.account_id}/media", data=container_payload)
            if resp.status_code >= 300:
                return False, resp.text[:500]
            creation_id = resp.json().get("id")
            if not creation_id:
                return False, f"no container id in response: {resp.text[:300]}"

            # Video containers process asynchronously — Instagram's own docs
            # note this; poll status_code up to ~2 minutes before publishing.
            if post.media_type == "video":
                import time as _time
                for _ in range(24):
                    status_resp = client.get(f"{META_GRAPH_BASE}/{creation_id}", params={"fields": "status_code", "access_token": token})
                    status = (status_resp.json() or {}).get("status_code")
                    if status == "FINISHED":
                        break
                    if status == "ERROR":
                        return False, "Instagram failed to process the video container."
                    _time.sleep(5)

            publish_resp = client.post(f"{META_GRAPH_BASE}/{conn.account_id}/media_publish", data={
                "access_token": token, "creation_id": creation_id,
            })
            if publish_resp.status_code >= 300:
                return False, publish_resp.text[:500]
            return True, publish_resp.json().get("id", "")
    except Exception as e:
        return False, str(e)[:500]


def _publish_to_tiktok(conn: SocialAccountConnection, post: SocialPost) -> tuple[bool, str]:
    if post.media_type != "video":
        return False, "TikTok only accepts video posts."
    token = decrypt(conn.access_token)
    body = {
        "post_info": {
            "title": (post.caption or "")[:2200],
            "privacy_level": "SELF_ONLY" if not TIKTOK_CONTENT_AUDITED else "PUBLIC_TO_EVERYONE",
            "disable_duet": False, "disable_comment": False, "disable_stitch": False,
        },
        "source_info": {"source": "PULL_FROM_URL", "video_url": post.media_url},
    }
    try:
        with httpx.Client(timeout=60) as client:
            resp = client.post(
                f"{TIKTOK_API_BASE}/post/publish/video/init/", json=body,
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            )
        data = resp.json()
        if resp.status_code >= 300 or (data.get("error") or {}).get("code") not in (None, "ok"):
            return False, resp.text[:500]
        return True, (data.get("data") or {}).get("publish_id", "")
    except Exception as e:
        return False, str(e)[:500]


_PUBLISHERS = {"facebook": _publish_to_facebook, "instagram": _publish_to_instagram, "tiktok": _publish_to_tiktok}


def _publish_post(post: SocialPost, db: Session):
    post.status = "publishing"
    db.commit()

    platforms = json.loads(post.platforms)
    connections = {c.platform: c for c in db.query(SocialAccountConnection).filter(
        SocialAccountConnection.shop_id == post.shop_id, SocialAccountConnection.is_active == True,
        SocialAccountConnection.platform.in_(platforms),
    ).all()}

    results = {}
    for platform in platforms:
        conn = connections.get(platform)
        if not conn:
            results[platform] = {"success": False, "error": "not connected anymore"}
            continue
        publisher = _PUBLISHERS.get(platform)
        success, detail = publisher(conn, post)
        results[platform] = {"success": success, **({"post_id": detail} if success else {"error": detail})}
        if not success:
            logger.error(f"[SOCIAL PUBLISH] shop={post.shop_id} post={post.id} platform={platform} failed: {detail}")

    post.results_json = json.dumps(results)
    successes = sum(1 for r in results.values() if r["success"])
    post.status = "published" if successes == len(platforms) else ("partial" if successes else "failed")
    post.published_at = datetime.now(timezone.utc)
    db.commit()


def run_scheduled_social_posts_job():
    """Registered in main.py alongside every other *_scheduler thread —
    picks up posts whose scheduled_at has arrived and publishes them."""
    db = SessionLocal()
    try:
        due = db.query(SocialPost).filter(
            SocialPost.status == "scheduled",
            SocialPost.scheduled_at <= datetime.now(timezone.utc),
        ).all()
        for post in due:
            try:
                _publish_post(post, db)
            except Exception as e:
                logger.error(f"[SOCIAL PUBLISH] post={post.id} unexpected error: {e}")
                post.status = "failed"
                post.error_message = str(e)[:500]
                db.commit()
    finally:
        db.close()
