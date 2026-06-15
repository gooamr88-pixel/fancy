-- A1: Persist the auto-generated event QR code.
-- The public event link is derived from events.slug (already unique); this column
-- stores the QR code (as a data URL) generated automatically at event creation/publish
-- so the dashboard can display/share it without regenerating it client-side every time.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS qr_code_url TEXT;

COMMENT ON COLUMN public.events.qr_code_url IS
  'Auto-generated event QR code (PNG data URL) encoding the public event link. Set at creation/publish.';
