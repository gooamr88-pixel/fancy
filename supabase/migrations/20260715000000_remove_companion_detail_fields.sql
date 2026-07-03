-- ════════════════════════════════════════════════════════════════════════
-- Remove companion detail fields (age_group / relationship / gender)
-- ────────────────────────────────────────────────────────────────────────
-- Added in 20260711000000_companion_detail_fields.sql but never actually
-- exposed anywhere in the public RSVP form's UI (StepPartyDetails.js only
-- ever collected fullName/email/phone/mealSelection/dietaryNotes per
-- companion — the age/gender/relationship dropdowns were dead code) —
-- removed per product decision. submit_rsvp_v2 (see
-- 20260714000000_guest_side_tagging.sql) has already stopped writing these
-- columns; this migration just drops them.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.guests DROP CONSTRAINT IF EXISTS guests_age_group_check;
ALTER TABLE public.guests DROP CONSTRAINT IF EXISTS guests_gender_check;
ALTER TABLE public.guests DROP CONSTRAINT IF EXISTS guests_relationship_length_check;

ALTER TABLE public.guests
  DROP COLUMN IF EXISTS age_group,
  DROP COLUMN IF EXISTS relationship,
  DROP COLUMN IF EXISTS gender;
