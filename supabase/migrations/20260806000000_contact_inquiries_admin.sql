-- ════════════════════════════════════════════════════════════════════════
-- CONTACT INQUIRIES — admin visibility + reply workflow.
--
-- contact_submissions (public Contact page + /solutions/* B2B lead forms,
-- see 20260719000000_marketing_forms.sql + 20260730000000_contact_submissions_
-- segments.sql) was write-only: every inquiry was saved and emailed to a
-- static inbox, but there was no admin UI to see the history or reply from
-- within the platform. Adds a simple new/responded/closed workflow plus the
-- reply text/timestamp/actor needed to track it.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.contact_submissions
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS admin_response TEXT,
  ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS responded_by UUID;

ALTER TABLE public.contact_submissions
  DROP CONSTRAINT IF EXISTS contact_submissions_status_check;
ALTER TABLE public.contact_submissions
  ADD CONSTRAINT contact_submissions_status_check
  CHECK (status IN ('new', 'responded', 'closed'));

CREATE INDEX IF NOT EXISTS idx_contact_submissions_status ON public.contact_submissions(status);

COMMIT;
