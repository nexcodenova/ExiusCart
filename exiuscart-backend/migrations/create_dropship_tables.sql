-- Dropshipping integration tables
-- Run once on server: psql $DATABASE_URL -f migrations/create_dropship_tables.sql

CREATE TABLE IF NOT EXISTS dropship_connections (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    supplier_type VARCHAR(20) NOT NULL,
    supplier_email VARCHAR(255),
    supplier_password_enc TEXT,
    access_token TEXT,
    token_expires_at TIMESTAMPTZ,
    api_key TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    auto_fulfill_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(shop_id, supplier_type)
);

CREATE TABLE IF NOT EXISTS dropship_product_links (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    supplier_type VARCHAR(20) NOT NULL,
    supplier_product_id VARCHAR(255),
    supplier_product_url VARCHAR(1000),
    supplier_sku VARCHAR(255),
    supplier_product_name VARCHAR(500),
    cost_price NUMERIC(10, 2),
    shipping_estimate_days INTEGER,
    warehouse VARCHAR(50),
    is_primary BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(product_id, supplier_type)
);

CREATE TABLE IF NOT EXISTS dropship_orders (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    supplier_type VARCHAR(20) NOT NULL,
    supplier_order_id VARCHAR(255),
    status VARCHAR(30) DEFAULT 'pending',
    tracking_number VARCHAR(255),
    tracking_url VARCHAR(1000),
    carrier VARCHAR(100),
    cost_paid NUMERIC(10, 2),
    error_message TEXT,
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    UNIQUE(order_id, supplier_type)
);

-- Add fulfillment columns to existing orders table
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS fulfillment_status VARCHAR(30) DEFAULT 'unfulfilled',
    ADD COLUMN IF NOT EXISTS fulfillment_mode VARCHAR(20) DEFAULT 'manual';
