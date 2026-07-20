-- ════════════════════════════════════════════════════════════════════════
-- "No Kids Allowed" notice (opt-in, per event)
-- ────────────────────────────────────────────────────────────────────────
-- Purely a display flag for the invitation card (InvitationCard.js "serif"
-- pattern) and the envelope reveal (InvitationReveal.js) — no RSVP/guest
-- logic reads it, so unlike track_guest_side (20260714000000) this needs
-- no RPC changes, just the column.
--
-- Off by default: the notice previously rendered unconditionally for every
-- wedding/engagement event with no organizer control at all, which wrongly
-- assumed every couple wants it. Same "off by default, opt-in" convention
-- as track_guest_side and dress code toggles.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS no_kids_allowed BOOLEAN NOT NULL DEFAULT false;
