import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token
from app.models.user import User
from app.models.shop import Shop
from app.schemas.user import UserCreate, UserResponse, UserLogin, Token


def _slugify(text: str) -> str:
    return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')

router = APIRouter()


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    display_name = user_data.owner_name or user_data.full_name or "Shop Owner"
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        email=user_data.email,
        hashed_password=hashed_password,
        full_name=display_name,
        phone=user_data.phone,
        referred_by_code=user_data.ref_code or None,
        country=user_data.country or None,
    )
    db.add(new_user)
    db.flush()

    # Auto-create shop if shop_name provided
    if user_data.shop_name:
        slug = f"{_slugify(user_data.shop_name)}-{uuid.uuid4().hex[:6]}"
        currency = "AED" if user_data.country == "AE" else "USD"
        shop = Shop(
            name=user_data.shop_name,
            slug=slug,
            owner_id=new_user.id,
            currency=currency,
            country=user_data.country or "UAE",
        )
        db.add(shop)

    db.commit()
    db.refresh(new_user)

    access_token = create_access_token(data={"sub": str(new_user.id)})
    return Token(
        access_token=access_token,
        user=UserResponse.model_validate(new_user)
    )


@router.post("/login", response_model=Token)
async def login(credentials: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == credentials.email).first()

    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated"
        )

    access_token = create_access_token(data={"sub": str(user.id)})

    return Token(
        access_token=access_token,
        is_superuser=user.is_superuser,
        user=UserResponse.model_validate(user)
    )


# ── TheDersi seller first-time setup ─────────────────────────────────────────

class SetupPasswordIn(BaseModel):
    token: str
    password: str


@router.post("/setup-password", response_model=Token)
def setup_password(data: SetupPasswordIn, db: Session = Depends(get_db)):
    """
    Redeems a one-time setup link issued during TheDersi provision.
    Token is a signed JWT (purpose=setup_password, exp=48h).
    Sets the seller's password and returns an access token so they're immediately logged in.
    """
    try:
        payload = jwt.decode(
            data.token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except JWTError:
        raise HTTPException(status_code=400, detail="Setup link is invalid or has expired")

    if payload.get("purpose") != "setup_password":
        raise HTTPException(status_code=400, detail="Invalid token purpose")

    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="Account not found")

    if len(data.password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")

    user.hashed_password = get_password_hash(data.password)
    user.is_active = True
    db.commit()
    db.refresh(user)

    access_token = create_access_token(data={"sub": str(user.id)})
    return Token(access_token=access_token, user=UserResponse.model_validate(user))
