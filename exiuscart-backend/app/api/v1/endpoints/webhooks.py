"""
Webhook management — shop owners register URL endpoints to receive
real-time POST notifications for events like order.created, order.paid, etc.
"""
import json
import hmac
import hashlib
import httpx
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel, HttpUrl

from app.core.database import get_db
from app.models.user import User
from app.models.shop import Shop
from app.models.webhook import Webhook, WebhookLog
from app.api.v1.deps import get_current_user

router = APIRouter()

SUPPORTED_EVENTS = [
    "order.created",
    "order.paid",
    "order.completed",
    "order.cancelled",
    "subscription.approved",
    "product.low_stock",
]


# ── Schemas ────────────────────────────────────────────────────────────────────

class WebhookCreate(BaseModel):
    url: str
    secret: Optional[str] = None
    events: list[str]


class WebhookUpdate(BaseModel):
    url: Optional[str] = None
    secret: Optional[str] = None
    events: Optional[list[str]] = None
    is_active: Optional[bool] = None


def _wh_out(wh: Webhook) -> dict:
    return {
        "id": wh.id,
        "url": wh.url,
        "events": wh.events.split(",") if wh.events else [],
        "is_active": wh.is_active,
        "created_at": wh.created_at.isoformat(),
    }


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/shops/{shop_id}/webhooks")
def list_webhooks(
    shop_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    webhooks = db.query(Webhook).filter(Webhook.shop_id == shop_id).all()
    return [_wh_out(wh) for wh in webhooks]


@router.post("/shops/{shop_id}/webhooks", status_code=201)
def create_webhook(
    shop_id: int,
    data: WebhookCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    invalid = [e for e in data.events if e not in SUPPORTED_EVENTS]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Unsupported events: {invalid}")

    wh = Webhook(
        shop_id=shop_id,
        url=str(data.url),
        secret=data.secret or None,
        events=",".join(data.events),
    )
    db.add(wh)
    db.commit()
    db.refresh(wh)
    return _wh_out(wh)


@router.put("/shops/{shop_id}/webhooks/{webhook_id}")
def update_webhook(
    shop_id: int,
    webhook_id: int,
    data: WebhookUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    wh = db.query(Webhook).filter(Webhook.id == webhook_id, Webhook.shop_id == shop_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Webhook not found")

    if data.url is not None:
        wh.url = str(data.url)
    if data.secret is not None:
        wh.secret = data.secret
    if data.events is not None:
        invalid = [e for e in data.events if e not in SUPPORTED_EVENTS]
        if invalid:
            raise HTTPException(status_code=400, detail=f"Unsupported events: {invalid}")
        wh.events = ",".join(data.events)
    if data.is_active is not None:
        wh.is_active = data.is_active

    db.commit()
    return _wh_out(wh)


@router.delete("/shops/{shop_id}/webhooks/{webhook_id}", status_code=204)
def delete_webhook(
    shop_id: int,
    webhook_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    wh = db.query(Webhook).filter(Webhook.id == webhook_id, Webhook.shop_id == shop_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Webhook not found")
    db.delete(wh)
    db.commit()


@router.post("/shops/{shop_id}/webhooks/{webhook_id}/test", status_code=200)
async def test_webhook(
    shop_id: int,
    webhook_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    wh = db.query(Webhook).filter(Webhook.id == webhook_id, Webhook.shop_id == shop_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Webhook not found")

    background_tasks.add_task(_fire_webhook, wh, "webhook.test", {"shop_id": shop_id, "message": "Test event from ExiusCart"}, db)
    return {"message": "Test event sent"}


@router.get("/shops/{shop_id}/webhooks/{webhook_id}/logs")
def get_webhook_logs(
    shop_id: int,
    webhook_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == current_user.id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    logs = (
        db.query(WebhookLog)
        .filter(WebhookLog.webhook_id == webhook_id)
        .order_by(WebhookLog.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": log.id,
            "event": log.event,
            "response_status": log.response_status,
            "success": log.success,
            "created_at": log.created_at.isoformat(),
        }
        for log in logs
    ]


# ── Internal dispatcher ────────────────────────────────────────────────────────

async def _fire_webhook(wh: Webhook, event: str, payload: dict, db: Session):
    """Fire a single webhook asynchronously and log the result."""
    body = json.dumps({"event": event, "data": payload})
    headers = {"Content-Type": "application/json", "X-ExiusCart-Event": event}

    if wh.secret:
        sig = hmac.new(wh.secret.encode(), body.encode(), hashlib.sha256).hexdigest()
        headers["X-ExiusCart-Signature"] = f"sha256={sig}"

    status_code = None
    response_body = None
    success = False
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(wh.url, content=body, headers=headers)
            status_code = resp.status_code
            response_body = resp.text[:500]
            success = resp.status_code < 400
    except Exception as exc:
        response_body = str(exc)[:500]

    log = WebhookLog(
        webhook_id=wh.id,
        event=event,
        payload=body[:1000],
        response_status=status_code,
        response_body=response_body,
        success=success,
    )
    db.add(log)
    db.commit()


async def dispatch_event(shop_id: int, event: str, payload: dict, db: Session):
    """Called from order/subscription endpoints to fire matching webhooks."""
    webhooks = db.query(Webhook).filter(
        Webhook.shop_id == shop_id,
        Webhook.is_active == True,
    ).all()
    for wh in webhooks:
        registered = wh.events.split(",") if wh.events else []
        if event in registered:
            import asyncio
            asyncio.create_task(_fire_webhook(wh, event, payload, db))
