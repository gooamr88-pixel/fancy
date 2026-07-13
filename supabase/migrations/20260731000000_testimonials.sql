-- ════════════════════════════════════════════════════════════════════════
-- Real, admin-managed customer testimonials for the landing page.
--
-- Previously TestimonialsSection.js hard-coded three fabricated reviews
-- (fake names, fake quotes, fake "Corporate Gala · March 2025" attributions)
-- directly in the component — no database backing, no way for an admin to
-- change them without a code deploy, and no way for a visitor to verify any
-- of it was real. This table is the durable, admin-controlled replacement:
-- each row is a single testimonial with a REAL uploaded photo (or initials
-- as a fallback avatar), a real star rating, and an optional `verify_url`
-- linking to the original review (Google, LinkedIn, a case study, etc.) so a
-- visitor can click through and confirm it's genuine — this is what actually
-- builds credibility instead of just asserting it.
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT,                 -- e.g. "Wedding · June 2025" or "Head of Events, Acme Inc."
  quote TEXT NOT NULL,
  photo_url TEXT,            -- real customer photo; NULL falls back to an initials avatar
  initials TEXT,             -- optional explicit override; auto-derived from name if NULL
  rating SMALLINT NOT NULL DEFAULT 5,
  verify_url TEXT,           -- link to the original review, for credibility
  is_published BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.testimonials
  DROP CONSTRAINT IF EXISTS testimonials_rating_check;
ALTER TABLE public.testimonials
  ADD CONSTRAINT testimonials_rating_check CHECK (rating BETWEEN 1 AND 5);

CREATE INDEX IF NOT EXISTS idx_testimonials_published_sort
  ON public.testimonials(is_published, sort_order);

-- Deny-all by default (no policies) — every read/write goes through the
-- backend's service-role client, which bypasses RLS entirely, matching the
-- pattern already established for super_admin_config (see
-- 20260709000001_lockdown_super_admin_config_rls.sql). Nothing here grants
-- anon/authenticated direct access.
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
