-- Per-shop token for Google Ads / Meta lead capture webhooks
ALTER TABLE shops ADD COLUMN IF NOT EXISTS lead_capture_token VARCHAR(64) NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ix_shops_lead_capture_token
    ON shops (lead_capture_token)
    WHERE lead_capture_token IS NOT NULL;
