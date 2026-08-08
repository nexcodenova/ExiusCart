from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User

security = HTTPBearer()


async def get_current_user(
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
