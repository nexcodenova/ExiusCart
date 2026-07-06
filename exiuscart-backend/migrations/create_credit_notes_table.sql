CREATE TABLE IF NOT EXISTS credit_notes (
    id SERIAL PRIMARY KEY,
    cn_number VARCHAR(30) UNIQUE NOT NULL,
    shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    reason VARCHAR(500) NOT NULL,
    amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'issued',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_notes_shop_id ON credit_notes(shop_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_order_id ON credit_notes(order_id);
