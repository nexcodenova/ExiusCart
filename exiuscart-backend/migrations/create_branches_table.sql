CREATE TABLE IF NOT EXISTS branches (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    address TEXT,
    phone VARCHAR(50),
    manager_name VARCHAR(200),
    manager_email VARCHAR(200),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_main BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_branches_shop ON branches(shop_id);
