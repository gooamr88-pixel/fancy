-- Persist the purchased license tier ("current plan") on the event itself, plus
-- on each payment record, so the dashboard and event-creation wizard can show a
-- professional "Current Plan" panel and offer upgrades without re-deriving the
-- tier from price math.
--
-- tier_name        : the pricing tier the organizer paid for (e.g. "Premium").
-- tier_max_guests  : the guest cap of that tier at purchase time (0 = unlimited),
--                    snapshotted so later admin price/cap edits don't rewrite history.

ALTER TABLE events            ADD COLUMN IF NOT EXISTS tier_name TEXT;
ALTER TABLE events            ADD COLUMN IF NOT EXISTS tier_max_guests INTEGER;

ALTER TABLE event_payments    ADD COLUMN IF NOT EXISTS tier_name TEXT;
ALTER TABLE event_payments    ADD COLUMN IF NOT EXISTS tier_max_guests INTEGER;
