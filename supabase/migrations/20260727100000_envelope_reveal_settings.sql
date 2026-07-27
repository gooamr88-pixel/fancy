-- ════════════════════════════════════════════════════════════════════════
-- ENVELOPE REVEAL — ORGANIZER CONTROL
--
-- The sealed envelope stands in front of every invitation, and until now the
-- organizer controlled exactly one thing about it: the monogram struck into
-- the wax (template_data.seal_text). Whether it played at all, and whether it
-- played again on a return visit, were decided in the frontend for everyone.
--
-- Two booleans, following the same convention as no_kids_allowed
-- (20260812000000) — an event BEHAVIOUR flag is a real typed column, not a
-- key inside the template_data JSONB blob. The blob keeps presentation
-- strings (seal_text, and the new reveal_tone), which is where a value that
-- only the renderer reads belongs.
--
-- DEFAULTS PRESERVE TODAY'S BEHAVIOUR EXACTLY, so this migration changes
-- nothing for a single existing event:
--
--   reveal_enabled = true   the reveal currently plays for everyone.
--
--   reveal_replay  = true   the invitation page deliberately replays it on
--                           every load (documented at EventPageClient's
--                           showReveal), so true is what every existing event
--                           already does.
--
-- SCOPE OF reveal_replay: the invitation page only. The RSVP route keeps its
-- once-per-session behaviour unconditionally, and that is not an oversight —
-- the two reveals do different jobs. On the invitation page the envelope IS
-- the arrival; on the RSVP route it gates a form the guest is in the middle
-- of filling in, where replaying it on every refresh would be hostile. One
-- column governing both would have to break one of them.
--
-- Which default is actually right for the invitation page is still an open
-- question, and deliberately not answered here: the reveal funnel added in
-- the analytics work (reveal_shown / reveal_opened / reveal_skipped) is what
-- will answer it, once real events have produced enough of it.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS reveal_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS reveal_replay BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.events.reveal_enabled IS
  'Whether the sealed-envelope reveal plays before the invitation. Off = guests land straight on the page.';
COMMENT ON COLUMN public.events.reveal_replay IS
  'Whether the reveal plays again on a return visit, or only once per browser session.';
