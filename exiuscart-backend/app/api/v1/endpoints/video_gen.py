"""
AI product ad video generation — Higgsfield (docs.higgsfield.ai).

Built from Higgsfield's real, documented OpenAPI spec: base URL, auth header
shape, the image-to-video endpoint list, and the async
submit -> {request_id, status_url} -> poll shape are all confirmed. The one
UNVERIFIED piece is the exact field names inside a completed RequestStatus
response (their own docs excerpt truncated before showing that schema) — so
_extract_video_url below tries every plausible key rather than assuming one,
same discipline as Zendrop/HyperSKU's response parsing before those were
confirmed live. Needs checking against a real generated video before fully
trusting it.

BYOK, not a platform-wide key — each shop connects its OWN Higgsfield
account (HiggsfieldConnection, encrypted). Switched from a shared
HIGGSFIELD_API_KEY_ID/SECRET env var after checking Higgsfield's real
pricing: Veo 3.1 runs ~$1.90-$4.40/video even on their cheapest plan, so
ExiusCart paying centrally and reselling at any reasonable flat fee risks
losing money on any seller who generates more than a handful a month.
Same shape as HyperSKU's connection — sign up for a plan (via ExiusCart's
Higgsfield affiliate link, 25% commission for 12 months per referral),
paste the key, ExiusCart never touches the underlying API cost.

Credentials are stored without a live verification call on connect —
unlike CJ/HyperSKU, Higgsfield doesn't document a cheap "check this key"
endpoint to verify against, so a bad key surfaces on the first real
generation attempt instead (with a clear error), same honest gap as
printify/gelato/1688's own unverified connect in dropshipping.py.

When a seller doesn't type their own prompt, this asks Claude (already the
AI vendor this codebase uses — see ai_seo.py's own ANTHROPIC_API_KEY usage,
no new vendor added here) to actually look at the product photo and write
one, instead of filling in a generic template — a photo of shoes gets a
prompt about shoes, not the same one-size-fits-all sentence every product
got before. Falls back to the old generic template if ANTHROPIC_API_KEY
isn't set, so this stays optional rather than a new hard dependency.
"""

import os
import base64
import logging
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.encryption import encrypt, decrypt
from app.models.user import User
from app.models.subscription import Subscription
from app.models.product_ad_video import ProductAdVideo
from app.models.higgsfield_connection import HiggsfieldConnection
from app.api.v1.deps import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

HIGGSFIELD_BASE = "https://api.higgsfield.ai"
# Apply for this once you have a track record: https://higgsfield.ai/affiliate
# (up to 25% commission for 12 months, no waiting period) — swap in the real
# tracked link once issued.
HIGGSFIELD_SIGNUP_LINK = "https://higgsfield.ai/"

CLAUDE_MODEL = "claude-haiku-4-5-20251001"  # same fast/cheap model ai_seo.py uses


def _generate_prompt_with_ai(image_bytes: bytes, media_type: str, product_name: str) -> Optional[str]:
    """Ask Claude to look at the actual product photo and write a Higgsfield
    video prompt for it. Returns None (caller falls back to the generic
    template) if ANTHROPIC_API_KEY isn't set or the call fails — this is a
    quality upgrade, not something that should block video generation."""
    key = os.getenv("ANTHROPIC_API_KEY", "")
    if not key:
        return None
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=key)
        b64 = base64.b64encode(image_bytes).decode("ascii")
        message = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=200,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
                    {"type": "text", "text": (
                        f"This is a product photo for \"{product_name}\", about to be turned into a short "
                        "advertising video by an AI video generator. Write ONE vivid, concrete prompt "
                        "(2-3 sentences max) describing camera movement, lighting, and mood that would make "
                        "the best possible ad for this specific product — base it on what's actually visible "
                        "in the photo (the product's shape, color, material, category), not a generic template. "
                        "Reply with ONLY the prompt text, nothing else — no preamble, no quotes."
                    )},
                ],
            }],
        )
        text = message.content[0].text.strip()
        return text or None
    except Exception as e:
        logger.error(f"[Higgsfield] AI prompt generation failed, falling back to template: {e}")
        return None

# Image-to-video only — sellers already have a product photo, this is about
# turning that into motion, not generating one from a text prompt alone.
# Veo3.1 is the default (Google's model, generally the highest quality of
# the three families Higgsfield offers); Seedance Lite is offered as a
# cheaper/faster alternative. Both take the same {prompt, image_url,
# duration, resolution, aspect_ratio} shape, confirmed from the OpenAPI spec.
ALLOWED_MODELS = {
    "veo3.1/image-to-video": "/veo3.1/image-to-video",
    "veo3.1/fast/image-to-video": "/veo3.1/fast/image-to-video",
    "bytedance/seedance-lite/image-to-video": "/bytedance/seedance/v1/lite/image-to-video",
}
DEFAULT_MODEL = "veo3.1/image-to-video"


def _shop_or_404(shop_id: int, user: User, db: Session):
    from app.models.shop import Shop
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


def _get_plan(shop_id: int, db: Session) -> str:
    sub = db.query(Subscription).filter(Subscription.shop_id == shop_id).order_by(Subscription.id.desc()).first()
    return sub.plan_type if sub else "free_trial"


def _higgsfield_headers(key_id: str, key_secret: str) -> dict:
    return {
        "Authorization": f"Key {key_id}:{key_secret}",
        "Content-Type": "application/json",
    }


def _get_higgsfield_creds(shop_id: int, db: Session) -> tuple[str, str]:
    conn = db.query(HiggsfieldConnection).filter(
        HiggsfieldConnection.shop_id == shop_id, HiggsfieldConnection.is_active == True,
    ).first()
    if not conn:
        raise HTTPException(status_code=400, detail={
            "error": "higgsfield_not_connected",
            "message": "Connect your own Higgsfield account first — AI video generation runs on your own Higgsfield plan, not ExiusCart's.",
        })
    return decrypt(conn.api_key_id_enc), decrypt(conn.api_key_secret_enc)


class HiggsfieldConnectIn(BaseModel):
    api_key_id: str
    api_key_secret: str


@router.get("/shops/{shop_id}/ai/higgsfield/status")
def higgsfield_status(shop_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _shop_or_404(shop_id, current_user, db)
    conn = db.query(HiggsfieldConnection).filter(
        HiggsfieldConnection.shop_id == shop_id, HiggsfieldConnection.is_active == True,
    ).first()
    return {"connected": conn is not None, "signup_url": HIGGSFIELD_SIGNUP_LINK}


@router.post("/shops/{shop_id}/ai/higgsfield/connect")
def connect_higgsfield(
    shop_id: int, body: HiggsfieldConnectIn,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    if not body.api_key_id.strip() or not body.api_key_secret.strip():
        raise HTTPException(status_code=422, detail="Both the Key ID and Key Secret are required.")

    existing = db.query(HiggsfieldConnection).filter(HiggsfieldConnection.shop_id == shop_id).first()
    if existing:
        existing.api_key_id_enc = encrypt(body.api_key_id.strip())
        existing.api_key_secret_enc = encrypt(body.api_key_secret.strip())
        existing.is_active = True
    else:
        db.add(HiggsfieldConnection(
            shop_id=shop_id,
            api_key_id_enc=encrypt(body.api_key_id.strip()),
            api_key_secret_enc=encrypt(body.api_key_secret.strip()),
        ))
    db.commit()
    return {"connected": True}


@router.delete("/shops/{shop_id}/ai/higgsfield/connect")
def disconnect_higgsfield(shop_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _shop_or_404(shop_id, current_user, db)
    conn = db.query(HiggsfieldConnection).filter(HiggsfieldConnection.shop_id == shop_id).first()
    if conn:
        conn.is_active = False
        db.commit()
    return {"connected": False}


def _extract_video_url(data: dict) -> Optional[str]:
    """Best-effort field mapping for the completed-job response — Higgsfield's
    own docs didn't show us the full RequestStatus schema. Tries every
    plausible shape. Confirm against a real completed job."""
    output = data.get("output") or data.get("result") or data
    if isinstance(output, str):
        return output
    if isinstance(output, dict):
        for key in ("video_url", "url", "video"):
            if isinstance(output.get(key), str):
                return output[key]
        assets = output.get("assets") or output.get("outputs")
        if isinstance(assets, list) and assets:
            first = assets[0]
            if isinstance(first, str):
                return first
            if isinstance(first, dict):
                return first.get("url") or first.get("video_url")
    return None


class GenerateVideoIn(BaseModel):
    prompt: Optional[str] = None
    model: str = DEFAULT_MODEL
    image_url: Optional[str] = None  # defaults to the product's primary image
    duration: str = "6"
    aspect_ratio: str = "9:16"  # vertical by default — this is for social ads (Reels/TikTok/Stories), not landscape


@router.post("/shops/{shop_id}/products/{product_id}/videos/generate")
async def generate_product_video(
    shop_id: int,
    product_id: int,
    body: GenerateVideoIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.product import Product
    from app.models.product_fields import ProductImage

    _shop_or_404(shop_id, current_user, db)
    key_id, key_secret = _get_higgsfield_creds(shop_id, db)

    plan = _get_plan(shop_id, db)
    if plan != "premium":
        raise HTTPException(status_code=403, detail={
            "error": "upgrade_required",
            "message": "AI product video generation is a Premium feature.",
        })

    if body.model not in ALLOWED_MODELS:
        raise HTTPException(status_code=400, detail=f"Unknown model. Choose one of: {', '.join(ALLOWED_MODELS)}")

    product = db.query(Product).filter(Product.id == product_id, Product.shop_id == shop_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")

    image_url = body.image_url
    if not image_url:
        primary = db.query(ProductImage).filter(
            ProductImage.product_id == product_id
        ).order_by(ProductImage.is_primary.desc(), ProductImage.sort_order.asc()).first()
        if not primary:
            raise HTTPException(status_code=400, detail="This product has no image to generate a video from. Add one first.")
        image_url = primary.url

    prompt = body.prompt
    if not prompt:
        # Try asking Claude to actually look at the photo first — falls back
        # to the old generic template if AI isn't configured or the call fails.
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                img_resp = await client.get(image_url)
                img_resp.raise_for_status()
            media_type = img_resp.headers.get("content-type", "image/jpeg").split(";")[0]
            if not media_type.startswith("image/"):
                media_type = "image/jpeg"
            prompt = _generate_prompt_with_ai(img_resp.content, media_type, product.name)
        except Exception as e:
            logger.warning(f"[Higgsfield] Could not fetch product image for AI prompt generation: {e}")
        if not prompt:
            prompt = f"Cinematic product showcase of {product.name}, smooth camera motion, professional advertising lighting, appealing to online shoppers"

    payload = {
        "prompt": prompt,
        "image_url": image_url,
        "duration": body.duration,
        "aspect_ratio": body.aspect_ratio,
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(f"{HIGGSFIELD_BASE}{ALLOWED_MODELS[body.model]}", json=payload, headers=_higgsfield_headers(key_id, key_secret))
        data = r.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Higgsfield API error: {str(e)}")

    request_id = data.get("request_id")
    if not request_id:
        logger.error(f"[Higgsfield] shop={shop_id} product={product_id} submit failed: {data}")
        raise HTTPException(status_code=502, detail=data.get("message") or data.get("error") or "Higgsfield rejected this request.")

    video = ProductAdVideo(
        shop_id=shop_id,
        product_id=product_id,
        status="queued",
        model=body.model,
        prompt=prompt,
        source_image_url=image_url,
        request_id=request_id,
    )
    db.add(video)
    db.commit()
    db.refresh(video)
    logger.info(f"[Higgsfield] shop={shop_id} product={product_id} video={video.id} submitted request_id={request_id}")

    return {"video_id": video.id, "status": video.status, "request_id": request_id}


@router.get("/shops/{shop_id}/products/{product_id}/videos")
def list_product_videos(
    shop_id: int,
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    videos = db.query(ProductAdVideo).filter(
        ProductAdVideo.shop_id == shop_id,
        ProductAdVideo.product_id == product_id,
    ).order_by(ProductAdVideo.created_at.desc()).all()
    return {"videos": [
        {
            "id": v.id, "status": v.status, "model": v.model, "prompt": v.prompt,
            "video_url": v.video_url, "error_message": v.error_message,
            "created_at": v.created_at.isoformat() if v.created_at else None,
        }
        for v in videos
    ]}


@router.get("/shops/{shop_id}/videos/{video_id}/status")
async def check_video_status(
    shop_id: int,
    video_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """On-demand refresh — the poller (sync_pending_videos_job) covers this
    too, but a seller sitting on the page waiting shouldn't have to wait for
    the next scheduled sweep."""
    _shop_or_404(shop_id, current_user, db)
    video = db.query(ProductAdVideo).filter(ProductAdVideo.id == video_id, ProductAdVideo.shop_id == shop_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found.")

    if video.status in ("ready", "failed") or not video.request_id:
        return {"id": video.id, "status": video.status, "video_url": video.video_url, "error_message": video.error_message}

    key_id, key_secret = _get_higgsfield_creds(shop_id, db)
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(f"{HIGGSFIELD_BASE}/requests/{video.request_id}/status", headers=_higgsfield_headers(key_id, key_secret))
        data = r.json()
    except Exception as e:
        return {"id": video.id, "status": video.status, "video_url": video.video_url, "error_message": None, "poll_error": str(e)}

    status = (data.get("status") or "").lower()
    if status in ("completed", "success", "succeeded"):
        remote_url = _extract_video_url(data)
        if remote_url:
            try:
                async with httpx.AsyncClient(timeout=60) as client:
                    resp = await client.get(remote_url)
                    resp.raise_for_status()
                from app.core.storage import upload_product_video
                video.video_url = upload_product_video(resp.content, shop_id, video.product_id)
                video.status = "ready"
                video.completed_at = datetime.now(timezone.utc)
            except Exception as e:
                video.status = "failed"
                video.error_message = f"Video generated but re-hosting failed: {str(e)}"
        else:
            video.status = "failed"
            video.error_message = "Higgsfield marked this complete but no video URL was found in the response — needs checking against a real job."
        db.commit()
    elif status in ("failed", "error", "canceled", "cancelled"):
        video.status = "failed"
        video.error_message = data.get("message") or data.get("error") or "Higgsfield reported this generation failed."
        db.commit()
    elif status:
        video.status = "processing"
        db.commit()

    return {"id": video.id, "status": video.status, "video_url": video.video_url, "error_message": video.error_message}


def sync_pending_videos_job(db_session_factory) -> None:
    """Poll Higgsfield for any queued/processing video generation jobs.
    Called every few minutes by the background scheduler in main.py — videos
    typically finish in under a minute per Higgsfield's own docs, but this
    catches anything a seller didn't sit on the page waiting for. Each shop
    has its own connection (BYOK) — cached per shop_id so a shop with several
    pending videos doesn't decrypt its credentials once per video."""
    db = db_session_factory()
    try:
        pending = db.query(ProductAdVideo).filter(
            ProductAdVideo.status.in_(["queued", "processing"]),
            ProductAdVideo.request_id.isnot(None),
        ).all()
        if not pending:
            return

        logger.info(f"[Higgsfield Poll] Checking {len(pending)} pending videos")
        creds_by_shop: dict = {}

        for video in pending:
            if video.shop_id not in creds_by_shop:
                conn = db.query(HiggsfieldConnection).filter(
                    HiggsfieldConnection.shop_id == video.shop_id, HiggsfieldConnection.is_active == True,
                ).first()
                creds_by_shop[video.shop_id] = (decrypt(conn.api_key_id_enc), decrypt(conn.api_key_secret_enc)) if conn else None
            creds = creds_by_shop[video.shop_id]
            if not creds:
                continue  # disconnected since the video was submitted — nothing to poll with

            try:
                with httpx.Client(timeout=20) as client:
                    r = client.get(f"{HIGGSFIELD_BASE}/requests/{video.request_id}/status", headers=_higgsfield_headers(*creds))
                data = r.json()
            except Exception as e:
                logger.error(f"[Higgsfield Poll] video={video.id} request failed: {e}")
                continue

            status = (data.get("status") or "").lower()
            if status in ("completed", "success", "succeeded"):
                remote_url = _extract_video_url(data)
                if remote_url:
                    try:
                        with httpx.Client(timeout=60) as client:
                            resp = client.get(remote_url)
                            resp.raise_for_status()
                        from app.core.storage import upload_product_video
                        video.video_url = upload_product_video(resp.content, video.shop_id, video.product_id)
                        video.status = "ready"
                        video.completed_at = datetime.now(timezone.utc)
                    except Exception as e:
                        video.status = "failed"
                        video.error_message = f"Video generated but re-hosting failed: {str(e)}"
                else:
                    video.status = "failed"
                    video.error_message = "Higgsfield marked this complete but no video URL was found in the response."
                db.commit()
                logger.info(f"[Higgsfield Poll] video={video.id} -> {video.status}")
            elif status in ("failed", "error", "canceled", "cancelled"):
                video.status = "failed"
                video.error_message = data.get("message") or data.get("error") or "Higgsfield reported this generation failed."
                db.commit()
            elif status:
                video.status = "processing"
                db.commit()

    except Exception as e:
        logger.error(f"[Higgsfield Poll] Job error: {e}")
    finally:
        db.close()
