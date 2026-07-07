-- Shop-level lead management (seller CRM for their own potential customers)
CREATE TABLE IF NOT EXISTS shop_leads (
    id          SERIAL PRIMARY KEY,
    shop_id     INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    email       VARCHAR(255),
    phone       VARCHAR(30),
    company     VARCHAR(255),
    source      VARCHAR(50) DEFAULT 'manual',
    status      VARCHAR(30) DEFAULT 'new',
    notes       TEXT,
    value       NUMERIC(12,2),
    assigned_to VARCHAR(255),
    last_contacted_at TIMESTAMP WITH TIME ZONE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS ix_shop_leads_shop_id ON shop_leads (shop_id);
CREATE INDEX IF NOT EXISTS ix_shop_leads_status  ON shop_leads (status);
