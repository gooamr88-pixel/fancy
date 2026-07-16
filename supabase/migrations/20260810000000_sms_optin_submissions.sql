-- ─── SMS OPT-IN PAGE SUBMISSIONS ─────────────────────────────────────────────
-- Backing store for the public /sms-opt-in form (Twilio TFV remediation). The
-- reviewer must see a LIVE opt-in flow — a phone field + consent checkbox +
-- submit that actually records consent — not a demonstration. Each row is a
-- timestamped, versioned consent record (Privacy Policy §3 record-keeping).
--
-- These records are standalone web-form opt-ins: the person receives event
-- messages only when a host invites them; the row documents that this number's
-- owner affirmatively consented to event-related texts from Fancy RSVP.

CREATE TABLE IF NOT EXISTS sms_optin_submissions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name             TEXT,
  phone                 TEXT NOT NULL,                 -- E.164 (normalized server-side)
  consent               BOOLEAN NOT NULL,              -- always true (endpoint rejects otherwise); explicit for auditability
  consent_text_version  TEXT NOT NULL,                 -- matches backend/utils/smsConsent.js at capture time
  source                TEXT NOT NULL DEFAULT 'sms_opt_in_page',
  ip                    TEXT,                          -- capture context, same convention as contact_submissions
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE sms_optin_submissions IS
  'Consent records captured by the public /sms-opt-in web form (Twilio TFV opt-in URL). Service-role only.';

CREATE INDEX IF NOT EXISTS idx_sms_optin_submissions_phone ON sms_optin_submissions (phone);

-- Service-role only: RLS enabled with no policies.
ALTER TABLE sms_optin_submissions ENABLE ROW LEVEL SECURITY;
