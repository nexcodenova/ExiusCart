-- Per-channel product listing: each channel gets its own on/off + gift state.
-- POS isn't a ChannelConnection, so it gets dedicated columns on products.
-- Other channels (TheDersi/Daraz/Shopify/Custom Website) use
-- product_channel_categories, which already exists per (product, channel_connection).

ALTER TABLE products ADD COLUMN IF NOT EXISTS pos_enabled BOOLEAN DEFAULT TRUE NOT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS pos_is_gift BOOLEAN DEFAULT FALSE NOT NULL;

-- is_listed backfills TRUE for existing rows (a saved category assignment
-- implied "listed" under the old system); new rows default FALSE per the
-- SQLAlchemy model until a seller explicitly toggles the channel on.
ALTER TABLE product_channel_categories ADD COLUMN IF NOT EXISTS is_listed BOOLEAN DEFAULT TRUE NOT NULL;
ALTER TABLE product_channel_categories ADD COLUMN IF NOT EXISTS is_gift BOOLEAN DEFAULT FALSE NOT NULL;

-- Channels with no category concept (Shopify, Custom Website) need to be
-- able to insert a row with is_listed/is_gift set and no category chosen.
ALTER TABLE product_channel_categories ALTER COLUMN channel_category_id DROP NOT NULL;
ALTER TABLE product_channel_categories ALTER COLUMN channel_category_name DROP NOT NULL;
