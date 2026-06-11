-- Track 1+4: Add registration OTP and email verification columns to organizations
-- These support the new two-step registration flow (register → verify OTP → activate)

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT true;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS registration_otp TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS registration_otp_expires_at TIMESTAMPTZ;

-- Set existing accounts as verified (they were created before this flow existed)
UPDATE organizations SET email_verified = true WHERE email_verified IS NULL;

COMMENT ON COLUMN organizations.email_verified IS 'Whether the organizer has verified their email address via OTP during registration';
COMMENT ON COLUMN organizations.registration_otp IS 'SHA-256 hashed 6-digit OTP code for email verification during registration';
COMMENT ON COLUMN organizations.registration_otp_expires_at IS 'Expiration timestamp for the registration OTP (15 minute window)';
