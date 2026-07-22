-- ════════════════════════════════════════════════════════════════════════
-- "Collect dietary restrictions" toggle (opt-out, per event)
-- ────────────────────────────────────────────────────────────────────────
-- The RSVP form's "Food allergies & intolerances" question (both the
-- HeritageArch pill-picker in RsvpSection.js and the legacy wizard's free-
-- text field in StepPartyDetails.js) previously rendered unconditionally
-- for every event, with no organizer control at all.
--
-- On by default — unlike no_kids_allowed (20260812000000), which was a
-- brand-new feature defaulting off, this question already ships live today.
-- Defaulting this column to true preserves every existing event's current
-- guest experience unchanged; an organizer opts OUT rather than in.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS collect_dietary_restrictions BOOLEAN NOT NULL DEFAULT true;
