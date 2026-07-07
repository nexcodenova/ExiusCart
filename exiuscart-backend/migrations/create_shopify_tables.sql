-- Shopify integration tables + order model extensions

-- Add reference column to orders (stores external IDs like SHOPIFY-123456)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS reference VARCHAR(200) NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) NULL;
CREATE INDEX IF NOT EXISTS ix_orders_reference ON orders (reference);

-- Shopify connected stores
CREATE TABLE IF NOT EXISTS shopify_stores (
    id                 SERIAL PRIMARY KEY,
    shop_id            INTEGER NOT NULL UNIQUE REFERENCES shops(id) ON DELETE CASCADE,
    shopify_domain     VARCHAR(255) NOT NULL,
    access_token       TEXT,
    scope              TEXT,
    is_connected       BOOLEAN DEFAULT FALSE,
    shop_name          VARCHAR(255),
    shop_email         VARCHAR(255),
    plan_name          VARCHAR(100),
    currency           VARCHAR(10),
    sync_products      BOOLEAN DEFAULT TRUE,
    sync_orders        BOOLEAN DEFAULT TRUE,
    sync_inventory     BOOLEAN DEFAULT TRUE,
    last_product_sync  TIMESTAMPTZ,
    last_order_sync    TIMESTAMPTZ,
    products_synced    INTEGER DEFAULT 0,
    orders_synced      INTEGER DEFAULT 0,
    sync_errors        TEXT,
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Registered Shopify webhooks
CREATE TABLE IF NOT EXISTS shopify_webhooks (
    id                  SERIAL PRIMARY KEY,
    shopify_store_id    INTEGER NOT NULL REFERENCES shopify_stores(id) ON DELETE CASCADE,
    shopify_webhook_id  VARCHAR(100),
    topic               VARCHAR(100) NOT NULL,
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Sync activity log
CREATE TABLE IF NOT EXISTS shopify_sync_logs (
    id                  SERIAL PRIMARY KEY,
    shopify_store_id    INTEGER NOT NULL REFERENCES shopify_stores(id) ON DELETE CASCADE,
    sync_type           VARCHAR(50) NOT NULL,
    direction           VARCHAR(20) NOT NULL,
    status              VARCHAR(20) NOT NULL,
    records_processed   INTEGER DEFAULT 0,
    records_failed      INTEGER DEFAULT 0,
    error_details       TEXT,
    started_at          TIMESTAMPTZ DEFAULT NOW(),
    completed_at        TIMESTAMPTZ
);
