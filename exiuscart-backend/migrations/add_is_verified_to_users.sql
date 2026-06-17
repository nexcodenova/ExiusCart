-- Add email verification flag to existing users table
-- Run this ONCE on your database before restarting the backend
-- New users will default to TRUE (existing users stay active)

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT TRUE NOT NULL;
