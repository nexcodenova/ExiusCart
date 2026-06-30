-- Add bundle/kit flag to existing products table
-- Run this ONCE on your database before restarting the backend
-- Existing products default to FALSE (not a bundle)

ALTER TABLE products ADD COLUMN IF NOT EXISTS is_bundle BOOLEAN DEFAULT FALSE NOT NULL;
