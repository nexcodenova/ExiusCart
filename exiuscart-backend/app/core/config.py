from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # App
    APP_NAME: str = "ExiusCart API"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"

    # Database
    DATABASE_URL: str

    # JWT
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # TheDersi partner integration
    THEDERSI_PARTNER_KEY: str = ""
    THEDERSI_HMAC_SECRET: str = ""
    THEDERSI_WEBHOOK_URL: str = "https://thedersi.lk/api/exiuscart/webhook"

    # Noon partner integration (single ExiusCart-wide service account, not per-seller)
    NOON_KEY_ID: str = ""
    NOON_PRIVATE_KEY: str = ""
    NOON_CHANNEL_IDENTIFIER: str = ""
    NOON_PROJECT_CODE: str = ""

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()
