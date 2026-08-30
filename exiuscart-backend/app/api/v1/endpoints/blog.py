"""
Storefront blog — seller-authored posts, published to the Custom Website
public API and (optionally) pushed to a connected Shopify store's real
Articles API. No eBay/Daraz/Noon/TheDersi push — none of those platforms
have a seller-facing blog/content concept to push into; building that
would be faking support that doesn't exist anywhere to receive it.
"""
import logging
from datetime import datetime, timezone
from typing import Optional, List

import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile
from pydantic import BaseModel
from slugify import slugify
import uuid

from app.core.database import get_db
from sqlalchemy.orm import Session
from app.core.thedersi import is_thedersi_shop
from app.models.user import User
from app.models.shop import Shop
from app.models.blog import BlogPost
from app.models.subscription import Subscription
from app.api.v1.deps import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

# Embedded-image cap inside the rich editor's content — same reasoning as
# every other plan-tiered limit in this codebase (PLAN_PRODUCT_LIMITS in
# products.py): a real article needs room for more than the 3-image cap
# product descriptions use, and premium sellers get more than starter.
BLOG_IMAGE_LIMITS = {
    "free_trial": 3,
    "thedersi_basic": 3,
    "starter": 8,
    "thedersi_pro": 8,
    "premium": 15,
}


def _shop_or_404(shop_id: int, user: User, db: Session) -> Shop:
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


def _block_thedersi(shop_id: int, db: Session) -> None:
    """TheDersi sellers are fulfilled through TheDersi's own marketplace,
    which has no seller-facing blog concept — same reasoning that already
    blocks TheDersi shops from Dropshipping elsewhere in this codebase."""
    if is_thedersi_shop(shop_id, db):
        raise HTTPException(status_code=403, detail={
            "error": "not_available",
            "message": "Blog isn't available for TheDersi sellers — your storefront is managed by TheDersi, which has no blog feature to publish into.",
        })


def _get_plan(shop_id: int, db: Session) -> str:
    sub = db.query(Subscription).filter(Subscription.shop_id == shop_id).order_by(Subscription.id.desc()).first()
    return sub.plan_type if sub else "free_trial"


def _generate_blog_slug(title: str) -> str:
    return f"{slugify(title)}-{uuid.uuid4().hex[:6]}"


def _post_out(p: BlogPost) -> dict:
    return {
        "id": p.id,
        "title": p.title,
        "slug": p.slug,
        "excerpt": p.excerpt,
        "content": p.content,
        "cover_image_url": p.cover_image_url,
        "status": p.status,
        "published_at": p.published_at.isoformat() if p.published_at else None,
        "author_name": p.author_name,
        "tags": [t.strip() for t in p.tags.split(",")] if p.tags else [],
        "cta_text": p.cta_text,
        "cta_url": p.cta_url,
        "view_count": p.view_count or 0,
        "shopify_article_id": p.shopify_article_id,
        "woocommerce_post_id": p.woocommerce_post_id,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


# ── Schemas ────────────────────────────────────────────────────────────────

class BlogPostIn(BaseModel):
    title: str
    excerpt: Optional[str] = None
    content: Optional[str] = None
    cover_image_url: Optional[str] = None
    author_name: Optional[str] = None
    tags: Optional[str] = None
    cta_text: Optional[str] = None
    cta_url: Optional[str] = None


# ── Seller dashboard — CRUD ──────────────────────────────────────────────────

@router.get("/shops/{shop_id}/blog")
def list_blog_posts(
    shop_id: int,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    q = db.query(BlogPost).filter(BlogPost.shop_id == shop_id)
    if status_filter:
        q = q.filter(BlogPost.status == status_filter)
    posts = q.order_by(BlogPost.created_at.desc()).all()
    plan = _get_plan(shop_id, db)
    return {
        "posts": [_post_out(p) for p in posts],
        "image_limit": BLOG_IMAGE_LIMITS.get(plan, 3),
    }


@router.get("/shops/{shop_id}/blog/{post_id}")
def get_blog_post(
    shop_id: int,
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    post = db.query(BlogPost).filter(BlogPost.id == post_id, BlogPost.shop_id == shop_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return _post_out(post)


@router.post("/shops/{shop_id}/blog", status_code=201)
def create_blog_post(
    shop_id: int,
    data: BlogPostIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    _block_thedersi(shop_id, db)
    if not data.title.strip():
        raise HTTPException(status_code=422, detail="Title is required.")
    post = BlogPost(
        shop_id=shop_id,
        title=data.title.strip(),
        slug=_generate_blog_slug(data.title),
        excerpt=data.excerpt,
        content=data.content,
        cover_image_url=data.cover_image_url,
        author_name=data.author_name,
        tags=data.tags,
        cta_text=data.cta_text,
        cta_url=data.cta_url,
        status="draft",
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return _post_out(post)


@router.put("/shops/{shop_id}/blog/{post_id}")
def update_blog_post(
    shop_id: int,
    post_id: int,
    data: BlogPostIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    _block_thedersi(shop_id, db)
    post = db.query(BlogPost).filter(BlogPost.id == post_id, BlogPost.shop_id == shop_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    post.title = data.title.strip() or post.title
    post.excerpt = data.excerpt
    post.content = data.content
    post.cover_image_url = data.cover_image_url
    post.author_name = data.author_name
    post.tags = data.tags
    post.cta_text = data.cta_text
    post.cta_url = data.cta_url
    db.commit()
    db.refresh(post)
    return _post_out(post)


@router.delete("/shops/{shop_id}/blog/{post_id}")
def delete_blog_post(
    shop_id: int,
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    post = db.query(BlogPost).filter(BlogPost.id == post_id, BlogPost.shop_id == shop_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    db.delete(post)
    db.commit()
    return {"deleted": True}


class PublishIn(BaseModel):
    published: bool
    push_to_shopify: bool = False
    push_to_woocommerce: bool = False


@router.post("/shops/{shop_id}/blog/{post_id}/publish")
async def publish_blog_post(
    shop_id: int,
    post_id: int,
    data: PublishIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    _block_thedersi(shop_id, db)
    post = db.query(BlogPost).filter(BlogPost.id == post_id, BlogPost.shop_id == shop_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if data.published:
        if not (post.content or "").strip():
            raise HTTPException(status_code=422, detail="Can't publish an empty post — add some content first.")
        post.status = "published"
        if not post.published_at:
            post.published_at = datetime.now(timezone.utc)
    else:
        post.status = "draft"
    db.commit()

    shopify_result = None
    if data.published and data.push_to_shopify:
        shopify_result = await _push_to_shopify(shop_id, post, db)

    woocommerce_result = None
    if data.published and data.push_to_woocommerce:
        woocommerce_result = await _push_to_woocommerce(shop_id, post, db)

    db.refresh(post)
    return {"post": _post_out(post), "shopify": shopify_result, "woocommerce": woocommerce_result}


# ── Image upload — embedded in the rich editor's content ─────────────────────

@router.post("/shops/{shop_id}/blog/upload-image")
async def upload_blog_image(
    shop_id: int,
    file: UploadFile,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image must be under 10 MB.")
    ext = (file.filename or "img").rsplit(".", 1)[-1].lower()
    from app.core.storage import upload_shop_image
    url = upload_shop_image(contents, shop_id, "blog", ext, content_type=file.content_type or "image/jpeg")
    return {"url": url}


# ── Shopify — real Articles API push ─────────────────────────────────────────

async def _push_to_shopify(shop_id: int, post: BlogPost, db: Session) -> dict:
    """Pushes a published post to the seller's connected Shopify store as
    a real Article (Shopify's Blog/Article REST resource) — Shopify is the
    one other channel that genuinely has a blog concept to push into.
    Creates a default "News" blog on first push if the store has none,
    then reuses it for every post after. Best-effort: failures are
    reported back, not raised, so a Shopify hiccup doesn't block the
    Custom Website publish that already succeeded above."""
    from app.models.shopify_integration import ShopifyStore
    store = db.query(ShopifyStore).filter(ShopifyStore.shop_id == shop_id, ShopifyStore.is_connected == True).first()
    if not store:
        return {"ok": False, "error": "Shopify is not connected."}

    from app.api.v1.endpoints.shopify_integration import _shopify_url, _shopify_headers, SHOPIFY_API_VERSION

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            blog_id = post.shopify_blog_id
            if not blog_id:
                # Reuse an existing blog if the store already has one, rather
                # than creating a duplicate "News" blog on every store.
                r = await client.get(_shopify_url(store.shopify_domain, "blogs.json"), headers=_shopify_headers(store.access_token))
                blogs = (r.json() or {}).get("blogs") or []
                if blogs:
                    blog_id = blogs[0]["id"]
                else:
                    r = await client.post(
                        _shopify_url(store.shopify_domain, "blogs.json"),
                        headers=_shopify_headers(store.access_token),
                        json={"blog": {"title": "News"}},
                    )
                    if r.status_code not in (200, 201):
                        return {"ok": False, "error": f"Could not create a Shopify blog: {r.text[:300]}"}
                    blog_id = r.json()["blog"]["id"]

            payload = {
                "article": {
                    "title": post.title,
                    "author": post.author_name or "Staff",
                    "body_html": post.content or "",
                    "summary_html": post.excerpt or "",
                    "published": True,
                    "image": {"src": post.cover_image_url} if post.cover_image_url else None,
                    "tags": post.tags or "",
                }
            }
            if post.shopify_article_id:
                r = await client.put(
                    _shopify_url(store.shopify_domain, f"blogs/{blog_id}/articles/{post.shopify_article_id}.json"),
                    headers=_shopify_headers(store.access_token), json=payload,
                )
            else:
                r = await client.post(
                    _shopify_url(store.shopify_domain, f"blogs/{blog_id}/articles.json"),
                    headers=_shopify_headers(store.access_token), json=payload,
                )
            if r.status_code not in (200, 201):
                return {"ok": False, "error": f"Shopify rejected the article: {r.text[:300]}"}

            article = r.json()["article"]
            post.shopify_blog_id = str(blog_id)
            post.shopify_article_id = str(article["id"])
            db.commit()
            return {"ok": True, "article_id": str(article["id"])}
    except Exception as exc:
        logger.error(f"[BLOG->SHOPIFY] shop={shop_id} post={post.id} failed: {exc}")
        return {"ok": False, "error": str(exc)}


# ── WooCommerce — real WordPress Posts API push ──────────────────────────────

async def _push_to_woocommerce(shop_id: int, post: BlogPost, db: Session) -> dict:
    """Pushes a published post to the seller's connected WooCommerce site
    as a real WordPress post via wp/v2/posts — WordPress IS a blog engine
    natively (no separate "articles" concept to build against, unlike
    Shopify). Uses a WordPress Application Password, NOT the WooCommerce
    Consumer Key/Secret used for product/order sync elsewhere — those are
    two separate auth scopes in WordPress (wc/v3 vs wp/v2), confirmed
    against WordPress's own core REST API docs. Best-effort: failures are
    reported back, not raised, same as _push_to_shopify above."""
    from app.models.channel import ChannelConnection
    from app.api.v1.endpoints.woocommerce import _get_woo_creds

    conn = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.channel_type == "woocommerce",
        ChannelConnection.is_active == True,
    ).first()
    if not conn or not conn.channel_api_key or not conn.channel_api_url:
        return {"ok": False, "error": "WooCommerce is not connected."}

    creds = _get_woo_creds(conn)
    wp_username = creds.get("wp_username")
    wp_app_password = creds.get("wp_app_password")
    if not wp_username or not wp_app_password:
        return {"ok": False, "error": "Blog publishing needs a WordPress Application Password — add one on the WooCommerce connection page (this is separate from the Consumer Key/Secret used for product sync)."}

    site_url = conn.channel_api_url.rstrip("/")
    auth = (wp_username, wp_app_password)

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            featured_media_id = None
            if post.cover_image_url:
                img_resp = await client.get(post.cover_image_url)
                if img_resp.status_code < 300:
                    filename = post.cover_image_url.rsplit("/", 1)[-1] or "cover.jpg"
                    media_resp = await client.post(
                        f"{site_url}/wp-json/wp/v2/media",
                        auth=auth,
                        content=img_resp.content,
                        headers={
                            "Content-Disposition": f'attachment; filename="{filename}"',
                            "Content-Type": img_resp.headers.get("content-type", "image/jpeg"),
                        },
                    )
                    if media_resp.status_code < 300:
                        featured_media_id = media_resp.json().get("id")

            body = {
                "title": post.title,
                "content": post.content or "",
                "excerpt": post.excerpt or "",
                "status": "publish",
            }
            if featured_media_id:
                body["featured_media"] = featured_media_id

            if post.woocommerce_post_id:
                r = await client.post(f"{site_url}/wp-json/wp/v2/posts/{post.woocommerce_post_id}", auth=auth, json=body)
            else:
                r = await client.post(f"{site_url}/wp-json/wp/v2/posts", auth=auth, json=body)

            if r.status_code >= 300:
                return {"ok": False, "error": f"WordPress rejected the post: {r.text[:300]}"}

            wp_post = r.json()
            post.woocommerce_post_id = str(wp_post["id"])
            db.commit()
            return {"ok": True, "post_id": str(wp_post["id"])}
    except Exception as exc:
        logger.error(f"[BLOG->WOOCOMMERCE] shop={shop_id} post={post.id} failed: {exc}")
        return {"ok": False, "error": str(exc)}


# ── Public — Custom Website API ───────────────────────────────────────────────

@router.get("/public/store/{shop_slug}/blog")
def public_blog_list(shop_slug: str, tag: Optional[str] = None, db: Session = Depends(get_db)):
    """No-auth — a custom storefront's blog listing reads this directly,
    same pattern as public_store_products."""
    shop = db.query(Shop).filter(Shop.slug == shop_slug, Shop.is_active == True).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Store not found")

    q = db.query(BlogPost).filter(BlogPost.shop_id == shop.id, BlogPost.status == "published")
    posts = q.order_by(BlogPost.published_at.desc()).all()
    if tag:
        posts = [p for p in posts if p.tags and tag.lower() in [t.strip().lower() for t in p.tags.split(",")]]

    # List view intentionally omits the full `content` body — same
    # reasoning as products' list vs detail split (public.py), so a
    # listing page isn't shipping every article's full HTML at once.
    return [
        {k: v for k, v in _post_out(p).items() if k != "content"}
        for p in posts
    ]


@router.get("/public/store/{shop_slug}/blog/{slug}")
def public_blog_detail(shop_slug: str, slug: str, db: Session = Depends(get_db)):
    shop = db.query(Shop).filter(Shop.slug == shop_slug, Shop.is_active == True).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Store not found")

    post = db.query(BlogPost).filter(
        BlogPost.shop_id == shop.id, BlogPost.slug == slug, BlogPost.status == "published",
    ).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    post.view_count = (post.view_count or 0) + 1
    db.commit()
    return _post_out(post)
