-- ════════════════════════════════════════════════════════════════════════
-- Segmented lead capture for the new B2B audience pages (Planners / Venues /
-- Corporate). contact_submissions previously only recorded name/email/
-- subject/message from the generic Contact page — there was no way to tell
-- a routine support question apart from a qualified enterprise sales lead, or
-- to know which company/guest volume a lead represents.
--
-- Adds the columns needed by the new /solutions/* inquiry forms while
-- staying fully backward-compatible: `segment` defaults to 'general' so every
-- existing row (and the untouched generic Contact page form) is unaffected.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.contact_submissions
  ADD COLUMN IF NOT EXISTS segment TEXT NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS company TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS expected_guests TEXT;

ALTER TABLE public.contact_submissions
  DROP CONSTRAINT IF EXISTS contact_submissions_segment_check;
ALTER TABLE public.contact_submissions
  ADD CONSTRAINT contact_submissions_segment_check
  CHECK (segment IN ('general', 'planners', 'venues', 'corporate'));

CREATE INDEX IF NOT EXISTS idx_contact_submissions_segment ON public.contact_submissions(segment);
