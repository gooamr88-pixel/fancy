-- Add password reset OTP fields to organizations
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS reset_otp TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS reset_otp_expires_at TIMESTAMPTZ;
