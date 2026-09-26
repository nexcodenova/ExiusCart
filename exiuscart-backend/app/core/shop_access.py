"""Store team access: who besides the owner can touch a shop, and what.

Design in one paragraph: the owner (Shop.owner_id) always has everything and
is never checked here. Anyone else reaches a shop only as an ACTIVE ShopStaff
row, whose ShopRole (built by the owner, not hardcoded) lists permissions of
the form "<area>.view" / "<area>.manage". One gate (`staff_gate`, attached to
the whole API router) looks at every /shops/{shop_id}/... request, works out
which area of the app the URL belongs to (PATH_AREAS below), and lets a staff
member through only if their role carries the right permission for that area
and HTTP method. Everything not listed in PATH_AREAS (billing, channel
credentials, webhooks, deleting the store, the team itself...) is owner-only
by default - staff get a 403 without any per-endpoint work, so a new endpoint
can never be accidentally staff-accessible.

The gate does the permission check; the endpoints' own "is this MY shop?"
lookups then only need to accept a staff member the gate already approved.
That is `get_shop_for_member`: owner -> the shop; approved staff -> the shop;
anyone else -> None (the endpoint's usual 404). Approval is carried from the
gate to the endpoint in a ContextVar scoped to the single request.
"""
import contextvars
from typing import Optional

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session, joinedload

from app.api.v1.deps import get_current_user
from app.core.database import get_db
from app.core.security import decode_token
from app.models.shop import Shop
from app.models.shop_staff import ShopStaff, ShopRole
from app.models.user import User

# ── The permission catalog ────────────────────────────────────────────────────
# The ONLY fixed thing about roles: the areas a role can be built from. Each
# area has two levels - "view" (read) and "manage" (create/edit/delete);
# manage implies view.

PERMISSION_AREAS = [
    {"key": "orders", "label": "Orders & invoices",
     "description": "See and process orders, invoices, credit notes, quotations and the activity feed."},
    {"key": "products", "label": "Products & inventory",
     "description": "Products, categories, stock levels, suppliers, purchases and discounts."},
    {"key": "customers", "label": "Customers & support",
     "description": "Customer records, segments, leads, helpdesk tickets and surveys."},
    {"key": "marketing", "label": "Marketing & content",
     "description": "Campaigns, popups, reviews, blog, social, WhatsApp/SMS, loyalty and AI content."},
    {"key": "analytics", "label": "Reports & analytics",
     "description": "Dashboard numbers, sales and financial reports, and storefront analytics."},
    {"key": "finance", "label": "Finance",
     "description": "Expenses and wholesale."},
    {"key": "hr", "label": "Team & HR",
     "description": "Employees, attendance, leave, payroll and recruitment."},
    {"key": "fulfillment", "label": "Fulfillment & dropshipping",
     "description": "Dropship orders, channel listings and sync status."},
    {"key": "operations", "label": "Bookings & operations",
     "description": "Appointments, reservations, fleet, projects, tasks and events."},
]

AREA_KEYS = {a["key"] for a in PERMISSION_AREAS}
ALL_PERMISSIONS = sorted(f"{k}.{lvl}" for k in AREA_KEYS for lvl in ("view", "manage"))

# First URL segment after /shops/{shop_id}/ -> the permission area it needs.
# A segment that is NOT listed here is owner-only.
PATH_AREAS = {
    # orders
    "orders": "orders", "activity-log": "orders", "credit-notes": "orders",
    "recurring-invoices": "orders", "quotations": "orders",
    # products
    "products": "products", "fields": "products", "inventory": "products", "suppliers": "products",
    "purchases": "products", "next-sku": "products", "image-limit": "products",
    "description-image-presign": "products", "storefront-categories": "products",
    "product-channel-categories": "products", "discounts": "products",
    # customers
    "customers": "customers", "customer-segments": "customers", "leads": "customers",
    "helpdesk": "customers", "surveys": "customers", "captured-submissions": "customers",
    # marketing
    "marketing": "marketing", "drip-flows": "marketing", "signup-forms": "marketing",
    "popups": "marketing", "reviews": "marketing", "social": "marketing", "whatsapp": "marketing",
    "sms": "marketing", "blog": "marketing", "meta-ads": "marketing", "videos": "marketing",
    "ai": "marketing", "loyalty": "marketing",
    # analytics
    "reports": "analytics", "analytics": "analytics", "stats": "analytics",
    "storefront-insights": "analytics", "clarity": "analytics",
    # finance
    "expenses": "finance", "wholesale": "finance",
    # hr
    "employees": "hr", "attendance": "hr", "leaves": "hr", "payroll": "hr",
    "recruitment": "hr", "branches": "hr",
    # fulfillment
    "dropship": "fulfillment", "channel-listings": "fulfillment",
    "channel-sync-logs": "fulfillment", "channel-statuses": "fulfillment",
    # operations
    "appointments": "operations", "reservations": "operations", "fleet": "operations",
    "projects": "operations", "tasks": "operations", "events": "operations",
}

# Any URL containing one of these path segments handles third-party credentials
# (supplier/channel/WhatsApp/SMS/social API keys and OAuth tokens), so it stays
# owner-only even inside an area a role has - handing someone "Marketing" must
# never also hand them the keys to the shop's connected accounts.
OWNER_ONLY_SEGMENTS = {"connect", "disconnect", "credentials", "authorize", "api-key", "apikey"}

_READ_METHODS = {"GET", "HEAD", "OPTIONS"}

# Set by staff_gate for the current request only, read by get_shop_for_member.
_approved_shop: contextvars.ContextVar[Optional[int]] = contextvars.ContextVar("approved_staff_shop", default=None)

_bearer = HTTPBearer(auto_error=False)


def clean_permissions(perms) -> list[str]:
    """Only known permission strings survive, de-duplicated and sorted -
    whatever a client sends when creating/editing a role."""
    if not isinstance(perms, (list, tuple, set)):
        return []
    return sorted({p for p in perms if p in ALL_PERMISSIONS})


def role_allows(permissions, area: str, write: bool) -> bool:
    perms = set(permissions or [])
    if f"{area}.manage" in perms:
        return True
    return (not write) and f"{area}.view" in perms


def _area_for_request(request: Request, shop_id: int) -> tuple[Optional[str], bool]:
    """(area, is_shop_root). area None + not root = owner-only URL."""
    segments = [s for s in request.scope.get("path", "").split("/") if s]
    sid = str(shop_id)
    try:
        rest = segments[segments.index(sid) + 1:]
    except ValueError:
        return None, False
    if not rest:
        return None, True
    if any(seg in OWNER_ONLY_SEGMENTS for seg in rest):
        return None, False
    return PATH_AREAS.get(rest[0]), False


_route_needs_login_cache: dict[int, bool] = {}


def _dependant_uses(dependant, target) -> bool:
    for dep in dependant.dependencies:
        if dep.call is target or _dependant_uses(dep, target):
            return True
    return False


def _route_requires_seller_login(request: Request) -> bool:
    """True when the matched route sits behind get_current_user (directly or
    through a wrapper like require_superuser). Public/storefront routes -
    which also live under /shops/{shop_id}/... - never do, and must stay
    reachable by anyone."""
    route = request.scope.get("route")
    if route is None or not hasattr(route, "dependant"):
        return False
    key = id(route)
    if key not in _route_needs_login_cache:
        _route_needs_login_cache[key] = _dependant_uses(route.dependant, get_current_user)
    return _route_needs_login_cache[key]


async def staff_gate(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: Session = Depends(get_db),
):
    """Attached to the whole API router. For every request to a route that
    needs a seller login AND names a shop (/shops/{shop_id}/...):

      * the shop's owner            -> through, exactly as before
      * an admin (is_superuser)     -> through, exactly as before
      * an ACTIVE staff member      -> through only if their role allows this
                                       area + method (see PATH_AREAS)
      * anyone else                 -> 404 "Shop not found"

    That last line is the important one: many routes never checked ownership
    themselves (orders, order actions, customers, products, activity log...),
    so before this any logged-in user of ANY store could read, and even
    cancel, another store's orders just by changing the shop id in the URL.
    Doing it once here closes that for every route, including ones added
    later. Public/storefront routes (no seller login required) and requests
    with no token are not touched."""
    raw = request.path_params.get("shop_id")
    if raw is None or credentials is None:
        return
    try:
        shop_id = int(raw)
    except (TypeError, ValueError):
        return
    payload = decode_token(credentials.credentials)
    if not payload or payload.get("type") == "customer":
        return
    try:
        user_id = int(payload.get("sub"))
    except (TypeError, ValueError):
        return
    if not _route_requires_seller_login(request):
        return  # public/storefront route living under /shops/{shop_id}/...

    owner_id = db.query(Shop.owner_id).filter(Shop.id == shop_id).scalar()
    if owner_id is not None and owner_id == user_id:
        return  # the owner - unrestricted

    membership = (
        db.query(ShopStaff)
        .options(joinedload(ShopStaff.role))
        .filter(ShopStaff.shop_id == shop_id, ShopStaff.user_id == user_id)
        .first()
    )
    if membership is None:
        # Not the owner, not on the team. Admins (support/back-office) keep the
        # access they've always had; everyone else is looking at someone else's shop.
        if db.query(User.id).filter(User.id == user_id, User.is_superuser == True).first():  # noqa: E712
            return
        raise HTTPException(status_code=404, detail="Shop not found")

    if membership.status != "active":
        raise HTTPException(status_code=403, detail="Your access to this store has been paused by the owner.")

    area, is_root = _area_for_request(request, shop_id)
    if is_root:
        # The shop's basic record (name, currency, logo...) - read-only, no secrets.
        if request.method in _READ_METHODS:
            _approved_shop.set(shop_id)
            return
        raise HTTPException(status_code=403, detail="Only the store owner can do this.")
    if area is None:
        # The dashboard search box is open to every active team member; the endpoint itself
        # only returns the sections their role can view.
        _rest = request.url.path.split(f"/shops/{shop_id}/", 1)[-1]
        if _rest.split("/")[0] == "search" and request.method in _READ_METHODS:
            _approved_shop.set(shop_id)
            return
        raise HTTPException(status_code=403, detail="Only the store owner can do this.")

    write = request.method not in _READ_METHODS
    if not role_allows(membership.role.permissions if membership.role else [], area, write):
        label = next((a["label"] for a in PERMISSION_AREAS if a["key"] == area), area)
        verb = "make changes in" if write else "view"
        raise HTTPException(status_code=403, detail=f"Your role doesn't allow you to {verb} {label}. Ask the store owner for access.")

    _approved_shop.set(shop_id)


def get_shop_for_member(db: Session, shop_id: int, user: User) -> Optional[Shop]:
    """Drop-in for the old `db.query(Shop).filter(Shop.id == shop_id,
    Shop.owner_id == user.id).first()`: the owner, or a staff member the gate
    approved for exactly this shop on this request. Anyone else gets None."""
    shop = db.query(Shop).filter(Shop.id == shop_id, Shop.owner_id == user.id).first()
    if shop:
        return shop
    if _approved_shop.get() == shop_id:
        active = db.query(ShopStaff.id).filter(
            ShopStaff.shop_id == shop_id, ShopStaff.user_id == user.id, ShopStaff.status == "active",
        ).first()
        if active:
            return db.query(Shop).filter(Shop.id == shop_id).first()
    return None


def get_active_membership(db: Session, shop_id: int, user_id: int) -> Optional[ShopStaff]:
    return (
        db.query(ShopStaff)
        .options(joinedload(ShopStaff.role))
        .filter(ShopStaff.shop_id == shop_id, ShopStaff.user_id == user_id, ShopStaff.status == "active")
        .first()
    )


def find_staff_shop(db: Session, user: User) -> Optional[Shop]:
    """The shop this user works at as staff (first, if several) - what
    GET /shops/me returns for someone who owns no shop."""
    row = (
        db.query(ShopStaff)
        .filter(ShopStaff.user_id == user.id, ShopStaff.status == "active")
        .order_by(ShopStaff.id.asc())
        .first()
    )
    if not row:
        return None
    return db.query(Shop).filter(Shop.id == row.shop_id, Shop.is_active == True).first()  # noqa: E712


def access_summary(db: Session, shop_id: int, user: User) -> Optional[dict]:
    """What the dashboard needs to draw the right menu: is this person the
    owner, and if not, which role/permissions do they have. None = no access."""
    if db.query(Shop.id).filter(Shop.id == shop_id, Shop.owner_id == user.id).first():
        return {"is_owner": True, "role": None, "permissions": ALL_PERMISSIONS}
    m = get_active_membership(db, shop_id, user.id)
    if not m:
        return None
    return {
        "is_owner": False,
        "role": {"id": m.role.id, "name": m.role.name} if m.role else None,
        "permissions": clean_permissions(m.role.permissions if m.role else []),
    }
