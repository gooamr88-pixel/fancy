-- Remove the dead "Subscriptions" plan system: the `plans`/`subscriptions` tables
-- and their admin UI (/admin/subscriptions) were never wired into checkout, event
-- creation, or guest-facing pages. The real, live pricing system is
-- super_admin_config.pricing_tiers (edited at /admin/config "License Tiers"),
-- which already drives Stripe checkout, manual cash payment, and the
-- tier_max_guests enforcement in submit_rsvp(). Dropping the decoy so admins can't
-- be misled into editing a screen with zero effect.
DROP TABLE IF EXISTS subscriptions;
DROP TABLE IF EXISTS plans;

-- New tier-derived flag, snapshotted onto the event the same way tier_name /
-- tier_max_guests already are (see 20260624000000_event_plan_tier.sql) — set from
-- whichever pricing_tiers entry the organizer paid for, so later admin edits to a
-- tier's `remove_watermark` don't retroactively change what already-paid events show.
ALTER TABLE events         ADD COLUMN IF NOT EXISTS tier_remove_watermark BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE event_payments ADD COLUMN IF NOT EXISTS tier_remove_watermark BOOLEAN NOT NULL DEFAULT false;
