"""Who changed what, in which store.

Every successful change (POST/PUT/PATCH/DELETE) to a store's data is written to
the audit log as a "shop_action" event: who did it (owner, a team member with
their role, or an admin), which store, what area, and a plain-English line
such as "Cancelled order #123". Admin sees all stores' actions; each owner sees
their own team's (GET /shops/{id}/team/activity).

Done as a pure ASGI middleware rather than per-endpoint code, so it covers every
store feature - including ones added later - without anyone remembering to call
a logger. It only records; it never changes, delays or fails a request:
  * reads (GET/HEAD/OPTIONS) are never logged - page views would drown the log;
  * only responses that succeeded (2xx/3xx) are logged - a refused or failed
    attempt changed nothing;
  * the database write happens on a background thread AFTER the response has
    been sent, and any error in it is swallowed.

It stores what happened, not the before/after values, so no customer or
payment data is copied into the log.
"""
import logging
import re
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

from sqlalchemy.orm import joinedload
from starlette.requests import Request

from app.core.audit_log import record_audit_event
from app.core.security import decode_token
from app.core.shop_access import PATH_AREAS

logger = logging.getLogger(__name__)

# One worker on purpose: writes stay in order, and tests can wait for "everything
# so far is written" by queueing a no-op behind them (see flush()).
_pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="action-audit")

# Overridable so tests can point this at their own database.
session_factory = None  # set lazily to app.core.database.SessionLocal

_WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
_PATH = re.compile(r"^/api/v1/shops/(\d+|me)(?:/(.*))?$")

# Segments that are logged elsewhere already, or that are not really changes.
_SKIP_FIRST = {"team", "activity-log", "exchange-rates"}
_SKIP_LAST = {"search", "preview", "presign", "estimate", "validate", "check", "read", "read-all"}

_ACRONYMS = {"sku": "SKU", "vat": "VAT", "ai": "AI", "sms": "SMS", "seo": "SEO"}


def _noun(segment: str) -> str:
    word = segment.replace("-", " ")
    if word.endswith("ies"):
        word = word[:-3] + "y"
    elif word.endswith("s") and not word.endswith("ss") and word not in ("status", "analytics", "sms"):
        word = word[:-1]
    return _ACRONYMS.get(word, word)


def describe_action(method: str, rest: str) -> Optional[tuple[str, str]]:
    """(area, human sentence) for a change to /shops/{id}/<rest>, or None to skip.
    `rest` is everything after the shop id, e.g. "orders/12/status"."""
    parts = [p for p in (rest or "").split("/") if p]
    if not parts:  # the shop record itself
        return ("settings", "Deleted the store" if method == "DELETE" else "Updated store settings")
    if parts[0] in _SKIP_FIRST or parts[-1] in _SKIP_LAST:
        return None

    area = PATH_AREAS.get(parts[0], "owner")
    resource = _noun(parts[0])
    ids = [p for p in parts[1:] if p.isdigit()]
    words = [p for p in parts[1:] if not p.isdigit()]
    target = f" #{ids[0]}" if ids else ""

    if method == "DELETE":
        sentence = f"Deleted {resource}{target}" + (f" ({words[0].replace('-', ' ')})" if words else "")
    elif method in ("PUT", "PATCH"):
        sentence = f"Updated {resource}{target}" + (f" ({words[0].replace('-', ' ')})" if words else "")
    elif words:  # POST /orders/12/ship -> "Ship order #12"
        sentence = f"{words[-1].replace('-', ' ').capitalize()} {resource}{target}"
    else:
        sentence = f"Created {resource}" if not ids else f"Updated {resource}{target}"
    return (area, sentence)


def _record(scope: dict, status_code: int) -> None:
    from app.core import database
    from app.models.shop import Shop
    from app.models.shop_staff import ShopStaff
    from app.models.user import User

    m = _PATH.match(scope["path"])
    if not m:
        return
    described = describe_action(scope["method"], m.group(2) or "")
    if described is None:
        return
    area, sentence = described

    headers = {k.decode("latin-1").lower(): v.decode("latin-1") for k, v in scope.get("headers", [])}
    auth = headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        return
    payload = decode_token(auth[7:])
    if not payload or payload.get("type") == "customer":
        return
    try:
        user_id = int(payload.get("sub"))
    except (TypeError, ValueError):
        return

    db = (session_factory or database.SessionLocal)()
    try:
        user = db.get(User, user_id)
        if not user:
            return
        raw = m.group(1)
        if raw == "me":
            shop = db.query(Shop).filter(Shop.owner_id == user_id).order_by(Shop.id.asc()).first()
        else:
            shop = db.get(Shop, int(raw))
        if not shop:
            return

        role_name = None
        if shop.owner_id == user_id:
            acting_as = "owner"
        else:
            member = (
                db.query(ShopStaff).options(joinedload(ShopStaff.role))
                .filter(ShopStaff.shop_id == shop.id, ShopStaff.user_id == user_id).first()
            )
            if member:
                acting_as, role_name = "staff", member.role.name if member.role else None
            elif user.is_superuser:
                acting_as = "admin"
            else:
                return  # not someone the gate would have let through

        record_audit_event(
            db, "shop_action", request=Request(scope),
            actor_user_id=user.id, actor_email=user.email, actor_name=user.full_name, shop_id=shop.id,
            description=sentence,
            extra={"as": acting_as, "role": role_name, "area": area, "method": scope["method"],
                   "path": scope["path"], "status": status_code},
        )
    except Exception:
        logger.warning("[ACTION AUDIT] could not record %s %s", scope.get("method"), scope.get("path"), exc_info=True)
    finally:
        db.close()


def flush() -> None:
    """Block until every action queued so far has been written (tests only)."""
    _pool.submit(lambda: None).result(timeout=30)


class ShopActionAuditMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] not in _WRITE_METHODS or not scope["path"].startswith("/api/v1/shops/"):
            return await self.app(scope, receive, send)

        seen = {"status": None}

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                seen["status"] = message["status"]
            await send(message)

        await self.app(scope, receive, send_wrapper)

        status_code = seen["status"]
        if status_code is not None and 200 <= status_code < 400:
            try:
                _pool.submit(_record, dict(scope), status_code)
            except Exception:
                logger.warning("[ACTION AUDIT] queue failed", exc_info=True)
