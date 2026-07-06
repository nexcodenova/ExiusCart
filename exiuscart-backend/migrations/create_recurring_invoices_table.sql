CREATE TABLE IF NOT EXISTS recurring_invoices (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    customer_name VARCHAR(200) NOT NULL,
    customer_email VARCHAR(200),
    customer_phone VARCHAR(50),
    items JSONB NOT NULL DEFAULT '[]',
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
    discount NUMERIC(12,2) NOT NULL DEFAULT 0,
    tax NUMERIC(12,2) NOT NULL DEFAULT 0,
    total NUMERIC(12,2) NOT NULL DEFAULT 0,
    notes TEXT,
    frequency VARCHAR(20) NOT NULL DEFAULT 'monthly',
    next_send_date DATE NOT NULL,
    last_sent_at TIMESTAMPTZ,
    send_count INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_invoices_shop_id ON recurring_invoices(shop_id);
CREATE INDEX IF NOT EXISTS idx_recurring_invoices_next_send ON recurring_invoices(next_send_date) WHERE is_active = TRUE;
