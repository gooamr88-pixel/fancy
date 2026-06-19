-- ════════════════════════════════════════════════════════════════════════
-- Event review gate: add the 'pending_review' status
-- ────────────────────────────────────────────────────────────────────────
-- Previously a successful Stripe payment flipped events straight to 'active',
-- so there was no opportunity for a Super Admin to review an event before it
-- went live to guests. We introduce an intermediate state:
--
--   draft → (card payment) → pending_review → (admin approves) → active
--
-- An event in 'pending_review' is PAID (is_paid = true) but NOT yet publicly
-- live: the guest-facing controllers require status = 'active', and the
-- existing RSVP RLS policy already gates inserts on status = 'active'. A Super
-- Admin promotes it to 'active' via PATCH /api/v1/admin/events/:eventId.
--
-- Cash/manual approvals are performed BY an admin, so those continue to set
-- 'active' directly (the review has effectively already happened).
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_status_check;

ALTER TABLE public.events
  ADD CONSTRAINT events_status_check
  CHECK (status IN ('draft', 'pending_review', 'active', 'paused', 'completed'));
