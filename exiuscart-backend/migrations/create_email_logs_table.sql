CREATE TABLE IF NOT EXISTS email_logs (
    id SERIAL PRIMARY KEY,
    recipient VARCHAR(200),
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed with OTPs already sent (1 email per OTP row)
INSERT INTO email_logs (recipient, sent_at)
SELECT email, created_at FROM email_otps;

-- Seed with 1 welcome/registration email per existing user
INSERT INTO email_logs (recipient, sent_at)
SELECT email, created_at FROM users;
