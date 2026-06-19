"""
Cloudflare R2 storage utility (S3-compatible via boto3).
Set R2_ENABLED=true + R2_ACCOUNT_ID + R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY
+ R2_BUCKET_NAME + R2_PUBLIC_URL to enable CDN storage.
Without those, files are saved to local disk (dev/fallback mode).
"""
import os
import uuid
import logging
from typing import Optional

logger = logging.getLogger(__name__)

_R2_ENABLED = os.getenv("R2_ENABLED", "false").lower() == "true"
_R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID", "")
_R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID", "")
_R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY", "")
_R2_BUCKET = os.getenv("R2_BUCKET_NAME", "exiuscart-images")
_R2_PUBLIC_URL = os.getenv("R2_PUBLIC_URL", "").rstrip("/")

_LOCAL_UPLOAD_DIR = "uploads/products"
_LOCAL_STATIC_PREFIX = "/static/products"
_API_BASE_URL = os.getenv("API_BASE_URL", "https://api.exiuscart.com")


def _get_r2_client():
    try:
        import boto3
        endpoint = f"https://{_R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
        return boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=_R2_ACCESS_KEY_ID,
            aws_secret_access_key=_R2_SECRET_ACCESS_KEY,
            region_name="auto",
        )
    except ImportError:
        logger.warning("boto3 not installed — cannot use R2 storage")
        return None


def upload_image(contents: bytes, shop_id: int, product_id: int, ext: str, content_type: str = "image/jpeg") -> str:
    """
    Upload image bytes and return the public URL.
    Uses R2 if R2_ENABLED=true, otherwise saves to local disk.
    """
    filename = f"{uuid.uuid4()}.{ext}"
    key = f"products/{shop_id}/{product_id}/{filename}"

    if _R2_ENABLED:
        client = _get_r2_client()
        if client:
            try:
                client.put_object(
                    Bucket=_R2_BUCKET,
                    Key=key,
                    Body=contents,
                    ContentType=content_type,
                    CacheControl="public, max-age=31536000",
                )
                url = f"{_R2_PUBLIC_URL}/{key}" if _R2_PUBLIC_URL else f"https://{_R2_BUCKET}.r2.dev/{key}"
                logger.info(f"[R2 UPLOAD] {url}")
                return url
            except Exception as exc:
                logger.error(f"[R2 UPLOAD FAILED] {exc} — falling back to local disk")

    # Local disk fallback
    dirpath = f"{_LOCAL_UPLOAD_DIR}/{shop_id}/{product_id}"
    os.makedirs(dirpath, exist_ok=True)
    filepath = f"{dirpath}/{filename}"
    with open(filepath, "wb") as f:
        f.write(contents)

    url = f"{_API_BASE_URL}{_LOCAL_STATIC_PREFIX}/{shop_id}/{product_id}/{filename}"
    logger.info(f"[LOCAL UPLOAD] {url}")
    return url


def delete_image(url: str) -> None:
    """
    Delete image by URL. Handles both R2 URLs and local static paths.
    """
    if not url:
        return

    # R2 URL
    if _R2_ENABLED and _R2_PUBLIC_URL and url.startswith(_R2_PUBLIC_URL):
        key = url[len(_R2_PUBLIC_URL):].lstrip("/")
        client = _get_r2_client()
        if client:
            try:
                client.delete_object(Bucket=_R2_BUCKET, Key=key)
                logger.info(f"[R2 DELETE] {key}")
                return
            except Exception as exc:
                logger.error(f"[R2 DELETE FAILED] {exc}")
        return

    # R2 public bucket URL (r2.dev)
    if _R2_ENABLED and ".r2.dev/" in url:
        key = url.split(".r2.dev/", 1)[-1]
        client = _get_r2_client()
        if client:
            try:
                client.delete_object(Bucket=_R2_BUCKET, Key=key)
                logger.info(f"[R2 DELETE] {key}")
                return
            except Exception as exc:
                logger.error(f"[R2 DELETE FAILED] {exc}")
        return

    # Local disk
    if url.startswith(_LOCAL_STATIC_PREFIX):
        filepath = "uploads" + url[len("/static"):]
        if os.path.exists(filepath):
            os.remove(filepath)
            logger.info(f"[LOCAL DELETE] {filepath}")
