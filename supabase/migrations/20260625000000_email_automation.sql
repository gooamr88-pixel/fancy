-- ════════════════════════════════════════════════════════════════════════
-- EMAIL AUTOMATION — idempotency + audit for the lifecycle email engine.
-- ────────────────────────────────────────────────────────────────────────
-- The scheduler (backend/services/emailScheduler.js) sweeps for due reminders
-- and reports. To guarantee each automated email is sent EXACTLY ONCE we:
--   • stamp per-entity "*_sent_at" columns the sweeps filter on (fast + clear), and
--   • keep a generic email_log with a UNIQUE (kind, ref) idempotency key for
--     emails that have no natural per-row flag (e.g. low-credit warnings) and
--     for a full audit trail of every automated/transactional send.
-- All writes from the app are best-effort; this migration just provides the
-- durable backing so a missing table can never cause duplicate guest emails.
-- ════════════════════════════════════════════════════════════════════════

-- Per-guest reminder / lifecycle stamps.
ALTER TABLE public.rsvps
  ADD COLUMN IF NOT EXISTS reminder_sent_at        TIMESTAMPTZ,  -- "you haven't responded" nudge
  ADD COLUMN IF NOT EXISTS event_reminder_sent_at  TIMESTAMPTZ,  -- "see you soon" (event imminent)
  ADD COLUMN IF NOT EXISTS thank_you_sent_at       TIMESTAMPTZ;  -- post-event thank-you

-- Per-event organizer report / lifecycle stamps.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS payment_reminder_sent_at TIMESTAMPTZ,  -- unpaid-draft nudge
  ADD COLUMN IF NOT EXISTS final_report_sent_at     TIMESTAMPTZ,  -- final headcount (day before)
  ADD COLUMN IF NOT EXISTS recap_sent_at            TIMESTAMPTZ;  -- post-event recap

-- Per-organizer onboarding stamp.
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS welcome_sent_at          TIMESTAMPTZ;

-- Indexes that make the scheduler's "what's due?" sweeps cheap.
CREATE INDEX IF NOT EXISTS idx_rsvps_reminder_due
  ON public.rsvps (event_id, response) WHERE reminder_sent_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rsvps_event_reminder_due
  ON public.rsvps (event_id, response) WHERE event_reminder_sent_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_events_date_status
  ON public.events (event_date, status);

-- Generic audit + idempotency ledger.
CREATE TABLE IF NOT EXISTS public.email_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind       TEXT NOT NULL,                 -- e.g. 'rsvp_reminder', 'final_report'
  ref        TEXT,                          -- idempotency key, e.g. 'rsvp:<id>'
  recipient  TEXT,
  event_id   UUID,
  subject    TEXT,
  status     TEXT NOT NULL DEFAULT 'sent',  -- sent | failed | skipped
  error      TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- One send per (kind, ref): a second attempt hits this and is skipped.
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_log_kind_ref
  ON public.email_log (kind, ref) WHERE ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_log_event ON public.email_log (event_id, created_at DESC);

-- email_log is written only by the backend service-role client; lock out anon/auth.
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;
