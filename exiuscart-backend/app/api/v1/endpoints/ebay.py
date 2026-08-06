"""
eBay Sell APIs — OAuth2 connect flow.

Unlike TheDersi (a static per-seller API key), eBay uses OAuth2 exactly like
Daraz: ExiusCart registers ONE app on developer.ebay.com and gets a single
App ID/Cert ID for the whole platform. Each seller then authorizes that app
against their own, already-existing eBay account — they never see or enter
the App ID/Cert ID themselves.

Flow:
  1. Seller clicks "Connect eBay" → GET /shops/{shop_id}/channels/ebay/authorize
     → we create a pending ChannelConnection with a CSRF `state` token and
       return eBay's authorize URL.
  2. Browser redirects to eBay → seller logs into THEIR eBay account →
     approves access.
  3. eBay redirects back to GET /channels/ebay/callback?code=...&state=...
     → we validate state, then exchange the code for a real access_token via
       POST /identity/v1/oauth2/token (see _exchange_code_for_token).

eBay's redirect_uri is not a raw URL — it's a "RuName" registered once in
the eBay Developer Portal ("eBay Redirect URLs") against this app's keyset,
that resolves server-side to our real callback URL. EBAY_RU_NAME must be
configured before the authorize flow can work at all.

Unlike Daraz (whose access token has no confirmed expiry handling), eBay's
access token is short-lived (~2 hours) and MUST be proactively refreshed —
see _ebay_ensure_token, which mirrors dropshipping.py's _cj_ensure_token.

Every substantive Sell API call goes through _ebay_api_request, the eBay
equivalent of Daraz's _daraz_signed_request — the one function every future
eBay API call (orders, inventory, finances) is built on.
"""
import os
import json
import base64
import hashlib
import secrets
import logging
from datetime import datetime, timezone, timedelta

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.thedersi import is_thedersi_shop
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.shop import Shop
from app.models.channel import ChannelConnection
from app.models.product import Product
from app.models.channel_product_status import ChannelProductStatus
from app.models.subscription import Subscription
from app.api.v1.endpoints.channels import _shop_or_404, EXIUSCART_BASE

logger = logging.getLogger(__name__)

router = APIRouter()

EBAY_ENV = os.getenv("EBAY_ENV", "sandbox")
EBAY_APP_ID = os.getenv("EBAY_APP_ID", "")
EBAY_CERT_ID = os.getenv("EBAY_CERT_ID", "")
EBAY_RU_NAME = os.getenv("EBAY_RU_NAME", "")

# eBay refuses to activate any Production keyset until this exact URL is
# registered (with EBAY_DELETION_VERIFICATION_TOKEN) under "Marketplace
# Account Deletion/Closure Notifications" in the Developer Portal — see
# ebay_account_deletion_challenge/notify below. The URL is hardcoded (not
# read from a request) because eBay's challenge-response hash must be
# computed over the exact string registered, byte for byte.
EBAY_DELETION_VERIFICATION_TOKEN = os.getenv("EBAY_DELETION_VERIFICATION_TOKEN", "")
EBAY_DELETION_ENDPOINT_URL = "https://api.exiuscart.com/api/v1/channels/ebay/account-deletion"

EBAY_AUTH_BASE = "https://auth.sandbox.ebay.com" if EBAY_ENV == "sandbox" else "https://auth.ebay.com"
EBAY_API_BASE = "https://api.sandbox.ebay.com" if EBAY_ENV == "sandbox" else "https://api.ebay.com"

STOREFRONT_BASE = "https://store.exiuscart.com"

EBAY_SCOPES = " ".join([
    # Base scope — required by the Taxonomy API (category tree lookup) on
    # top of the specific sell.* scopes below, which only cover
    # inventory/account/fulfillment/finances, not category browsing.
    "https://api.ebay.com/oauth/api_scope",
    "https://api.ebay.com/oauth/api_scope/sell.inventory",
    "https://api.ebay.com/oauth/api_scope/sell.account",
    "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
    "https://api.ebay.com/oauth/api_scope/sell.finances",
])

# eBay doesn't require a seller to be physically in a given marketplace's
# country to list there — dropshippers commonly run a store on eBay.com
# while sourcing/shipping from a supplier warehouse elsewhere (eBay's own
# item-location policy just requires the listing to state where the item
# actually ships from, not where the seller is registered). So this maps a
# few shop countries to their own local eBay site where that's the more
# natural choice, and everyone else defaults to EBAY_US — the largest,
# most universal site — rather than being blocked outright.
EBAY_MARKETPLACE_BY_COUNTRY = {
    "US": "EBAY_US",
    "GB": "EBAY_GB",
    "CA": "EBAY_CA",
}
EBAY_DEFAULT_MARKETPLACE = "EBAY_US"


def _ebay_marketplace_id(country_code: str) -> str:
    return EBAY_MARKETPLACE_BY_COUNTRY.get((country_code or "").strip().upper(), EBAY_DEFAULT_MARKETPLACE)


def _ebay_token_request(grant_type: str, **params) -> dict | None:
    """POSTs to eBay's OAuth token endpoint — used for both the initial
    authorization-code exchange and every later refresh. Basic Auth is
    base64(App ID:Cert ID), per eBay's Identity API docs."""
    if not EBAY_APP_ID or not EBAY_CERT_ID:
        logger.error("[EBAY OAUTH] EBAY_APP_ID/EBAY_CERT_ID not configured")
        return None

    basic = base64.b64encode(f"{EBAY_APP_ID}:{EBAY_CERT_ID}".encode("utf-8")).decode("utf-8")
    headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": f"Basic {basic}",
    }
    data = {"grant_type": grant_type, **params}
    try:
        resp = httpx.post(f"{EBAY_API_BASE}/identity/v1/oauth2/token", data=data, headers=headers, timeout=15)
        result = resp.json()
        if resp.status_code >= 300 or "access_token" not in result:
            logger.error(f"[EBAY OAUTH] token request ({grant_type}) failed — status={resp.status_code} body={result}")
            return None
        return result
    except Exception as e:
        logger.error(f"[EBAY OAUTH] token request ({grant_type}) failed: {e}")
        return None


def _exchange_code_for_token(code: str) -> dict | None:
    """Exchanges an OAuth authorization code for a real access_token via
    POST /identity/v1/oauth2/token, grant_type=authorization_code."""
    data = _ebay_token_request("authorization_code", code=code, redirect_uri=EBAY_RU_NAME)
    if not data:
        return None
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=data.get("expires_in", 0))
    return {
        "access_token": data["access_token"],
        "refresh_token": data.get("refresh_token"),
        "expires_at": expires_at,
    }


def _ebay_ensure_token(conn: ChannelConnection, db: Session) -> str:
    """Returns a valid eBay access token, proactively refreshing if it's
    expired or about to expire. Load-bearing for eBay (unlike Daraz, which
    has no refresh implemented) since eBay's access token only lasts ~2
    hours — mirrors dropshipping.py's _cj_ensure_token."""
    now = datetime.now(timezone.utc)
    buffer = timedelta(minutes=5)
    if conn.access_token and conn.token_expires_at and conn.token_expires_at > now + buffer:
        return conn.access_token

    if not conn.refresh_token:
        raise HTTPException(status_code=400, detail={
            "error": "ebay_reconnect_required",
            "message": "eBay session expired. Please reconnect your eBay account.",
        })

    data = _ebay_token_request("refresh_token", refresh_token=conn.refresh_token, scope=EBAY_SCOPES)
    if not data:
        raise HTTPException(status_code=400, detail={
            "error": "ebay_reconnect_required",
            "message": "Could not refresh eBay session. Please reconnect your eBay account.",
        })

    conn.access_token = data["access_token"]
    conn.token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=data.get("expires_in", 0))
    db.commit()
    return conn.access_token


EBAY_CONTENT_LANGUAGE_BY_MARKETPLACE = {
    "EBAY_US": "en-US",
    "EBAY_GB": "en-GB",
    "EBAY_CA": "en-CA",
}


def _ebay_api_request(method: str, path: str, conn: ChannelConnection, db: Session, marketplace_id: str, **kwargs) -> httpx.Response | None:
    """The one function every eBay Sell API call goes through — ensures a
    fresh token, sets the required headers, hits EBAY_API_BASE + path.
    Direct parallel to Daraz's _daraz_signed_request."""
    token = _ebay_ensure_token(conn, db)
    headers = {
        "Authorization": f"Bearer {token}",
        "X-EBAY-C-MARKETPLACE-ID": marketplace_id,
        "Content-Type": "application/json",
        # Required by the Inventory API on inventory_item/offer writes —
        # omitting it fails with errorId 25709 "Invalid value for header
        # Content-Language" (confirmed from a real failed listing attempt).
        "Content-Language": EBAY_CONTENT_LANGUAGE_BY_MARKETPLACE.get(marketplace_id, "en-US"),
        **kwargs.pop("headers", {}),
    }
    url = f"{EBAY_API_BASE}{path}"
    try:
        with httpx.Client(timeout=20) as client:
            return client.request(method, url, headers=headers, **kwargs)
    except Exception as e:
        logger.error(f"[EBAY API] {method} {path} failed: {e}")
        return None


def _ebay_callback_url() -> str:
    return f"{EXIUSCART_BASE.rstrip('/')}/channels/ebay/callback"


# ── OAuth connect ────────────────────────────────────────────────────────────

@router.get("/shops/{shop_id}/channels/ebay/authorize")
def ebay_authorize(
    shop_id: int,
    seller_country: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Start the eBay OAuth flow — returns the URL to redirect the seller's
    browser to. The seller must already have their own eBay account; this
    only authorizes ExiusCart's app to access it.

    seller_country is the country the seller's eBay account is REGISTERED
    under — required and stated explicitly by the seller here, never
    inferred from the shop's general profile country (which is for
    invoicing/VAT and can legitimately be different). eBay rejects any
    listing whose item location doesn't match the seller's own registered
    country, so guessing this gets a real seller a real rejected listing."""
    shop = _shop_or_404(shop_id, current_user, db)

    seller_country_iso = _shop_country_iso(seller_country)
    if not seller_country_iso:
        raise HTTPException(
            status_code=400,
            detail="Enter the country your eBay seller account is registered under — this couldn't be recognized.",
        )

    if not EBAY_APP_ID or not EBAY_RU_NAME:
        raise HTTPException(
            status_code=503,
            detail="eBay integration isn't configured yet — ExiusCart's app registration with eBay is still pending.",
        )

    # Same restriction already applied to every non-TheDersi/Daraz channel.
    if is_thedersi_shop(shop_id, db):
        raise HTTPException(
            status_code=403,
            detail={
                "error": "channel_not_available",
                "message": "Your plan is managed by TheDersi. Only TheDersi and Daraz channels are available on TheDersi plans.",
            },
        )

    marketplace_id = _ebay_marketplace_id(seller_country_iso)

    existing = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.channel_type == "ebay",
        ChannelConnection.is_active == True,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already connected to eBay")

    sub = db.query(Subscription).filter(Subscription.shop_id == shop_id).order_by(Subscription.id.desc()).first()
    plan_type = sub.plan_type if sub else "free_trial"
    if plan_type not in ("thedersi_pro", "premium"):
        raise HTTPException(
            status_code=403,
            detail={
                "error": "ebay_requires_premium",
                "plan": plan_type,
                "message": "eBay sync is available on Premium. Upgrade to connect your eBay seller account.",
            },
        )

    state = secrets.token_urlsafe(32)

    pending = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.channel_type == "ebay",
        ChannelConnection.is_active == False,
    ).first()
    if pending:
        pending.oauth_state = state
        pending.seller_country = seller_country_iso
    else:
        pending = ChannelConnection(
            shop_id=shop_id,
            channel_type="ebay",
            is_active=False,
            oauth_state=state,
            seller_country=seller_country_iso,
            webhook_secret=secrets.token_urlsafe(32),
        )
        db.add(pending)
    db.commit()

    params = {
        "client_id": EBAY_APP_ID,
        "redirect_uri": EBAY_RU_NAME,
        "response_type": "code",
        "scope": EBAY_SCOPES,
        "state": state,
    }
    from urllib.parse import urlencode
    authorize_url = f"{EBAY_AUTH_BASE}/oauth2/authorize?{urlencode(params)}"
    return {"authorize_url": authorize_url, "marketplace_id": marketplace_id}


@router.get("/channels/ebay/callback")
def ebay_callback(
    code: str = None,
    state: str = None,
    error: str = None,
    db: Session = Depends(get_db),
):
    """eBay redirects the seller's browser here after they approve (or deny)
    access. Public endpoint — verified via the CSRF `state` token, not auth."""
    if error or not code or not state:
        logger.warning(f"[EBAY OAUTH] callback failed — error={error} code_present={bool(code)} state_present={bool(state)}")
        return RedirectResponse(f"{STOREFRONT_BASE}/dashboard/ebay-integration?ebay=denied")

    conn = db.query(ChannelConnection).filter(
        ChannelConnection.channel_type == "ebay",
        ChannelConnection.oauth_state == state,
        ChannelConnection.is_active == False,
    ).first()
    if not conn:
        logger.error(f"[EBAY OAUTH] callback with unknown/expired state={state[:8]}...")
        return RedirectResponse(f"{STOREFRONT_BASE}/dashboard/ebay-integration?ebay=invalid_state")

    token_result = _exchange_code_for_token(code)
    if token_result is None:
        conn.seller_status = "pending_token_exchange"
        db.commit()
        logger.warning(f"[EBAY OAUTH] shop={conn.shop_id} token exchange failed — connection left pending, see error above")
        return RedirectResponse(f"{STOREFRONT_BASE}/dashboard/ebay-integration?ebay=pending")

    conn.access_token = token_result["access_token"]
    conn.refresh_token = token_result.get("refresh_token")
    conn.token_expires_at = token_result.get("expires_at")
    conn.is_active = True
    conn.oauth_state = None
    conn.seller_status = "approved"
    db.commit()
    return RedirectResponse(f"{STOREFRONT_BASE}/dashboard/ebay-integration?ebay=connected")


# ── Marketplace Account Deletion/Closure Notifications ──────────────────────
# eBay requires every Production keyset to prove it can receive these before
# eBay will activate it, since ExiusCart stores real eBay data (tokens) —
# opting out is only for apps that store nothing. Two calls, both public
# (eBay itself calls these, not a logged-in user):
#   1. GET  — eBay's one-time ownership challenge, sent the moment this URL
#      is saved in the Developer Portal.
#   2. POST — the real notification, sent later whenever an eBay user who
#      connected through us deletes their eBay account.

@router.get("/channels/ebay/account-deletion")
def ebay_account_deletion_challenge(challenge_code: str):
    if not EBAY_DELETION_VERIFICATION_TOKEN:
        raise HTTPException(status_code=503, detail="Deletion endpoint isn't configured yet")
    digest = hashlib.sha256(
        (challenge_code + EBAY_DELETION_VERIFICATION_TOKEN + EBAY_DELETION_ENDPOINT_URL).encode("utf-8")
    ).hexdigest()
    return {"challengeResponse": digest}


@router.post("/channels/ebay/account-deletion")
async def ebay_account_deletion_notify(request: Request):
    """We store eBay tokens per shop connection, not per eBay end-user, so
    there's no direct field yet to auto-match a deleted eBay account to a
    specific connection. Logged here (with the identifiers eBay sends) so
    any matching connection can be found and purged manually until that
    matching is built. Must ack fast — eBay expects 200 back quickly, no
    heavy work in the request itself."""
    payload = await request.json()
    notification = payload.get("notification") or {}
    data = notification.get("data") or {}
    logger.warning(
        f"[EBAY ACCOUNT DELETION] notificationId={notification.get('notificationId')} "
        f"username={data.get('username')} userId={data.get('userId')} eiasToken={data.get('eiasToken')}"
    )
    return {"status": "ok"}


def _get_ebay_connection(shop_id: int, db: Session) -> ChannelConnection:
    conn = db.query(ChannelConnection).filter(
        ChannelConnection.shop_id == shop_id,
        ChannelConnection.channel_type == "ebay",
        ChannelConnection.is_active == True,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="eBay not connected")
    return conn


class EbaySellerCountryIn(BaseModel):
    country: str


@router.put("/shops/{shop_id}/channels/ebay/seller-country")
def set_ebay_seller_country(
    shop_id: int,
    payload: EbaySellerCountryIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lets a seller connected before this field existed (or who entered it
    wrong) correct it without a full disconnect/reconnect."""
    _shop_or_404(shop_id, current_user, db)
    conn = _get_ebay_connection(shop_id, db)
    iso = _shop_country_iso(payload.country)
    if not iso:
        raise HTTPException(status_code=400, detail="Enter the country your eBay seller account is registered under — this couldn't be recognized.")
    conn.seller_country = iso
    db.commit()
    return {"seller_country": iso}


# ── Business Policies — a real, mandatory, never-fabricated prerequisite ────
# eBay requires every offer to reference a payment/fulfillment/return policy
# ID. These encode real shipping-cost/return-window decisions the SELLER
# makes on eBay directly — ExiusCart only fetches and lets them pick.

def fetch_ebay_business_policies(marketplace_id: str, conn: ChannelConnection, db: Session) -> dict | None:
    result = {}
    for kind, path in (
        ("payment", "/sell/account/v1/payment_policy"),
        ("fulfillment", "/sell/account/v1/fulfillment_policy"),
        ("return", "/sell/account/v1/return_policy"),
    ):
        resp = _ebay_api_request("GET", path, conn, db, marketplace_id, params={"marketplace_id": marketplace_id})
        if resp is None or resp.status_code >= 300:
            logger.error(f"[EBAY POLICIES] {kind}_policy fetch failed — status={resp.status_code if resp else None} body={resp.text[:500] if resp is not None else None}")
            return None
        data = resp.json()
        key = {"payment": "paymentPolicies", "fulfillment": "fulfillmentPolicies", "return": "returnPolicies"}[kind]
        result[kind] = [
            {"id": p.get(f"{kind}PolicyId"), "name": p.get("name")}
            for p in data.get(key, [])
        ]
    return result


@router.get("/shops/{shop_id}/channels/ebay/business-policies")
def get_ebay_business_policies(
    shop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shop = _shop_or_404(shop_id, current_user, db)
    conn = _get_ebay_connection(shop_id, db)
    marketplace_id = _ebay_marketplace_id(conn.seller_country)

    policies = fetch_ebay_business_policies(marketplace_id, conn, db)
    if policies is None:
        raise HTTPException(status_code=502, detail="Could not reach eBay — try again shortly")

    if not policies["payment"] and not policies["fulfillment"] and not policies["return"]:
        raise HTTPException(status_code=400, detail={
            "error": "no_business_policies",
            "message": "You haven't set up Business Policies on eBay yet. Set up at least one payment, fulfillment, and return policy on eBay first, then come back here.",
            "link": "https://www.ebay.com/help/selling/business-policies/business-policies-setup",
        })

    saved = {}
    if conn.channel_api_key:
        try:
            saved = json.loads(conn.channel_api_key)
        except Exception:
            saved = {}

    return {**policies, "selected": saved}


class EbayBusinessPoliciesIn(BaseModel):
    payment_policy_id: str
    fulfillment_policy_id: str
    return_policy_id: str


@router.patch("/shops/{shop_id}/channels/ebay/business-policies")
def save_ebay_business_policies(
    shop_id: int,
    data: EbayBusinessPoliciesIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _shop_or_404(shop_id, current_user, db)
    conn = _get_ebay_connection(shop_id, db)
    conn.channel_api_key = json.dumps({
        "payment_policy_id": data.payment_policy_id,
        "fulfillment_policy_id": data.fulfillment_policy_id,
        "return_policy_id": data.return_policy_id,
    })
    db.commit()
    return {"message": "Business Policies saved"}


# ── Categories + item aspects ────────────────────────────────────────────────

def _flatten_ebay_categories(nodes: list, breadcrumb: str = "") -> list:
    """eBay's category tree is arbitrarily deep, same shape as Daraz's — only
    leaf categories can actually be used to list a product. Walks the tree
    and returns only leaves, each carrying a breadcrumb name."""
    leaves = []
    for node in nodes or []:
        category = node.get("category", {})
        name = category.get("categoryName", "")
        path = f"{breadcrumb} > {name}" if breadcrumb else name
        children = node.get("childCategoryTreeNodes") or []
        if node.get("leafCategoryTreeNode") or not children:
            leaves.append({"category_id": category.get("categoryId"), "name": path})
        else:
            leaves.extend(_flatten_ebay_categories(children, path))
    return leaves


def fetch_ebay_category_tree_id(marketplace_id: str, conn: ChannelConnection, db: Session) -> str | None:
    resp = _ebay_api_request(
        "GET", "/commerce/taxonomy/v1/get_default_category_tree_id", conn, db, marketplace_id,
        params={"marketplace_id": marketplace_id},
    )
    if resp is None or resp.status_code >= 300:
        logger.error(f"[EBAY CATEGORIES] get_default_category_tree_id failed — status={resp.status_code if resp else None} body={resp.text[:500] if resp is not None else None}")
        return None
    return resp.json().get("categoryTreeId")


def fetch_ebay_categories(marketplace_id: str, conn: ChannelConnection, db: Session) -> list | None:
    """Fetches eBay's full category tree and flattens it to leaf-only
    categories with breadcrumb names — same shape Daraz's fetch already
    produces. Returns None on a hard API failure."""
    tree_id = fetch_ebay_category_tree_id(marketplace_id, conn, db)
    if not tree_id:
        return None
    resp = _ebay_api_request("GET", f"/commerce/taxonomy/v1/category_tree/{tree_id}", conn, db, marketplace_id)
    if resp is None or resp.status_code >= 300:
        logger.error(f"[EBAY CATEGORIES] category_tree fetch failed — status={resp.status_code if resp else None} body={resp.text[:500] if resp is not None else None}")
        return None
    data = resp.json()
    root = data.get("rootCategoryNode", {})
    return _flatten_ebay_categories(root.get("childCategoryTreeNodes") or [])


def fetch_ebay_item_aspects(marketplace_id: str, category_id: str, conn: ChannelConnection, db: Session) -> list | None:
    """getItemAspectsForCategory — normalized server-side into Daraz's exact
    {name, label, isMandatory, inputType, options} shape so the frontend
    fields component needs zero new shape-translation logic."""
    tree_id = fetch_ebay_category_tree_id(marketplace_id, conn, db)
    if not tree_id:
        return None
    resp = _ebay_api_request(
        "GET", f"/commerce/taxonomy/v1/category_tree/{tree_id}/get_item_aspects_for_category",
        conn, db, marketplace_id, params={"category_id": category_id},
    )
    if resp is None or resp.status_code >= 300:
        logger.error(f"[EBAY ASPECTS] fetch failed for category={category_id} — status={resp.status_code if resp else None} body={resp.text[:500] if resp is not None else None}")
        return None
    data = resp.json()
    normalized = []
    for aspect in data.get("aspects", []):
        name = aspect.get("localizedAspectName", "")
        constraint = aspect.get("aspectConstraint", {})
        values = aspect.get("aspectValues", [])
        is_selection = constraint.get("aspectMode") == "SELECTION_ONLY" and bool(values)
        normalized.append({
            "name": name,
            "label": name,
            "isMandatory": bool(constraint.get("aspectRequired")),
            "inputType": "singleSelect" if is_selection else "text",
            "options": [{"name": v.get("localizedValue")} for v in values] if is_selection else [],
        })
    return normalized


@router.get("/shops/{shop_id}/channels/ebay/category-attributes")
def get_ebay_category_attributes(
    shop_id: int,
    category_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shop = _shop_or_404(shop_id, current_user, db)
    conn = _get_ebay_connection(shop_id, db)
    marketplace_id = _ebay_marketplace_id(conn.seller_country)
    attributes = fetch_ebay_item_aspects(marketplace_id, category_id, conn, db)
    if attributes is None:
        raise HTTPException(status_code=502, detail="Could not reach eBay — try again shortly")
    return {"attributes": attributes}


# ── Inventory location — the source of the listing's Item.Country ──────────
# eBay takes a published listing's item location (and therefore Item.Country)
# from the offer's merchantLocationKey. With no location, publishOffer fails
# with errorId 25002 "No <Item.Country> exists" — confirmed from a real
# failed publish. The address is the seller's own, never fabricated: it goes
# on a live public listing as where the item ships from.

EBAY_LOCATION_KEY = "exiuscart-primary"

# Shop.country holds an ISO code for some shops ("AE") and a name for others
# ("UAE") — both are in real data, so handle both rather than assuming.
# Moved to app/core/country_utils.py — Daraz hit the exact same bug this
# solved (shop.country as free text, not a dropdown), so it's now shared
# rather than fixed twice in two places.
from app.core.country_utils import shop_country_iso as _shop_country_iso


def _ebay_ensure_inventory_location(conn: ChannelConnection, db: Session, shop: Shop, marketplace_id: str) -> str:
    """Returns the seller's eBay inventory-location key, creating it on the
    first listing — and correcting it if it's out of date (e.g. it was
    created on an earlier attempt with an old/placeholder address). A stale
    location silently sends the wrong Item.Country and eBay rejects the
    listing without saying why — confirmed from a real GET showing an old
    Dubai address still attached after the shop was updated.

    Country comes from conn.seller_country — what the seller explicitly
    stated their eBay account is registered under when they connected, not
    the shop's general profile country (invoicing/VAT, can legitimately
    differ). Address/city still come from the shop profile, since eBay
    doesn't ask for those separately."""
    country_iso = conn.seller_country
    if not (country_iso and shop.address and shop.city):
        raise HTTPException(status_code=400, detail={
            "error": "shop_address_required",
            "message": "eBay needs your shop's address to set the item location on your listings. "
                       "Add your address and city under Settings, then try again.",
        })

    resp = _ebay_api_request(
        "GET", f"/sell/inventory/v1/location/{EBAY_LOCATION_KEY}", conn, db, marketplace_id,
    )
    if resp is not None and resp.status_code < 300:
        existing = resp.json().get("location", {}).get("address", {})
        if (
            existing.get("country") == country_iso
            and existing.get("city") == shop.city
            and existing.get("addressLine1") == shop.address
        ):
            return EBAY_LOCATION_KEY
        upd = _ebay_api_request(
            "POST", f"/sell/inventory/v1/location/{EBAY_LOCATION_KEY}/update_location_details",
            conn, db, marketplace_id,
            json={"location": {"address": {"addressLine1": shop.address, "city": shop.city, "country": country_iso}}},
        )
        if upd is None or upd.status_code >= 300:
            detail = upd.text[:500] if upd is not None else "no response"
            logger.error(f"[EBAY LOCATION] update failed — {detail}")
            raise HTTPException(status_code=502, detail=f"eBay rejected updating the shop location: {detail}")
        return EBAY_LOCATION_KEY

    body = {
        "location": {"address": {
            "addressLine1": shop.address,
            "city": shop.city,
            "country": country_iso,
        }},
        "name": (shop.name or "ExiusCart")[:1000],
        "merchantLocationStatus": "ENABLED",
        "locationTypes": ["WAREHOUSE"],
    }
    resp = _ebay_api_request(
        "POST", f"/sell/inventory/v1/location/{EBAY_LOCATION_KEY}",
        conn, db, marketplace_id, json=body,
    )
    if resp is None or (resp.status_code >= 300 and resp.status_code != 409):
        detail = resp.text[:500] if resp is not None else "no response"
        logger.error(f"[EBAY LOCATION] create failed — {detail}")
        raise HTTPException(status_code=502, detail=f"eBay rejected the shop location: {detail}")
    return EBAY_LOCATION_KEY


# ── Listing — three chained eBay Inventory API calls per product ────────────

class EbayListingRequest(BaseModel):
    category_id: str
    aspect_values: dict = {}   # {aspect_name: [value]} — eBay aspects are lists, even single-value ones
    condition: str = "NEW"
    payment_policy_id: str | None = None
    fulfillment_policy_id: str | None = None
    return_policy_id: str | None = None


def _log_ebay_sync(db: Session, shop_id: int, product_id: int, success: bool, error: str | None = None):
    """Records the attempt on the Channel Listings page. Every eBay listing
    attempt gets logged — success or failure — the same way Daraz and Noon
    already do, so a failed listing is visible there instead of only
    appearing as a red message inside the product modal."""
    from app.models.channel_sync_log import ChannelSyncLog
    try:
        db.add(ChannelSyncLog(
            shop_id=shop_id, product_id=product_id, channel_type="ebay",
            action="listing", success=success,
            error_message=(error or "")[:2000] or None,
        ))
        db.commit()
    except Exception:
        db.rollback()


@router.post("/shops/{shop_id}/channels/ebay/products/{product_id}/create")
def create_ebay_listing(
    shop_id: int,
    product_id: int,
    payload: EbayListingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Creates the real listing on eBay: one inventory item + one offer per
    SKU, then publishes each offer. eBay's publish is synchronous — success
    here means the listing is already live, unlike Daraz's pending-review
    flow."""
    try:
        return _create_ebay_listing_inner(shop_id, product_id, payload, db, current_user)
    except HTTPException as exc:
        _log_ebay_sync(db, shop_id, product_id, False, str(exc.detail))
        raise


def _create_ebay_listing_inner(
    shop_id: int,
    product_id: int,
    payload: EbayListingRequest,
    db: Session,
    current_user: User,
):
    shop = _shop_or_404(shop_id, current_user, db)
    conn = _get_ebay_connection(shop_id, db)
    marketplace_id = _ebay_marketplace_id(conn.seller_country)

    product = db.query(Product).filter(Product.id == product_id, Product.shop_id == shop_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # 1. Resolve Business Policy IDs: request body overrides, else fall back
    # to the seller's saved defaults. Never fabricate one.
    saved_policies = {}
    if conn.channel_api_key:
        try:
            saved_policies = json.loads(conn.channel_api_key)
        except Exception:
            saved_policies = {}
    payment_policy_id = payload.payment_policy_id or saved_policies.get("payment_policy_id")
    fulfillment_policy_id = payload.fulfillment_policy_id or saved_policies.get("fulfillment_policy_id")
    return_policy_id = payload.return_policy_id or saved_policies.get("return_policy_id")
    if not (payment_policy_id and fulfillment_policy_id and return_policy_id):
        raise HTTPException(status_code=400, detail={
            "error": "no_business_policies",
            "message": "You haven't set up Business Policies on eBay yet. Set up at least one payment, fulfillment, and return policy on eBay first, then come back here.",
            "link": "https://www.ebay.com/help/selling/business-policies/business-policies-setup",
        })

    image_urls = [img.url for img in (product.images or []) if img.url]
    if not image_urls and product.image_url:
        image_urls = [product.image_url]
    if not image_urls:
        raise HTTPException(status_code=400, detail="This product has no images — eBay requires at least one")

    location_key = _ebay_ensure_inventory_location(conn, db, shop, marketplace_id)

    # 2. One SKU per real variant, or one SKU from the base product — same
    # logic Daraz's listing endpoint already uses.
    variants = product.variants or []
    skus = []
    if variants:
        for v in variants:
            skus.append({
                "sku": v.sku or f"{product.sku or product.id}-{v.id}",
                "quantity": v.quantity or 0,
                "price": float(v.price if v.price is not None else product.price),
                "image_urls": ([v.image_url] if v.image_url else []) + image_urls,
            })
    else:
        skus.append({
            "sku": product.sku or str(product.id),
            "quantity": product.quantity or 0,
            "price": float(product.price),
            "image_urls": image_urls,
        })

    created_listing_ids = []
    for sku_row in skus:
        sku = sku_row["sku"]

        # 3. PUT createOrReplaceInventoryItem
        inventory_body = {
            "condition": payload.condition,
            "product": {
                "title": product.name[:80],
                "description": product.description or product.name,
                "aspects": payload.aspect_values,
                "imageUrls": sku_row["image_urls"][:12],
            },
            "availability": {
                "shipToLocationAvailability": {"quantity": sku_row["quantity"]},
            },
        }
        resp = _ebay_api_request(
            "PUT", f"/sell/inventory/v1/inventory_item/{sku}", conn, db, marketplace_id, json=inventory_body,
        )
        if resp is None or resp.status_code >= 300:
            detail = resp.text[:500] if resp is not None else "no response"
            raise HTTPException(status_code=502, detail=f"eBay rejected the inventory item ({sku}): {detail}")

        # 4. POST createOffer
        offer_body = {
            "sku": sku,
            "marketplaceId": marketplace_id,
            "format": "FIXED_PRICE",
            "categoryId": payload.category_id,
            "listingPolicies": {
                "paymentPolicyId": payment_policy_id,
                "fulfillmentPolicyId": fulfillment_policy_id,
                "returnPolicyId": return_policy_id,
            },
            "pricingSummary": {
                "price": {"value": str(sku_row["price"]), "currency": "USD" if marketplace_id == "EBAY_US" else ("GBP" if marketplace_id == "EBAY_GB" else "CAD")},
            },
            "availableQuantity": sku_row["quantity"],
            "merchantLocationKey": location_key,
        }
        resp = _ebay_api_request("POST", "/sell/inventory/v1/offer", conn, db, marketplace_id, json=offer_body)
        offer_id = None
        if resp is not None and resp.status_code < 300:
            offer_id = resp.json().get("offerId")
        elif resp is not None and resp.status_code == 400:
            # A prior attempt for this SKU can leave an unpublished offer
            # behind (e.g. it failed at a later step). eBay refuses to
            # create a second one and hands back the existing offerId in
            # the error itself (errorId 25002) — reuse it instead of
            # treating "already exists" as a failure.
            try:
                for err in resp.json().get("errors", []):
                    if err.get("errorId") == 25002:
                        for param in err.get("parameters", []):
                            if param.get("name") == "offerId":
                                offer_id = param.get("value")
            except Exception:
                pass
            if offer_id:
                # That older offer was built before this request's values
                # (and may predate merchantLocationKey entirely, which is
                # what publish needs) — overwrite it so publishing uses
                # what the seller just submitted, not a stale draft.
                upd = _ebay_api_request(
                    "PUT", f"/sell/inventory/v1/offer/{offer_id}", conn, db, marketplace_id, json=offer_body,
                )
                if upd is None or upd.status_code >= 300:
                    detail = upd.text[:500] if upd is not None else "no response"
                    raise HTTPException(status_code=502, detail=f"eBay rejected updating the existing offer ({sku}): {detail}")
        if not offer_id:
            detail = resp.text[:500] if resp is not None else "no response"
            raise HTTPException(status_code=502, detail=f"eBay rejected the offer ({sku}): {detail}")

        # 5. POST publish
        resp = _ebay_api_request("POST", f"/sell/inventory/v1/offer/{offer_id}/publish", conn, db, marketplace_id)
        if resp is None or resp.status_code >= 300:
            detail = resp.text[:500] if resp is not None else "no response"
            raise HTTPException(status_code=502, detail=f"eBay rejected publishing the offer ({sku}): {detail}")
        listing_id = resp.json().get("listingId")
        if listing_id:
            created_listing_ids.append(listing_id)

    if not created_listing_ids:
        raise HTTPException(status_code=502, detail="eBay did not return a listing ID for any SKU")

    status_row = db.query(ChannelProductStatus).filter(
        ChannelProductStatus.product_id == product_id,
        ChannelProductStatus.channel_type == "ebay",
    ).first()
    if not status_row:
        status_row = ChannelProductStatus(product_id=product_id, shop_id=shop_id, channel_type="ebay")
        db.add(status_row)
    status_row.status = "approved"
    status_row.external_item_id = created_listing_ids[0]
    db.commit()

    _log_ebay_sync(db, shop_id, product_id, True)
    return {"listing_ids": created_listing_ids, "status": "approved"}


@router.get("/shops/{shop_id}/channels/ebay/products/{product_id}/listing")
def get_ebay_listing_status(
    shop_id: int,
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """On-demand refresh of a listing's current offer state — occupies the
    same URL "slot" as Daraz's qc-status endpoint, though eBay's publish is
    synchronous so this is a status re-check, not a pending-review poll."""
    shop = _shop_or_404(shop_id, current_user, db)
    conn = _get_ebay_connection(shop_id, db)
    marketplace_id = _ebay_marketplace_id(conn.seller_country)

    status_row = db.query(ChannelProductStatus).filter(
        ChannelProductStatus.product_id == product_id,
        ChannelProductStatus.channel_type == "ebay",
    ).first()
    if not status_row or not status_row.external_item_id:
        raise HTTPException(status_code=404, detail="This product hasn't been listed on eBay yet")

    sku = (db.query(Product).filter(Product.id == product_id).first() or Product()).sku or str(product_id)
    resp = _ebay_api_request("GET", "/sell/inventory/v1/offer", conn, db, marketplace_id, params={"sku": sku})
    if resp is None or resp.status_code >= 300:
        raise HTTPException(status_code=502, detail="Could not reach eBay — try again shortly")
    return {"status": status_row.status, "listing_id": status_row.external_item_id, "offers": resp.json().get("offers", [])}


# ── Orders + fulfillment — eBay has a real orders endpoint, no proxy needed ──

def fetch_ebay_orders(marketplace_id: str, start_iso: str, end_iso: str, conn: ChannelConnection, db: Session) -> list | None:
    """GET /sell/fulfillment/v1/order — full order + line items in one call,
    filtered by creation date window. Paginates via offset."""
    orders = []
    offset = 0
    limit = 200
    while True:
        resp = _ebay_api_request(
            "GET", "/sell/fulfillment/v1/order", conn, db, marketplace_id,
            params={
                "filter": f"creationdate:[{start_iso}..{end_iso}]",
                "limit": limit,
                "offset": offset,
            },
        )
        if resp is None or resp.status_code >= 300:
            logger.error(f"[EBAY ORDERS] getOrders failed — status={resp.status_code if resp else None}")
            return None if not orders else orders
        data = resp.json()
        batch = data.get("orders", [])
        orders.extend(batch)
        if len(batch) < limit:
            break
        offset += limit
    return orders


def sync_ebay_orders(conn: ChannelConnection, shop: Shop, db: Session, start_iso: str, end_iso: str) -> int:
    """Pulls in any eBay orders in the given window ExiusCart doesn't
    already have, matching line items to real products by SKU. Mirrors
    Daraz's sync_daraz_orders, but eBay's getOrders returns full line
    items directly — no separate GetOrderItems call needed."""
    from app.models.channel_order_meta import ChannelOrderMeta
    from app.models.order import Order, OrderItem
    from app.models.product_variant import ProductVariant
    import uuid as _uuid

    marketplace_id = _ebay_marketplace_id(conn.seller_country)
    orders_data = fetch_ebay_orders(marketplace_id, start_iso, end_iso, conn, db)
    if not orders_data:
        return 0

    order_ids = {o.get("orderId") for o in orders_data if o.get("orderId")}
    already_known = {
        m.channel_order_id for m in db.query(ChannelOrderMeta).filter(
            ChannelOrderMeta.channel_type == "ebay",
            ChannelOrderMeta.channel_order_id.in_(order_ids),
        ).all()
    }
    created = 0

    for ebay_order in orders_data:
        ebay_order_id = ebay_order.get("orderId")
        if not ebay_order_id or ebay_order_id in already_known:
            continue

        subtotal = 0.0
        order_items_to_add = []
        items_detail = []
        for line_item in ebay_order.get("lineItems", []):
            sku = line_item.get("sku")
            product = db.query(Product).filter(Product.shop_id == shop.id, Product.sku == sku).first() if sku else None
            if not product:
                variant = db.query(ProductVariant).filter(ProductVariant.sku == sku).first() if sku else None
                product = db.query(Product).filter(Product.id == variant.product_id).first() if variant else None
            if not product:
                logger.warning(f"[EBAY ORDERS] shop={shop.id} order_id={ebay_order_id} — no product matches SKU {sku!r}, skipping item")
                continue

            qty = int(line_item.get("quantity") or 1)
            unit_price = float((line_item.get("lineItemCost") or {}).get("value") or 0)
            item_total = unit_price * qty
            subtotal += item_total
            order_items_to_add.append(OrderItem(
                product_id=product.id,
                product_name=product.name,
                quantity=qty,
                unit_price=unit_price,
                total_price=item_total,
            ))
            items_detail.append({"sku": sku, "line_item_id": line_item.get("lineItemId"), "quantity": qty})

        if not order_items_to_add:
            logger.warning(f"[EBAY ORDERS] shop={shop.id} order_id={ebay_order_id} — no items matched any product, order not created")
            continue

        order = Order(
            order_number=f"EBAY-{ebay_order_id}-{str(_uuid.uuid4())[:4].upper()}",
            source="channel",
            subtotal=subtotal,
            total=subtotal,
            shop_id=shop.id,
            notes=f"eBay Order #{ebay_order_id}",
        )
        db.add(order)
        db.flush()
        for oi in order_items_to_add:
            oi.order_id = order.id
            db.add(oi)
        db.add(ChannelOrderMeta(
            order_id=order.id,
            channel_type="ebay",
            channel_order_id=ebay_order_id,
            items_detail=items_detail,
        ))
        created += 1

    if created:
        db.commit()
    return created


@router.post("/shops/{shop_id}/channels/ebay/sync-orders")
def sync_ebay_orders_now(
    shop_id: int,
    days: int = 7,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manually pull in any eBay orders from the last `days` days that
    ExiusCart doesn't already have."""
    shop = _shop_or_404(shop_id, current_user, db)
    conn = _get_ebay_connection(shop_id, db)

    days = min(max(days, 1), 90)
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days)
    created = sync_ebay_orders(conn, shop, db, start.strftime("%Y-%m-%dT%H:%M:%S.000Z"), end.strftime("%Y-%m-%dT%H:%M:%S.000Z"))
    return {"orders_created": created}


class EbayFulfillIn(BaseModel):
    tracking_number: str
    carrier_code: str


@router.post("/shops/{shop_id}/channels/ebay/orders/{order_id}/fulfill")
def fulfill_ebay_order(
    shop_id: int,
    order_id: int,
    data: EbayFulfillIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Pushes a tracking number back to eBay for an order already synced in
    via sync_ebay_orders — a capability Daraz's integration doesn't have
    yet, completing the order lifecycle."""
    from app.models.channel_order_meta import ChannelOrderMeta

    shop = _shop_or_404(shop_id, current_user, db)
    conn = _get_ebay_connection(shop_id, db)
    marketplace_id = _ebay_marketplace_id(conn.seller_country)

    meta = db.query(ChannelOrderMeta).filter(
        ChannelOrderMeta.order_id == order_id,
        ChannelOrderMeta.channel_type == "ebay",
    ).first()
    if not meta or not meta.channel_order_id:
        raise HTTPException(status_code=404, detail="This order isn't linked to an eBay order")

    line_item_ids = [d["line_item_id"] for d in (meta.items_detail or []) if d.get("line_item_id")]
    if not line_item_ids:
        raise HTTPException(status_code=400, detail="No eBay line items recorded for this order")

    body = {
        "lineItems": [{"lineItemId": lid} for lid in line_item_ids],
        "shippedDate": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z"),
        "shippingCarrierCode": data.carrier_code,
        "trackingNumber": data.tracking_number,
    }
    resp = _ebay_api_request(
        "POST", f"/sell/fulfillment/v1/order/{meta.channel_order_id}/shipping_fulfillment",
        conn, db, marketplace_id, json=body,
    )
    if resp is None or resp.status_code >= 300:
        detail = resp.text[:500] if resp is not None else "no response"
        raise HTTPException(status_code=502, detail=f"eBay rejected the fulfillment update: {detail}")
    return {"message": "Tracking sent to eBay"}


# ── Earnings / finance — mirrors Daraz's /earnings + /transactions shape ────

@router.get("/shops/{shop_id}/channels/ebay/earnings")
def get_ebay_earnings(
    shop_id: int,
    days: int = 90,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shop = _shop_or_404(shop_id, current_user, db)
    conn = _get_ebay_connection(shop_id, db)
    marketplace_id = _ebay_marketplace_id(conn.seller_country)

    days = min(max(days, 1), 365)
    since = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    resp = _ebay_api_request(
        "GET", "/sell/finances/v1/payout", conn, db, marketplace_id,
        params={"filter": f"payoutDate:[{since}..]"},
    )
    if resp is None or resp.status_code >= 300:
        raise HTTPException(status_code=502, detail="Could not reach eBay — try again shortly")
    return {"payouts": resp.json().get("payouts", [])}


@router.get("/shops/{shop_id}/channels/ebay/transactions")
def get_ebay_transactions(
    shop_id: int,
    start_time: str,
    end_time: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """start_time/end_time as ISO 8601 (e.g. 2026-01-01T00:00:00.000Z)."""
    shop = _shop_or_404(shop_id, current_user, db)
    conn = _get_ebay_connection(shop_id, db)
    marketplace_id = _ebay_marketplace_id(conn.seller_country)

    resp = _ebay_api_request(
        "GET", "/sell/finances/v1/transaction", conn, db, marketplace_id,
        params={"filter": f"transactionDate:[{start_time}..{end_time}]"},
    )
    if resp is None or resp.status_code >= 300:
        raise HTTPException(status_code=502, detail="Could not reach eBay — try again shortly")
    return {"transactions": resp.json().get("transactions", [])}
