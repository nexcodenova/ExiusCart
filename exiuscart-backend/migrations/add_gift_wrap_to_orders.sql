-- Add gift wrap fields to orders table (TheDersi webhook support)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gift_wrap BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gift_wrap_fee NUMERIC(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gift_message TEXT;
