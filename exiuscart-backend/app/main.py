from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from app.api.v1.router import api_router
import app.models  # noqa: F401 — ensure all models are registered before create_all
import threading
import time
import logging

logger = logging.getLogger(__name__)


def _run_recurring_invoice_scheduler():
    """Background daemon thread: check and send due recurring invoices every 12 hours."""
    while True:
        try:
            _process_due_recurring_invoices()
        except Exception as exc:
            logger.error(f"[RecurringInvoice scheduler] {exc}")
        time.sleep(12 * 3600)


def _process_due_recurring_invoices():
    from datetime import date
    from app.models.recurring_invoice import RecurringInvoice
    from app.models.shop import Shop
    from app.core.email import send_recurring_invoice_email

    db = SessionLocal()
    try:
        today = date.today()
        due = (
            db.query(RecurringInvoice)
            .filter(RecurringInvoice.is_active == True, RecurringInvoice.next_send_date <= today)
            .all()
        )
        for ri in due:
            if not ri.customer_email:
                continue
            shop = db.query(Shop).filter(Shop.id == ri.shop_id).first()
            if not shop:
                continue
            try:
                from datetime import datetime, timezone, timedelta
                year = datetime.now(timezone.utc).year
                count = (ri.send_count or 0) + 1
                inv_num = f"RI-{year}-{ri.shop_id:03d}-{count:04d}"
                send_recurring_invoice_email(
                    to_email=ri.customer_email,
                    customer_name=ri.customer_name,
                    shop_name=shop.name,
                    shop_logo_url=shop.logo_url,
                    invoice_number=inv_num,
                    items=ri.items,
                    subtotal=float(ri.subtotal),
                    discount=float(ri.discount),
                    tax=float(ri.tax),
                    total=float(ri.total),
                    notes=ri.notes,
                    currency=shop.currency or "USD",
                )
                ri.last_sent_at = datetime.now(timezone.utc)
                ri.send_count = count
                # Advance next_send_date by frequency
                freq = ri.frequency
                nd = ri.next_send_date
                if freq == "weekly":
                    nd = nd + timedelta(days=7)
                elif freq == "monthly":
                    m = nd.month + 1; y = nd.year + (m - 1) // 12; m = (m - 1) % 12 + 1
                    nd = nd.replace(year=y, month=m)
                elif freq == "quarterly":
                    m = nd.month + 3; y = nd.year + (m - 1) // 12; m = (m - 1) % 12 + 1
                    nd = nd.replace(year=y, month=m)
                else:
                    nd = nd.replace(year=nd.year + 1)
                ri.next_send_date = nd
                logger.info(f"[RecurringInvoice] Sent {inv_num} to {ri.customer_email}")
            except Exception as e:
                logger.error(f"[RecurringInvoice] Failed to send ri_id={ri.id}: {e}")
        db.commit()
    finally:
        db.close()

# Create any missing tables (safe for existing tables)
Base.metadata.create_all(bind=engine)

# Run safe column migrations — each statement is independent so one failure never blocks the rest
_sa_text = __import__('sqlalchemy').text
_MIGRATIONS = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT TRUE NOT NULL;",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS source_url VARCHAR(1000);",
    "ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);",
    "ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);",
    "ALTER TABLE order_items ALTER COLUMN product_id DROP NOT NULL;",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL;",
    "ALTER TABLE shop_leads ADD COLUMN IF NOT EXISTS score INTEGER NOT NULL DEFAULT 0;",
    "ALTER TABLE shop_leads ADD COLUMN IF NOT EXISTS score_breakdown JSONB;",
    # Quotation columns
    "ALTER TABLE quotations ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0;",
    "ALTER TABLE quotations ADD COLUMN IF NOT EXISTS tax_type VARCHAR(10) NOT NULL DEFAULT 'fixed';",
    "ALTER TABLE quotations ADD COLUMN IF NOT EXISTS payment_schedule JSONB;",
    "ALTER TABLE quotations ADD COLUMN IF NOT EXISTS company_address TEXT;",
    "ALTER TABLE quotations ADD COLUMN IF NOT EXISTS company_trn VARCHAR(100);",
    "ALTER TABLE quotations ADD COLUMN IF NOT EXISTS company_bank TEXT;",
    "ALTER TABLE quotations ADD COLUMN IF NOT EXISTS client_token VARCHAR(64);",
    "ALTER TABLE quotations ADD COLUMN IF NOT EXISTS client_accepted_at TIMESTAMPTZ;",
    "ALTER TABLE quotations ADD COLUMN IF NOT EXISTS client_accepted_name VARCHAR(200);",
    "ALTER TABLE quotations ADD COLUMN IF NOT EXISTS reminder_count INTEGER NOT NULL DEFAULT 0;",
    "ALTER TABLE quotations ADD COLUMN IF NOT EXISTS last_reminded_at TIMESTAMPTZ;",
    # Unique constraint on client_token (safe to re-run — DO NOTHING on conflict)
    "ALTER TABLE quotations ADD CONSTRAINT uq_quotations_client_token UNIQUE (client_token);",
    "CREATE INDEX IF NOT EXISTS ix_quotations_client_token ON quotations(client_token) WHERE client_token IS NOT NULL;",
    # Wholesale index
    "CREATE INDEX IF NOT EXISTS ix_wholesale_buyers_token ON wholesale_buyers(token);",
    # Fix quote_number uniqueness: was global, must be per-shop so each shop has its own QT sequence
    "ALTER TABLE quotations DROP CONSTRAINT IF EXISTS quotations_quote_number_key;",
    "ALTER TABLE quotations ADD CONSTRAINT uq_quotations_shop_quote_number UNIQUE (shop_id, quote_number);",
    # Storefront profile fields (TheDersi sync + ExiusCart branding)
    "ALTER TABLE shops ADD COLUMN IF NOT EXISTS about_text TEXT;",
    "ALTER TABLE shops ADD COLUMN IF NOT EXISTS social_instagram VARCHAR(300);",
    "ALTER TABLE shops ADD COLUMN IF NOT EXISTS social_tiktok VARCHAR(300);",
    "ALTER TABLE shops ADD COLUMN IF NOT EXISTS social_facebook VARCHAR(300);",
    "ALTER TABLE shops ADD COLUMN IF NOT EXISTS brand_color VARCHAR(7);",
    "ALTER TABLE shops ADD COLUMN IF NOT EXISTS accent_color VARCHAR(7);",
    "ALTER TABLE shops ADD COLUMN IF NOT EXISTS font_family VARCHAR(50);",
    # TheDersi per-channel seller status (approved | suspended | rejected)
    "ALTER TABLE channel_connections ADD COLUMN IF NOT EXISTS seller_status VARCHAR(20);",
    # Affiliate click tracking
    "ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS total_clicks INTEGER DEFAULT 0;",
    # Affiliate payout requests table
    """CREATE TABLE IF NOT EXISTS affiliate_payout_requests (
        id SERIAL PRIMARY KEY,
        affiliate_id INTEGER NOT NULL REFERENCES affiliates(id),
        amount NUMERIC(10,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        payout_method VARCHAR(20),
        payout_address VARCHAR(255),
        status VARCHAR(20) DEFAULT 'pending',
        admin_notes TEXT,
        requested_at TIMESTAMPTZ DEFAULT NOW(),
        paid_at TIMESTAMPTZ
    );""",
    # Back-fill: free_trial subscription for verified shops that have none
    """INSERT INTO subscriptions (shop_id, plan_type, billing_type, status, amount_paid, currency, created_at)
       SELECT s.id, 'free_trial', 'monthly', 'pending_approval', 0, COALESCE(s.currency, 'AED'), NOW()
       FROM shops s JOIN users u ON u.id = s.owner_id
       WHERE u.is_verified = TRUE
         AND NOT EXISTS (SELECT 1 FROM subscriptions sub WHERE sub.shop_id = s.id);""",
    # Affiliate commission model — chosen at application, locked forever
    "ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS commission_model VARCHAR(20) DEFAULT 'one_time';",
    "ALTER TABLE commissions ADD COLUMN IF NOT EXISTS commission_type VARCHAR(20) DEFAULT 'one_time';",
    "ALTER TABLE commissions ADD COLUMN IF NOT EXISTS period_month INTEGER;",
]

for _sql in _MIGRATIONS:
    try:
        with engine.connect() as _conn:
            _conn.execute(_sa_text(_sql))
            _conn.commit()
    except Exception as _e:
        logger.warning(f"[migration] skipped (already applied or harmless): {_e!r:.120}")




app = FastAPI(
    title=settings.APP_NAME,
    description="ExiusCart - Smart Business Management API for Small Shops",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Start recurring invoice background scheduler
_scheduler_thread = threading.Thread(target=_run_recurring_invoice_scheduler, daemon=True)
_scheduler_thread.start()

# Start drip flow runner (every 5 minutes)
def _run_drip_flow_scheduler():
    while True:
        try:
            from app.api.v1.endpoints.marketing import process_drip_flows_job
            process_drip_flows_job()
        except Exception as exc:
            logger.error(f"[DripFlow scheduler] {exc}")
        time.sleep(5 * 60)

_drip_thread = threading.Thread(target=_run_drip_flow_scheduler, daemon=True)
_drip_thread.start()

# Start CJ tracking sync (every 2 hours)
def _run_cj_tracking_scheduler():
    while True:
        try:
            from app.api.v1.endpoints.dropshipping import sync_cj_tracking_job
            sync_cj_tracking_job(SessionLocal)
        except Exception as exc:
            logger.error(f"[CJ Tracking scheduler] {exc}")
        time.sleep(2 * 3600)

_cj_tracking_thread = threading.Thread(target=_run_cj_tracking_scheduler, daemon=True)
_cj_tracking_thread.start()

# Start recurring affiliate commission generator (checked daily, fires ~monthly per referral)
def _run_affiliate_recurring_scheduler():
    while True:
        try:
            from app.api.v1.endpoints.admin import generate_recurring_affiliate_commissions
            generate_recurring_affiliate_commissions()
        except Exception as exc:
            logger.error(f"[Affiliate Recurring scheduler] {exc}")
        time.sleep(24 * 3600)

_affiliate_recurring_thread = threading.Thread(target=_run_affiliate_recurring_scheduler, daemon=True)
_affiliate_recurring_thread.start()

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
