-- Complimentary event reason
-- When an admin grants a free event (manual_override = true), this records why,
-- so the comp shows up in audit logs and on the organizer's dashboard instead of
-- looking like an unexplained unlimited-guest plan.

ALTER TABLE events ADD COLUMN IF NOT EXISTS comp_reason TEXT;
