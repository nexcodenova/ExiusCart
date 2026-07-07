CREATE TABLE IF NOT EXISTS loyalty_accounts (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    customer_name VARCHAR(200) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(200),
    points INTEGER NOT NULL DEFAULT 0,
    tier VARCHAR(20) NOT NULL DEFAULT 'bronze',
    total_spent NUMERIC(12,2) NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_loyalty_shop ON loyalty_accounts(shop_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_phone ON loyalty_accounts(shop_id, phone);

CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES loyalty_accounts(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL,
    points INTEGER NOT NULL,
    description VARCHAR(300),
    order_id INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_account ON loyalty_transactions(account_id);

-- Loyalty and VAT label settings on shops table
ALTER TABLE shops ADD COLUMN IF NOT EXISTS loyalty_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS loyalty_points_per_currency NUMERIC(6,2) NOT NULL DEFAULT 1.0;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS loyalty_redemption_rate NUMERIC(6,2) NOT NULL DEFAULT 0.01;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS vat_label VARCHAR(20) NOT NULL DEFAULT 'VAT';
