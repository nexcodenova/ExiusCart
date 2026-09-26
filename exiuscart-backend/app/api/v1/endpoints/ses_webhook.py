"""Amazon SES delivery reports, received through an SNS topic.

Amazon posts a JSON message here for every email event (delivered, bounced,
complaint...). Nothing here is trusted until the message's signature has been
checked against Amazon's certificate, so nobody else can post fake bounces (which
would suppress real customers) or fake "delivered" reports.

Setup on the AWS side (done once, see the admin Email Monitor page):
  SES configuration set -> event destination (SNS topic) -> HTTPS subscription
  to https://<api-host>/api/v1/webhooks/ses.
"""
import base64
import json
import logging
import re
from urllib.parse import urlparse

import httpx
from cryptography import x509
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.email_domains import SES_SNS_TOPIC_ARN, apply_ses_event

logger = logging.getLogger(__name__)
router = APIRouter()

_SNS_HOST = re.compile(r"^sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?$")
_cert_cache: dict = {}

_NOTIFICATION_KEYS = ("Message", "MessageId", "Subject", "Timestamp", "TopicArn", "Type")
_CONFIRM_KEYS = ("Message", "MessageId", "SubscribeURL", "Timestamp", "Token", "TopicArn", "Type")


def _amazon_url(url: str) -> bool:
    u = urlparse(url or "")
    return u.scheme == "https" and bool(u.hostname) and bool(_SNS_HOST.match(u.hostname))


def _fetch_cert(url: str):
    """Amazon's signing certificate. Only https://sns.<region>.amazonaws.com URLs are fetched."""
    if url in _cert_cache:
        return _cert_cache[url]
    if not _amazon_url(url) or not url.lower().endswith(".pem"):
        raise ValueError("bad certificate URL")
    pem = httpx.get(url, timeout=10).content
    cert = x509.load_pem_x509_certificate(pem)
    _cert_cache[url] = cert
    return cert


def string_to_sign(msg: dict) -> bytes:
    keys = _NOTIFICATION_KEYS if msg.get("Type") == "Notification" else _CONFIRM_KEYS
    return "".join(f"{k}\n{msg[k]}\n" for k in keys if k in msg).encode("utf-8")


def verify_signature(msg: dict) -> bool:
    url = msg.get("SigningCertURL", "")
    if not _amazon_url(url) or not url.lower().endswith(".pem"):
        logger.warning("[SES webhook] refused: signing certificate is not on an Amazon SNS host")
        return False
    try:
        cert = _fetch_cert(url)
        digest = hashes.SHA256() if str(msg.get("SignatureVersion")) == "2" else hashes.SHA1()
        cert.public_key().verify(base64.b64decode(msg["Signature"]), string_to_sign(msg), padding.PKCS1v15(), digest)
        return True
    except (InvalidSignature, KeyError, ValueError, Exception) as e:  # noqa: B014 - any failure means "not verified"
        logger.warning(f"[SES webhook] signature check failed: {type(e).__name__}")
        return False


@router.post("/webhooks/ses")
async def ses_webhook(request: Request, db: Session = Depends(get_db)):
    try:
        msg = json.loads((await request.body()).decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Not a JSON message")
    if not isinstance(msg, dict) or "Type" not in msg:
        raise HTTPException(status_code=400, detail="Not an SNS message")
    if not verify_signature(msg):
        raise HTTPException(status_code=403, detail="Signature could not be verified")
    if SES_SNS_TOPIC_ARN and msg.get("TopicArn") != SES_SNS_TOPIC_ARN:
        raise HTTPException(status_code=403, detail="Unexpected topic")

    kind = msg["Type"]
    if kind == "SubscriptionConfirmation":
        url = msg.get("SubscribeURL", "")
        if not _amazon_url(url):
            raise HTTPException(status_code=400, detail="Bad SubscribeURL")
        try:
            httpx.get(url, timeout=10)
        except Exception as e:
            logger.error(f"[SES webhook] could not confirm subscription: {e}")
            raise HTTPException(status_code=502, detail="Could not confirm the subscription")
        logger.info("[SES webhook] SNS subscription confirmed")
        return {"ok": True, "confirmed": True}

    if kind == "Notification":
        try:
            inner = json.loads(msg.get("Message", "{}"))
        except Exception:
            return {"ok": True, "ignored": True}
        touched = apply_ses_event(db, inner) if isinstance(inner, dict) else 0
        return {"ok": True, "updated": touched}

    return {"ok": True, "ignored": True}
