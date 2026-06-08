from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from slugify import slugify
import uuid
from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token
from app.models.user import User
from app.models.shop import Shop
from app.schemas.user import UserCreate, UserResponse, UserLogin, Token

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
        base_slug = slugify(user_data.shop_name)
        slug = f"{base_slug}-{uuid.uuid4().hex[:6]}"
        currency = "AED" if user_data.country == "AE" else "LKR" if user_data.country == "LK" else "USD"
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
