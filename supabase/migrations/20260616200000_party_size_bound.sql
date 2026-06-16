-- ════════════════════════════════════════════════════════════════════════
-- Enforce an upper bound on rsvps.party_size
-- ────────────────────────────────────────────────────────────────────────
-- The column shipped with only `CHECK (party_size >= 1)` and no ceiling, while
-- the API validators disagreed (public route capped at 20, updateRSVP at 50,
-- addGuestManually at none). Seating capacity math trusts SUM(party_size), so an
-- unbounded value injected via a manual add or organizer edit corrupts table
-- occupancy. We standardize on 1..20 across the stack and enforce it at the DB.
--
-- Clamp any pre-existing out-of-range rows first so the constraint can validate.

UPDATE public.rsvps SET party_size = 20 WHERE party_size > 20;
UPDATE public.rsvps SET party_size = 1  WHERE party_size < 1;

ALTER TABLE public.rsvps
  DROP CONSTRAINT IF EXISTS rsvps_party_size_bound;

ALTER TABLE public.rsvps
  ADD CONSTRAINT rsvps_party_size_bound CHECK (party_size BETWEEN 1 AND 20);
