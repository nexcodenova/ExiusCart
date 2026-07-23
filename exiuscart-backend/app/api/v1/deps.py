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
