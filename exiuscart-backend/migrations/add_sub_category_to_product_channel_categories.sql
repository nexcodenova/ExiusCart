-- Add sub-category fields to product_channel_categories
-- Required for TheDersi product sync to include sub_category in payload

ALTER TABLE product_channel_categories ADD COLUMN IF NOT EXISTS channel_sub_category_id VARCHAR(100) NULL;
ALTER TABLE product_channel_categories ADD COLUMN IF NOT EXISTS channel_sub_category_name VARCHAR(255) NULL;
