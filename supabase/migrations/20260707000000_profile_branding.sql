-- ─── ORGANIZER PROFILE BRANDING FIELDS ───
-- Adds support for bio, website url, logo/avatar url, and social links to organizations.

ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}'::jsonb;
