"""Platform-wide audit trail - every signup, login, and staff/admin action.
One write path (`record_audit_event`) so every call site logs the same
shape consistently, same discipline as every other "_x_request" chokepoint
in this codebase.

Deliberately called AFTER the caller's own db.commit() for the real
business logic (user created, token issued, etc.) - this does its own
separate add+commit for just the audit row, so a logging failure can
never roll back or block the actual signup/login it's describing, and a
still-pending business transaction never gets prematurely committed by
this helper reaching for db.commit() first.
"""
import logging
from typing import Optional

from sqlalchemy.orm import Session
from starlette.requests import Request

from app.core.rate_limit import _client_ip
from app.core.geo_ip import resolve_country_from_ip
from app.models.audit_log import AuditLog

logger = logging.getLogger(__name__)


def record_audit_event(
    db: Session,
    event_type: str,
    request: Optional[Request] = None,
    actor_user_id: Optional[int] = None,
    actor_email: Optional[str] = None,
    actor_name: Optional[str] = None,
    shop_id: Optional[int] = None,
    description: Optional[str] = None,
    extra: Optional[dict] = None,
) -> None:
    """Never raises - a logging failure must never break the real request
    it's attached to (same "observability can't take down the feature it
    observes" principle as every other best-effort side-effect in this
    codebase, e.g. email sending running on its own thread pool)."""
    try:
        ip = None
        country = None
        user_agent = None
        if request is not None:
            ip = _client_ip(request)
            country = resolve_country_from_ip(ip)
            user_agent = (request.headers.get("user-agent") or "")[:500]

        db.add(AuditLog(
            event_type=event_type,
            actor_user_id=actor_user_id,
            actor_email=actor_email,
            actor_name=actor_name,
            shop_id=shop_id,
            ip_address=ip,
            country=country,
            user_agent=user_agent,
            description=description,
            extra=extra,
        ))
        db.commit()
    except Exception:
        logger.warning("[AUDIT LOG] failed to record event=%s", event_type, exc_info=True)
        db.rollback()
