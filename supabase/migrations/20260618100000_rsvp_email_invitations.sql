-- ════════════════════════════════════════════════════════════════════════
-- Email RSVP invitations: first-class "maybe" status + invitation tracking
-- ────────────────────────────────────────────────────────────────────────
-- CSV-imported guests previously had no email invitation path and could only
-- answer "yes"/"no"/"pending". This migration:
--
--   1. Adds "maybe" as a valid response so the Accept / Decline / Maybe buttons
--      in the invitation email each map to a real, distinct status.
--   2. Adds invitation-tracking columns so the organizer dashboard can show
--      who has been emailed and when, and how/when each guest responded.
--
-- Seating rule: only response = 'yes' guests are eligible for seating (enforced
-- by assign_seat_atomic and get_seating_guests). 'maybe' and 'pending' are
-- intentionally NOT auto/manually seatable — they are excluded from capacity
-- math until they convert to 'yes'.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Allow 'maybe' as a response value.
ALTER TABLE public.rsvps DROP CONSTRAINT IF EXISTS rsvps_response_check;

ALTER TABLE public.rsvps
  ADD CONSTRAINT rsvps_response_check
  CHECK (response IN ('yes', 'no', 'maybe', 'pending'));

-- 2. Invitation + response provenance tracking.
ALTER TABLE public.rsvps
  ADD COLUMN IF NOT EXISTS invitation_sent     BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS invitation_sent_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rsvp_at             TIMESTAMPTZ,
  -- How the guest's current response was recorded: 'web' | 'email' | 'sms' |
  -- 'manual' (organizer) | 'import' (CSV default).
  ADD COLUMN IF NOT EXISTS response_source     TEXT;

-- Partial index to make "who hasn't responded yet" / invitation sweeps fast.
CREATE INDEX IF NOT EXISTS idx_rsvps_event_invitation
  ON public.rsvps (event_id, invitation_sent);
