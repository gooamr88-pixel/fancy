-- ════════════════════════════════════════════════════════════════════════
-- Hero video background (opt-in, per event)
-- ────────────────────────────────────────────────────────────────────────
-- Optional looping background video for the "Custom Canvas" literal-port
-- template's hero section (and its ambient scroll-through layer, which
-- reuses this same URL rather than requiring a second upload). Purely a
-- display field — no RSVP/guest logic reads it — same "additive, nullable,
-- no RPC changes" convention as cover_image_url/background_music_url.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS hero_video_url text;
