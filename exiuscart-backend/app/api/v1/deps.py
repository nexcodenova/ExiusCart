from datetime import datetime, timezone
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User

security = HTTPBearer()

# A request to any of these is always allowed, even with an expired/no
# subscription — otherwise a shop that gets locked out could never reach the
# one flow (checking their plan, starting a real checkout, requesting a
# manual upgrade) that would let them fix it, and the dashboard shell/lock
# screen itself (which always calls GET /shops/me first, on every page load)
# would fail to even render. Matched as a substring against the request
# path, so /subscription/ covers every /shops/{id}/subscription/... route
# without hardcoding shop ids.
_SUBSCRIPTION_GATE_EXEMPT_SUBSTRINGS = ("/subscription/", "/shops/me")


def _is_subscription_expired(shop_id: int, db: Session) -> bool:
    from app.models.subscription import Subscription
    # A live row (active/trial/trial_dollar) always wins over a newer row in
    # any other status, even if that other row was created more recently.
    # Requesting a downgrade (POST /subscription/upgrade) inserts a fresh
    # pending_approval row while the real paid subscription is still live —
    # picking strictly "most recently created" would treat that pending
    # request as the shop's current status and lock out an already-paying
    # customer the instant they ask for a downgrade, before any admin has
    # even seen the request.
    sub = db.query(Subscription).filter(
        Subscription.shop_id == shop_id,
        Subscription.status.in_(("active", "trial", "trial_dollar")),
    ).order_by(Subscription.id.desc()).first()
    if not sub:
        sub = db.query(Subscription).filter(Subscription.shop_id == shop_id).order_by(Subscription.id.desc()).first()
    if not sub:
        return False  # no subscription row at all — nothing to enforce yet (e.g. mid-signup)
    if sub.status not in ("active", "trial", "trial_dollar"):
        return True
    if sub.expires_at is not None and sub.expires_at < datetime.now(timezone.utc):
        return True
    return False


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    token = credentials.credentials
    payload = decode_token(token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )

    # Customer-facing storefront tokens (get_current_customer below) are
    # signed with this same JWT_SECRET_KEY and would otherwise decode
    # successfully here too — a customer's token must never authenticate
    # as a seller. Seller tokens never carry this claim, so absence is
    # the normal case.
    if payload.get("type") == "customer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload"
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload"
        )

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if not user.is_active:
        # deactivation_reason lets the frontend show a specific message
        # ("refunded, contact support") instead of one generic one for
        # every reason an account might be blocked. Structured detail only
        # for the reasons that need their own message — plain string
        # otherwise, unchanged, since the frontend's existing deactivated-
        # account check matches on that exact string.
        if user.deactivation_reason == "refunded":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={
                "error": "account_refunded",
                "message": "Your account was refunded and has been blocked. Contact support for details.",
            })
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is deactivated"
        )

    # Real enforcement: a trial that ran out with no card, a $1 trial whose
    # card failed to renew, or any subscription past its expiry with no new
    # payment extending it, blocks every dashboard action from here — not
    # just a frontend hint, since that's trivially bypassed by calling the
    # API directly. Superusers (admin/support accounts) are never shop
    # owners with a subscription to enforce, so they're exempt outright.
    # Subscription/billing routes stay reachable no matter what, so a locked
    # shop can still see its status and pay to unlock — otherwise this would
    # lock them out of the one flow that fixes it.
    if not user.is_superuser and not any(s in request.url.path for s in _SUBSCRIPTION_GATE_EXEMPT_SUBSTRINGS):
        from app.models.shop import Shop
        shop = db.query(Shop).filter(Shop.owner_id == user.id).order_by(Shop.id.asc()).first()
        if shop and _is_subscription_expired(shop.id, db):
            raise HTTPException(status_code=402, detail={
                "error": "subscription_required",
                "message": "Your trial has ended. Upgrade your plan to keep using ExiusCart.",
            })
        if not shop:
            # Store staff own no shop, so the check above never applied to
            # them - without this, a team member could keep working in a shop
            # whose plan has lapsed. Same lock, worded for someone who isn't
            # the one who can fix it.
            from app.core.shop_access import find_staff_shop
            staff_shop = find_staff_shop(db, user)
            if staff_shop and _is_subscription_expired(staff_shop.id, db):
                # Deliberately NOT "subscription_required": the store app reloads
                # the page on that code so the owner lands on the Billing lock
                # screen. Staff can't open Billing, so the same code would put
                # them in an endless reload loop - they get a code of their own
                # that the dashboard shows as a plain "ask the owner" screen.
                raise HTTPException(status_code=402, detail={
                    "error": "store_plan_expired",
                    "message": "This store's plan has ended. Ask the store owner to renew it.",
                })

    return user


async def get_current_customer(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """Auth for storefront-customer-facing endpoints (checkout, wallet) —
    deliberately separate from get_current_user above. Customer tokens are
    signed with the same JWT_SECRET_KEY as seller tokens (one shared
    secret app-wide), so the `type: "customer"` claim is the only thing
    telling them apart — required here, and get_current_user above
    explicitly rejects it, so a token can never authenticate as both."""
    from app.models.customer import Customer

    token = credentials.credentials
    payload = decode_token(token)
    if payload is None or payload.get("type") != "customer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    customer_id = payload.get("sub")
    if customer_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    customer = db.query(Customer).filter(Customer.id == int(customer_id)).first()
    if customer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    if not customer.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")

    return customer
