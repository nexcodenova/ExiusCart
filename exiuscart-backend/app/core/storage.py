"""
Cloudflare R2 image storage (S3-compatible via boto3).
Required env vars: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
                   R2_BUCKET_NAME, R2_PUBLIC_URL
"""
import os
import uuid
import logging

logger = logging.getLogger(__name__)

_R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID", "")
_R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID", "")
_R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY", "")
_R2_BUCKET = os.getenv("R2_BUCKET_NAME", "exiuscart-image")
_R2_PUBLIC_URL = os.getenv("R2_PUBLIC_URL", "").rstrip("/")


def _get_r2_client():
    try:
        import boto3
    except ImportError:
        raise RuntimeError("boto3 not installed — run: pip install boto3")
    endpoint = f"https://{_R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=_R2_ACCESS_KEY_ID,
        aws_secret_access_key=_R2_SECRET_ACCESS_KEY,
        region_name="auto",
    )


def upload_image(contents: bytes, shop_id: int, product_id: int, ext: str, content_type: str = "image/jpeg") -> str:
    """Upload image to Cloudflare R2 and return the public CDN URL."""
    if not _R2_ACCOUNT_ID or not _R2_ACCESS_KEY_ID or not _R2_SECRET_ACCESS_KEY:
        raise RuntimeError(
            "R2 credentials not configured. "
            "Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL in .env"
        )

    filename = f"{uuid.uuid4()}.{ext}"
    key = f"products/{shop_id}/{product_id}/{filename}"

    client = _get_r2_client()
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


def upload_shop_image(contents: bytes, shop_id: int, image_type: str, ext: str, content_type: str = "image/jpeg") -> str:
    """Upload a shop profile image (logo/banner) to R2 and return the public CDN URL."""
    if not _R2_ACCOUNT_ID or not _R2_ACCESS_KEY_ID or not _R2_SECRET_ACCESS_KEY:
        raise RuntimeError("R2 credentials not configured.")

    filename = f"{uuid.uuid4()}.{ext}"
    key = f"shops/{shop_id}/{image_type}/{filename}"

    client = _get_r2_client()
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


def generate_presigned_url(shop_id: int, product_id: int, ext: str, content_type: str = "image/jpeg", expires: int = 300) -> dict:
    """Return a presigned PUT URL so the browser can upload directly to R2."""
    filename = f"{uuid.uuid4()}.{ext}"
    key = f"products/{shop_id}/{product_id}/{filename}"
    client = _get_r2_client()
    presigned_url = client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": _R2_BUCKET,
            "Key": key,
            "ContentType": content_type,
            "CacheControl": "public, max-age=31536000",
        },
        ExpiresIn=expires,
    )
    public_url = f"{_R2_PUBLIC_URL}/{key}" if _R2_PUBLIC_URL else f"https://{_R2_BUCKET}.r2.dev/{key}"
    return {"presigned_url": presigned_url, "public_url": public_url}


def generate_marketing_presigned_url(shop_id: int, ext: str, content_type: str = "image/jpeg", expires: int = 300) -> dict:
    """Presigned PUT URL for a marketing email image — not tied to any
    product, unlike generate_presigned_url."""
    filename = f"{uuid.uuid4()}.{ext}"
    key = f"marketing/{shop_id}/{filename}"
    client = _get_r2_client()
    presigned_url = client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": _R2_BUCKET,
            "Key": key,
            "ContentType": content_type,
            "CacheControl": "public, max-age=31536000",
        },
        ExpiresIn=expires,
    )
    public_url = f"{_R2_PUBLIC_URL}/{key}" if _R2_PUBLIC_URL else f"https://{_R2_BUCKET}.r2.dev/{key}"
    return {"presigned_url": presigned_url, "public_url": public_url}


def delete_image(url: str) -> None:
    """Delete image from Cloudflare R2 by its public URL."""
    if not url or not _R2_ACCOUNT_ID:
        return

    if _R2_PUBLIC_URL and url.startswith(_R2_PUBLIC_URL):
        key = url[len(_R2_PUBLIC_URL):].lstrip("/")
    elif ".r2.dev/" in url:
        key = url.split(".r2.dev/", 1)[-1]
    else:
        logger.warning(f"[R2 DELETE] Unrecognised URL format, skipping: {url}")
        return

    try:
        _get_r2_client().delete_object(Bucket=_R2_BUCKET, Key=key)
        logger.info(f"[R2 DELETE] {key}")
    except Exception as exc:
        logger.error(f"[R2 DELETE FAILED] {exc}")
