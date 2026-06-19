from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.core.database import engine, Base
from app.api.v1.router import api_router
import app.models  # noqa: F401 — ensure all models are registered before create_all
import os

# Create any missing tables (safe for existing tables)
Base.metadata.create_all(bind=engine)

# Run safe column migrations for existing tables
with engine.connect() as conn:
    conn.execute(__import__('sqlalchemy').text(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT TRUE NOT NULL;"
    ))
    # Back-fill: create free_trial subscriptions for verified shops that have none
    conn.execute(__import__('sqlalchemy').text("""
        INSERT INTO subscriptions (shop_id, plan_type, billing_type, status, amount_paid, currency, starts_at, trial_ends_at, expires_at, created_at)
        SELECT s.id, 'free_trial', 'monthly', 'trial', 0, COALESCE(s.currency, 'AED'),
               NOW(), NOW() + INTERVAL '14 days', NOW() + INTERVAL '14 days', NOW()
        FROM shops s
        JOIN users u ON u.id = s.owner_id
        WHERE u.is_verified = TRUE
          AND NOT EXISTS (
              SELECT 1 FROM subscriptions sub WHERE sub.shop_id = s.id
          );
    """))
    conn.commit()

app = FastAPI(
    title=settings.APP_NAME,
    description="ExiusCart - Smart Business Management API for Small Shops",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router, prefix=settings.API_V1_PREFIX)

# Serve locally-uploaded product images (fallback when R2 is not used)
_uploads_dir = "uploads/products"
os.makedirs(_uploads_dir, exist_ok=True)
app.mount("/static/products", StaticFiles(directory=_uploads_dir), name="static-products")


@app.get("/")
async def root():
    return {
        "message": "Welcome to ExiusCart API",
        "docs": "/docs",
        "version": "1.0.0"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
