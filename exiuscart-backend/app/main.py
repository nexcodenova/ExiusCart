from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.responses import JSONResponse
from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from app.core.rate_limit import limiter
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
                    shop_id=ri.shop_id,
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
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS prodora_code VARCHAR(20);",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS is_bestseller BOOLEAN NOT NULL DEFAULT FALSE;",
    "ALTER TABLE categories ADD COLUMN IF NOT EXISTS prodora_managed BOOLEAN NOT NULL DEFAULT FALSE;",
    # Categories an admin already gave a tile image were curated by hand.
    "UPDATE categories SET prodora_managed = TRUE WHERE image_url IS NOT NULL AND shop_id IN (SELECT id FROM shops WHERE slug = 'exiuscart-dropshipping-system');",
    "CREATE INDEX IF NOT EXISTS ix_products_prodora_code ON products (prodora_code);",
    "ALTER TABLE prodora_digital_bundles ADD COLUMN IF NOT EXISTS code VARCHAR(20);",
    "ALTER TABLE prodora_digital_bundles ADD COLUMN IF NOT EXISTS is_trending BOOLEAN NOT NULL DEFAULT FALSE;",
    "ALTER TABLE prodora_digital_bundles ADD COLUMN IF NOT EXISTS is_bestseller BOOLEAN NOT NULL DEFAULT FALSE;",
    "ALTER TABLE prodora_import_logs ADD COLUMN IF NOT EXISTS source_product_id INTEGER;",
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
    "ALTER TABLE quotations ADD COLUMN IF NOT EXISTS customer_company VARCHAR(200);",
    "ALTER TABLE prodora_digital_purchases ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ;",
    "ALTER TABLE customers ADD COLUMN IF NOT EXISTS country VARCHAR(2);",
    "ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;",
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
    # Back-fill: free_trial subscription for verified shops that have none.
    # Status is 'trial' (immediate access, 7-day countdown) rather than
    # 'pending_approval' — the approval gate was removed from every real
    # signup path, so a backfilled orphaned shop must never be the one place
    # that still locks someone behind manual review.
    """INSERT INTO subscriptions (shop_id, plan_type, billing_type, status, amount_paid, currency, created_at, trial_ends_at, expires_at)
       SELECT s.id, 'launch', 'monthly', 'trial', 0, COALESCE(s.currency, 'USD'), NOW(), NOW() + INTERVAL '7 days', NOW() + INTERVAL '7 days'
       FROM shops s JOIN users u ON u.id = s.owner_id
       WHERE u.is_verified = TRUE
         AND s.slug NOT IN ('exiuscart-website', 'exiuscart-dropshipping-system', 'prodora-website', 'affiliate-website')
         AND NOT EXISTS (SELECT 1 FROM subscriptions sub WHERE sub.shop_id = s.id);""",
    # Internal shops (blog + catalogue) are not customers; remove the trial
    # rows earlier versions of the back-fill above gave them.
    """DELETE FROM subscriptions
       WHERE status = 'trial' AND COALESCE(amount_paid, 0) = 0
         AND shop_id IN (SELECT id FROM shops WHERE slug IN ('exiuscart-website', 'exiuscart-dropshipping-system', 'prodora-website', 'affiliate-website'));""",
    # Affiliate commission model — chosen at application, locked forever
    "ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS commission_model VARCHAR(20) DEFAULT 'one_time';",
    "ALTER TABLE commissions ADD COLUMN IF NOT EXISTS commission_type VARCHAR(20) DEFAULT 'one_time';",
    "ALTER TABLE commissions ADD COLUMN IF NOT EXISTS period_month INTEGER;",
    # Lemon Squeezy payment gateway
    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_source VARCHAR(20) DEFAULT 'manual';",
    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS lemon_squeezy_subscription_id VARCHAR(100);",
    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS lemon_squeezy_customer_id VARCHAR(100);",
    "CREATE UNIQUE INDEX IF NOT EXISTS ix_subscriptions_ls_sub_id ON subscriptions(lemon_squeezy_subscription_id) WHERE lemon_squeezy_subscription_id IS NOT NULL;",
    "ALTER TABLE commissions ADD COLUMN IF NOT EXISTS subscription_payment_id INTEGER REFERENCES subscription_payments(id);",
    # TheDersi auto-payout opt-in
    "ALTER TABLE channel_connections ADD COLUMN IF NOT EXISTS auto_payout_enabled BOOLEAN DEFAULT FALSE;",
    "ALTER TABLE channel_connections ADD COLUMN IF NOT EXISTS last_auto_payout_attempt_at TIMESTAMPTZ;",
    # Free Gift items (TheDersi checkout) — seller marks a product as a free gift,
    # order line items carry the flag through so sellers know to still pack/ship it
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS is_gift BOOLEAN NOT NULL DEFAULT FALSE;",
    "ALTER TABLE order_items ADD COLUMN IF NOT EXISTS is_gift BOOLEAN NOT NULL DEFAULT FALSE;",
    # Daraz OAuth2 connect flow
    "ALTER TABLE channel_connections ADD COLUMN IF NOT EXISTS access_token VARCHAR(1000);",
    "ALTER TABLE channel_connections ADD COLUMN IF NOT EXISTS refresh_token VARCHAR(1000);",
    "ALTER TABLE channel_connections ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;",
    "ALTER TABLE channel_connections ADD COLUMN IF NOT EXISTS oauth_state VARCHAR(100);",
    # Lemon Squeezy refund handling
    "ALTER TABLE subscription_payments ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;",
    # Link commissions to the exact payout request that covers them, so a
    # refund/reversal or a newly-approved commission can never change what a
    # payout actually settles after the fact.
    "ALTER TABLE commissions ADD COLUMN IF NOT EXISTS payout_request_id INTEGER REFERENCES affiliate_payout_requests(id);",
    # Per-channel product listing (POS gets its own dedicated columns since
    # it isn't a ChannelConnection; other channels use product_channel_categories).
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS pos_enabled BOOLEAN DEFAULT TRUE NOT NULL;",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS pos_is_gift BOOLEAN DEFAULT FALSE NOT NULL;",
    # is_listed defaults TRUE on backfill only, so existing category
    # assignments (which implied "listed" under the old system) aren't
    # silently unlisted; new rows going forward start FALSE per the model
    # until a seller explicitly toggles the channel on.
    "ALTER TABLE product_channel_categories ADD COLUMN IF NOT EXISTS is_listed BOOLEAN DEFAULT TRUE NOT NULL;",
    "ALTER TABLE product_channel_categories ADD COLUMN IF NOT EXISTS is_gift BOOLEAN DEFAULT FALSE NOT NULL;",
    "ALTER TABLE product_channel_categories ALTER COLUMN channel_category_id DROP NOT NULL;",
    "ALTER TABLE product_channel_categories ALTER COLUMN channel_category_name DROP NOT NULL;",
    # Generic per-connection automation settings — {auto_sync_orders: bool,
    # sync_frequency_minutes: int, last_auto_synced_at is tracked separately
    # below since it needs indexed/typed access from the scheduler, not just
    # JSON}. Channel-agnostic on purpose so any channel's own scheduler can
    # read/write the same shape instead of each getting bespoke columns.
    "ALTER TABLE channel_connections ADD COLUMN IF NOT EXISTS sync_settings JSONB;",
    "ALTER TABLE channel_connections ADD COLUMN IF NOT EXISTS last_auto_synced_at TIMESTAMPTZ;",
    # Freeform customer labels ("Wholesale", "Ambassador", etc.) set by the
    # seller from the Customers page — separate from the auto-computed
    # VIP/New/Returning segment, which stays derived rather than stored.
    "ALTER TABLE customers ADD COLUMN IF NOT EXISTS tags JSONB;",
    # Discounts (direct store + POS only, see models/discount.py) — the
    # `discounts` table itself is new and created by Base.metadata.create_all
    # below; this only needs to add the coupon-code reference column onto
    # the pre-existing orders table.
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_code VARCHAR(50);",
    # Gift Cards phase 1 — just the flag on the product itself for now (see
    # models/product.py); code issuance/redemption is a later phase.
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS is_gift_card BOOLEAN NOT NULL DEFAULT FALSE;",
    # channel_api_key/access_token/refresh_token are already TEXT — no schema
    # change needed for those to become encrypted (see app/core/encryption.py's
    # EncryptedText). gateway_merchant_secret was VARCHAR(255); widened since
    # an encrypted value is longer than the original secret.
    "ALTER TABLE channel_connections ALTER COLUMN gateway_merchant_secret TYPE TEXT;",
    # Per-platform posting options chosen at compose time (TikTok privacy
    # level, comment/duet/stitch, commercial disclosure) — must persist since
    # a post can be scheduled for later, not just published instantly.
    "ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS platform_options_json TEXT;",
    # Real trial state machine: Launch = 7 days free (trial_ends_at), then
    # full billing directly (no $1 stage). Growth/Scale (no free week) = $1
    # for 7 days (trial_dollar_ends_at), then full billing. See
    # app/core/lemonsqueezy.py and app/core/subscription_lifecycle.py.
    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_dollar_ends_at TIMESTAMPTZ;",
    # Plan rename: ExiusCart's own plans are "launch"/"growth"/"scale"
    # everywhere in code now, never "starter"/"premium" — rename any
    # existing rows so the database matches. TheDersi's own tier names were
    # untouched at the time this ran — see the separate TheDersi migration
    # a few lines below for their later restructure.
    "UPDATE subscriptions SET plan_type = 'launch' WHERE plan_type = 'starter';",
    "UPDATE subscriptions SET plan_type = 'scale' WHERE plan_type = 'premium';",
    "UPDATE subscription_payments SET plan_type = 'launch' WHERE plan_type = 'starter';",
    # plan_type was created as VARCHAR(20), but "thedersi_free_forever" is 21
    # characters: the rename below failed silently at every startup (the two
    # legacy rows kept "thedersi_basic") and saving a new Free Forever seller
    # would have failed. Widen first; growing a varchar is instant in Postgres.
    # Store Profile page: these two were in the form and the schema but had no column, so they were never saved.
    "ALTER TABLE shops ADD COLUMN IF NOT EXISTS website VARCHAR(300);",
    "ALTER TABLE shops ADD COLUMN IF NOT EXISTS trade_license VARCHAR(100);",
    "ALTER TABLE subscriptions ALTER COLUMN plan_type TYPE VARCHAR(30);",
    "ALTER TABLE subscription_payments ALTER COLUMN plan_type TYPE VARCHAR(30);",
    # 2026-09-17 TheDersi plan restructure: thedersi_basic → thedersi_free_forever
    # (own name, same limits), thedersi_pro → launch (Pro now shares Launch's
    # real plan_type/feature set, with Pro-specific restrictions layered on
    # via is_thedersi_pro_shop() rather than a distinct plan_type — see
    # app/core/thedersi.py). No existing row needs to become thedersi_lite;
    # any live TheDersi seller synced under the old "growth" tier name is
    # still recognized (THEDERSI_TIER_MAP keeps "growth" mapped to
    # thedersi_lite going forward), this migration is only about existing
    # subscription rows already stored under the two retired plan_type values.
    "UPDATE subscriptions SET plan_type = 'thedersi_free_forever' WHERE plan_type = 'thedersi_basic';",
    "UPDATE subscriptions SET plan_type = 'launch' WHERE plan_type = 'thedersi_pro';",
    "UPDATE subscription_payments SET plan_type = 'thedersi_free_forever' WHERE plan_type = 'thedersi_basic';",
    "UPDATE subscription_payments SET plan_type = 'launch' WHERE plan_type = 'thedersi_pro';",
    "UPDATE subscription_payments SET plan_type = 'scale' WHERE plan_type = 'premium';",
    # Visitor country on storefront view events (Customers/Orders/Views by country).
    "ALTER TABLE storefront_events ADD COLUMN IF NOT EXISTS country VARCHAR(2);",
    "CREATE INDEX IF NOT EXISTS ix_storefront_events_country ON storefront_events (country);",
    # There is no separate "Free Trial" plan any more: every account trials a
    # real plan with all of its features (Launch = 7 days free). Move accounts
    # still trialling on the old restricted free_trial plan onto Launch.
    # TheDersi shops are excluded, since Launch means "Pro" for them.
    "UPDATE subscriptions SET plan_type = 'launch' WHERE plan_type = 'free_trial' AND status = 'trial' AND shop_id NOT IN (SELECT shop_id FROM channel_connections WHERE channel_type = 'thedersi' AND shop_id IS NOT NULL);",
    "UPDATE partner_licenses SET plan_type = 'launch' WHERE plan_type = 'starter';",
    "UPDATE partner_licenses SET plan_type = 'scale' WHERE plan_type = 'premium';",
    # Site blogs (exiuscart / prodora / affiliate) no longer live on hidden shops.
    "ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS site VARCHAR(20);",
    "ALTER TABLE blog_posts ALTER COLUMN shop_id DROP NOT NULL;",
    "CREATE INDEX IF NOT EXISTS ix_blog_posts_site ON blog_posts (site);",
    # 1. move every post off the hidden blog shops and onto its site
    """UPDATE blog_posts b
       SET site = CASE s.slug WHEN 'exiuscart-website' THEN 'exiuscart' WHEN 'prodora-website' THEN 'prodora' ELSE 'affiliate' END,
           shop_id = NULL
       FROM shops s
       WHERE b.shop_id = s.id AND s.slug IN ('exiuscart-website', 'prodora-website', 'affiliate-website');""",
    # 2. then delete those shops (and anything hanging off them). If a foreign
    #    key still points at one of them this simply fails and is skipped; the
    #    shop is then only an unused row that the admin lists already hide.
    "DELETE FROM subscriptions WHERE shop_id IN (SELECT id FROM shops WHERE slug IN ('exiuscart-website', 'prodora-website', 'affiliate-website'));",
    "DELETE FROM shops WHERE slug IN ('exiuscart-website', 'prodora-website', 'affiliate-website');",
    # Prodora's catalogue belongs to the platform, not to a hidden shop. Products,
    # categories, supplier links and the CJ / AliExpress connections are kept and
    # simply detached (shop_id NULL); then the hidden shop itself is deleted.
    "ALTER TABLE products ALTER COLUMN shop_id DROP NOT NULL;",
    "ALTER TABLE categories ALTER COLUMN shop_id DROP NOT NULL;",
    "ALTER TABLE dropship_connections ALTER COLUMN shop_id DROP NOT NULL;",
    "ALTER TABLE dropship_product_links ALTER COLUMN shop_id DROP NOT NULL;",
    "UPDATE products SET shop_id = NULL WHERE shop_id IN (SELECT id FROM shops WHERE slug = 'exiuscart-dropshipping-system');",
    "UPDATE categories SET shop_id = NULL WHERE shop_id IN (SELECT id FROM shops WHERE slug = 'exiuscart-dropshipping-system');",
    "UPDATE dropship_product_links SET shop_id = NULL WHERE shop_id IN (SELECT id FROM shops WHERE slug = 'exiuscart-dropshipping-system');",
    "UPDATE dropship_connections SET shop_id = NULL WHERE shop_id IN (SELECT id FROM shops WHERE slug = 'exiuscart-dropshipping-system');",
    # Ad videos on catalogue products were the row that blocked deleting the shop.
    "ALTER TABLE product_ad_videos ALTER COLUMN shop_id DROP NOT NULL;",
    "UPDATE product_ad_videos SET shop_id = NULL WHERE shop_id IN (SELECT id FROM shops WHERE slug = 'exiuscart-dropshipping-system');",
    "DELETE FROM subscriptions WHERE shop_id IN (SELECT id FROM shops WHERE slug = 'exiuscart-dropshipping-system');",
    "DELETE FROM shops WHERE slug = 'exiuscart-dropshipping-system';",
    # audit_logs was first created with plain foreign keys (no ON DELETE), so Postgres
    # would refuse to delete any user or store that has log rows. The log is meant to
    # outlive them (actor_email/name are snapshotted for exactly that) -> SET NULL.
    """DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audit_logs_actor_user_id_fkey' AND confdeltype <> 'n') THEN
            ALTER TABLE audit_logs DROP CONSTRAINT audit_logs_actor_user_id_fkey;
            ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL;
        END IF;
    END $$;""",
    """DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audit_logs_shop_id_fkey' AND confdeltype <> 'n') THEN
            ALTER TABLE audit_logs DROP CONSTRAINT audit_logs_shop_id_fkey;
            ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE SET NULL;
        END IF;
    END $$;""",
]

for _sql in _MIGRATIONS:
    try:
        with engine.connect() as _conn:
            _conn.execute(_sa_text(_sql))
            _conn.commit()
    except Exception as _e:
        logger.warning(f"[migration] skipped (already applied or harmless): {_e!r:.120}")


from app.core.system_shops import purge_hidden_system_shops, purge_expired_free_trials
purge_hidden_system_shops(engine, Base)
purge_expired_free_trials(engine)




app = FastAPI(
    title=settings.APP_NAME,
    description="ExiusCart - Smart Business Management API for Small Shops",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Rate limiting — see app/core/rate_limit.py for the key function (real
# client IP via nginx's X-Real-IP) and why in-memory storage is deliberate
# here. Applied per-endpoint via @limiter.limit(...) on the public,
# no-auth storefront routes (public.py, checkout.py, wallet.py,
# digital_delivery.py, blog.py) — see those files for the actual limits.
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)


@app.exception_handler(RateLimitExceeded)
async def _rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(status_code=429, content={"detail": "Too many requests. Please try again shortly."})

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

# Start abandoned-cart checker (every 15 minutes) — matches checkout attempts
# against real orders and enrolls genuinely-abandoned ones into cart_abandoned
# Drip Flows. Runs more often than the 5-min drip runner above needs to be
# accurate about, but the window itself (1hr/24hr, seller-configured) is what
# actually controls how soon a shopper gets followed up with, not this interval.
def _run_abandoned_cart_scheduler():
    while True:
        try:
            from app.api.v1.endpoints.marketing import sync_abandoned_carts_job
            sync_abandoned_carts_job()
        except Exception as exc:
            logger.error(f"[Abandoned Cart scheduler] {exc}")
        time.sleep(15 * 60)

_abandoned_cart_thread = threading.Thread(target=_run_abandoned_cart_scheduler, daemon=True)
_abandoned_cart_thread.start()

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

# Start Printful tracking sync (every 2 hours)
def _run_printful_tracking_scheduler():
    while True:
        try:
            from app.api.v1.endpoints.dropshipping import sync_printful_tracking_job
            sync_printful_tracking_job(SessionLocal)
        except Exception as exc:
            logger.error(f"[Printful Tracking scheduler] {exc}")
        time.sleep(2 * 3600)

_printful_tracking_thread = threading.Thread(target=_run_printful_tracking_scheduler, daemon=True)
_printful_tracking_thread.start()

# Start Printify tracking sync (every 2 hours)
def _run_printify_tracking_scheduler():
    while True:
        try:
            from app.api.v1.endpoints.printify import sync_printify_tracking_job
            sync_printify_tracking_job(SessionLocal)
        except Exception as exc:
            logger.error(f"[Printify Tracking scheduler] {exc}")
        time.sleep(2 * 3600)

_printify_tracking_thread = threading.Thread(target=_run_printify_tracking_scheduler, daemon=True)
_printify_tracking_thread.start()

# Start AliExpress tracking sync (every 2 hours)
def _run_aliexpress_tracking_scheduler():
    while True:
        try:
            from app.api.v1.endpoints.dropshipping import sync_aliexpress_tracking_job
            sync_aliexpress_tracking_job(SessionLocal)
        except Exception as exc:
            logger.error(f"[AliExpress Tracking scheduler] {exc}")
        time.sleep(2 * 3600)

_aliexpress_tracking_thread = threading.Thread(target=_run_aliexpress_tracking_scheduler, daemon=True)
_aliexpress_tracking_thread.start()

# Start HyperSKU tracking sync (every 2 hours)
def _run_hypersku_tracking_scheduler():
    while True:
        try:
            from app.api.v1.endpoints.dropshipping import sync_hypersku_tracking_job
            sync_hypersku_tracking_job(SessionLocal)
        except Exception as exc:
            logger.error(f"[HyperSKU Tracking scheduler] {exc}")
        time.sleep(2 * 3600)

_hypersku_tracking_thread = threading.Thread(target=_run_hypersku_tracking_scheduler, daemon=True)
_hypersku_tracking_thread.start()

# Poll pending Higgsfield AI video generation jobs (every 3 minutes — these
# typically finish in under a minute per Higgsfield's own docs, so this is
# a much shorter interval than the 2h supplier-tracking jobs above; it's a
# safety net for a seller who isn't sitting on the page waiting, not the
# primary path — check_video_status in video_gen.py handles the live case).
def _run_video_gen_poll_scheduler():
    while True:
        try:
            from app.api.v1.endpoints.video_gen import sync_pending_videos_job
            sync_pending_videos_job(SessionLocal)
        except Exception as exc:
            logger.error(f"[Video Gen Poll scheduler] {exc}")
        time.sleep(3 * 60)

_video_gen_poll_thread = threading.Thread(target=_run_video_gen_poll_scheduler, daemon=True)
_video_gen_poll_thread.start()

# Move $1 trials to full price once their week is over (see
# app/core/subscription_lifecycle.py). This used to need an outside cron job
# calling POST /cron/advance-trial-stages; if nobody set that up, no customer
# was ever charged the full price. It now runs on its own: every hour it looks
# for trials whose week has ended (a run with nothing due does nothing, so the
# hourly check is safe and means a customer waits at most an hour, not a day).
# A Postgres advisory lock makes sure only one backend process runs it at a
# time, so a second worker can never charge the same card twice.
_TRIAL_STAGE_LOCK_KEY = 7420001


def _run_trial_stage_scheduler():
    import asyncio
    time.sleep(90)  # let the app finish starting first
    while True:
        try:
            from app.core.lemonsqueezy import is_configured
            if is_configured():
                with engine.connect() as lock_conn:
                    got = lock_conn.execute(_sa_text("SELECT pg_try_advisory_lock(:k)"), {"k": _TRIAL_STAGE_LOCK_KEY}).scalar()
                    if got:
                        try:
                            from app.core.subscription_lifecycle import advance_trial_stages
                            db = SessionLocal()
                            try:
                                asyncio.run(advance_trial_stages(db))
                            finally:
                                db.close()
                        finally:
                            lock_conn.execute(_sa_text("SELECT pg_advisory_unlock(:k)"), {"k": _TRIAL_STAGE_LOCK_KEY})
                            lock_conn.commit()
        except Exception as exc:
            logger.error(f"[Trial stage scheduler] {exc}")
        time.sleep(3600)

_trial_stage_thread = threading.Thread(target=_run_trial_stage_scheduler, daemon=True)
_trial_stage_thread.start()

# Publish due scheduled social posts (every 5 minutes) — matches the drip
# flow runner's cadence, plenty tight for a "schedule for later today" tool.
def _run_social_posting_scheduler():
    while True:
        try:
            from app.api.v1.endpoints.social_posting import run_scheduled_social_posts_job
            run_scheduled_social_posts_job()
        except Exception as exc:
            logger.error(f"[Social Posting scheduler] {exc}")
        time.sleep(5 * 60)

_social_posting_thread = threading.Thread(target=_run_social_posting_scheduler, daemon=True)
_social_posting_thread.start()

# Auto-expire overdue subscriptions (checked daily) — recurring affiliate
# commissions are now generated only from real payment events (Lemon Squeezy
# webhook or manual admin approval), never from a blind timer.
def _run_subscription_expiry_scheduler():
    while True:
        try:
            from app.api.v1.endpoints.admin import expire_overdue_subscriptions
            expire_overdue_subscriptions()
        except Exception as exc:
            logger.error(f"[Subscription Expiry scheduler] {exc}")
        time.sleep(24 * 3600)

_subscription_expiry_thread = threading.Thread(target=_run_subscription_expiry_scheduler, daemon=True)
_subscription_expiry_thread.start()

# TheDersi auto-payout requesting was removed 2026-08-24 — TheDersi now pays
# every seller's available balance automatically every Monday on their own
# side; the POST /seller/payouts endpoint we used to call weekly is now a
# no-op on their end. See run_thedersi_auto_payouts (removed from channels.py).

# Daraz order sync — polls every 20 minutes since there's no confirmed
# webhook/GetOrders integration wired up yet (see sync_daraz_orders).
def _run_daraz_order_sync_scheduler():
    from datetime import datetime, timezone, timedelta
    while True:
        try:
            from app.models.channel import ChannelConnection
            from app.models.shop import Shop
            from app.api.v1.endpoints.daraz import sync_daraz_orders
            db = SessionLocal()
            try:
                conns = db.query(ChannelConnection).filter(
                    ChannelConnection.channel_type == "daraz",
                    ChannelConnection.is_active == True,
                ).all()
                end = datetime.now(timezone.utc)
                start = end - timedelta(days=2)  # overlap window — safe since already-synced orders are skipped
                for conn in conns:
                    shop = db.query(Shop).filter(Shop.id == conn.shop_id).first()
                    if not shop:
                        continue
                    try:
                        sync_daraz_orders(conn, shop, db, start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d"))
                    except Exception as exc:
                        logger.error(f"[Daraz Order Sync] shop={conn.shop_id} {exc}")
            finally:
                db.close()
        except Exception as exc:
            logger.error(f"[Daraz Order Sync scheduler] {exc}")
        time.sleep(20 * 60)

_daraz_order_sync_thread = threading.Thread(target=_run_daraz_order_sync_scheduler, daemon=True)
_daraz_order_sync_thread.start()

# eBay auto order sync — opt-in per connection via ChannelConnection.sync_settings
# (auto_sync_orders + sync_frequency_minutes), set from the integration page's
# real Automation tab. Ticks every 5 minutes and only actually syncs a given
# connection once its own configured frequency has elapsed — never fabricated,
# every "next sync" the frontend shows is computed from last_auto_synced_at +
# this same interval.
def _run_ebay_auto_sync_scheduler():
    from datetime import datetime, timezone, timedelta
    while True:
        try:
            from app.models.channel import ChannelConnection
            from app.models.shop import Shop
            from app.api.v1.endpoints.ebay import sync_ebay_orders
            db = SessionLocal()
            try:
                now = datetime.now(timezone.utc)
                conns = db.query(ChannelConnection).filter(
                    ChannelConnection.channel_type == "ebay",
                    ChannelConnection.is_active == True,
                ).all()
                for conn in conns:
                    settings = conn.sync_settings or {}
                    if not settings.get("auto_sync_orders"):
                        continue
                    freq = int(settings.get("sync_frequency_minutes") or 30)
                    last = conn.last_auto_synced_at
                    if last:
                        last_utc = last if last.tzinfo else last.replace(tzinfo=timezone.utc)
                        if (now - last_utc).total_seconds() < freq * 60:
                            continue
                    shop = db.query(Shop).filter(Shop.id == conn.shop_id).first()
                    if not shop:
                        continue
                    try:
                        start = now - timedelta(days=2)  # overlap window — real order sync already skips duplicates
                        sync_ebay_orders(conn, shop, db, start.strftime("%Y-%m-%dT%H:%M:%S.000Z"), now.strftime("%Y-%m-%dT%H:%M:%S.000Z"))
                        conn.last_auto_synced_at = now
                        db.commit()
                    except Exception as exc:
                        logger.error(f"[eBay Auto Sync] shop={conn.shop_id} {exc}")
            finally:
                db.close()
        except Exception as exc:
            logger.error(f"[eBay Auto Sync scheduler] {exc}")
        time.sleep(5 * 60)

_ebay_auto_sync_thread = threading.Thread(target=_run_ebay_auto_sync_scheduler, daemon=True)
_ebay_auto_sync_thread.start()

# CORS middleware
# allow_origins=["*"] together with allow_credentials=True is invalid per the CORS
# spec — browsers require an exact origin (not a wildcard) on any credentialed
# response. Starlette papers over this on the OPTIONS preflight (reflects the real
# origin), but the actual GET/POST response still gets a literal "*", which every
# browser then rejects — silently breaking every authenticated cross-origin call.
# Auth here is a Bearer token in the Authorization header (see api.ts), never
# cookies, so credentials were never actually needed: allow_credentials=False lets
# the wildcard stay valid, which the public review widget (embedded on arbitrary
# seller websites, not just our own domains) genuinely relies on.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router, prefix=settings.API_V1_PREFIX)

# Records who changed what in each store (see app/core/action_audit.py) - runs
# after the response is sent, only for successful writes, and never fails a request.
from app.core.action_audit import ShopActionAuditMiddleware  # noqa: E402
app.add_middleware(ShopActionAuditMiddleware)


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
