-- ════════════════════════════════════════════════════════════════════════
-- Real, admin-managed "As Seen In" press mentions / trust badges for the
-- landing page. There was previously no database-backed press content at
-- all — the /press page's "Media Mentions" list is hard-coded, fabricated
-- copy (invented TechCrunch/Forbes headlines, a fictitious funding round,
-- a founder name that appears nowhere else in this codebase, and article
-- links that just point at each publication's homepage, not a real
-- article). This table is the honest replacement for the landing page's
-- trust strip: it starts EMPTY, and only ever shows what an admin actually
-- adds — each row a real publication name, a real uploaded logo, and
-- (recommended) a real link to the actual article/mention so a visitor can
-- verify it themselves.
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.press_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_name TEXT NOT NULL,
  logo_url TEXT,              -- real uploaded logo; NULL falls back to a text wordmark
  article_url TEXT,           -- link to the real article/mention, for credibility
  headline TEXT,               -- optional short quote/headline from the mention
  is_published BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_press_mentions_published_sort
  ON public.press_mentions(is_published, sort_order);

-- Deny-all by default (no policies) — every read/write goes through the
-- backend's service-role client, mirroring testimonials
-- (20260731000000_testimonials.sql) and super_admin_config's own lockdown.
ALTER TABLE public.press_mentions ENABLE ROW LEVEL SECURITY;
