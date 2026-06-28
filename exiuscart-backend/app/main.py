from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from app.api.v1.router import api_router
import app.models  # noqa: F401 — ensure all models are registered before create_all

# Create any missing tables (safe for existing tables)
Base.metadata.create_all(bind=engine)

# Run safe column migrations for existing tables
with engine.connect() as conn:
    conn.execute(__import__('sqlalchemy').text(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT TRUE NOT NULL;"
    ))
    conn.execute(__import__('sqlalchemy').text(
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS source_url VARCHAR(1000);"
    ))
    conn.execute(__import__('sqlalchemy').text(
        "ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);"
    ))
    conn.execute(__import__('sqlalchemy').text(
        "ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);"
    ))
    conn.execute(__import__('sqlalchemy').text(
        "ALTER TABLE order_items ALTER COLUMN product_id DROP NOT NULL;"
    ))
    # Back-fill: create pending_approval subscriptions for verified shops that have none
    conn.execute(__import__('sqlalchemy').text("""
        INSERT INTO subscriptions (shop_id, plan_type, billing_type, status, amount_paid, currency, created_at)
        SELECT s.id, 'free_trial', 'monthly', 'pending_approval', 0, COALESCE(s.currency, 'AED'), NOW()
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
