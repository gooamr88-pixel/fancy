-- Migration: Security Hardening
-- Date: 2026-06-10
-- Adds OTP attempt counting, RSVP dedup constraint, updated_at trigger, and increment_sms_credits RPC

-- 1. Add OTP attempt counter to organizations
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS otp_attempts INTEGER DEFAULT 0;

-- 2. Add unique constraint on RSVPs to prevent duplicate submissions
-- Use a partial unique index to allow multiple 'no' responses but only one active RSVP per email per event
CREATE UNIQUE INDEX IF NOT EXISTS idx_rsvps_event_email_unique 
  ON rsvps(event_id, email) 
  WHERE response != 'no';

-- 3. Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Apply updated_at trigger to all tables that have the column
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN 
    SELECT table_name FROM information_schema.columns 
    WHERE column_name = 'updated_at' 
    AND table_schema = 'public'
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_updated_at ON %I; CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
      tbl, tbl
    );
  END LOOP;
END;
$$;

-- 5. Atomic SMS credit increment function (replaces read-modify-write pattern)
CREATE OR REPLACE FUNCTION increment_sms_credits(
  p_event_id UUID,
  p_credit_amount INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE sms_credit_wallets
  SET credits_purchased = credits_purchased + p_credit_amount
  WHERE event_id = p_event_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SMS credit wallet not found for event %', p_event_id;
  END IF;
END;
$$;
