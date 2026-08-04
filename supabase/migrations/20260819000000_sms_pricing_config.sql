-- ─── SUPER-ADMIN CONTROL OVER SMS PRICING ────────────────────────────────────
--
-- Until now only two SMS numbers were admin-editable — the base rate and the
-- markup. Everything else that determines what an organizer is quoted and what
-- Fancy earns was a constant compiled into the code:
--
--   • the volume discount (a single hard-coded tier: 12.5% off at 500+)
--   • the purchase floor, ceiling and step (50 / 50,000 / 50)
--   • every assumption in the allowance estimator — guests per party, average
--     segments per message in Latin and Arabic, the size assumed for unlimited
--     plans
--   • how many messages of each type an average party receives, which is what
--     the recommended bundle is actually built from
--
-- That meant changing a price required a deploy, and the recommendation shown to
-- customers could not be tuned against real usage at all. This column makes the
-- whole pricing model editable from the super-admin dashboard.
--
-- ── Why one jsonb column instead of a dozen scalars ──
-- These values are one cohesive model that is read together, written together,
-- and will grow (a third discount tier, a new message type). A column per knob
-- would mean a migration per pricing experiment. The trade-off — no per-field
-- database constraints — is covered by backend/config/smsPricing.js, which
-- normalizes and clamps every field on read AND on write, so a malformed or
-- partial object can never reach Stripe.
--
-- ── The defaults are not a new pricing decision ──
-- Every value below reproduces exactly what the code did before this migration.
-- Applying it changes no customer's price by a single cent; it only moves the
-- numbers from source control into the dashboard.
--
-- sms_rate_cents_per_credit and sms_markup_percentage deliberately stay as their
-- own columns: they are the two headline figures, they are referenced directly
-- across the payment and campaign controllers, and folding them in here would be
-- churn without benefit.

ALTER TABLE public.super_admin_config
  ADD COLUMN IF NOT EXISTS sms_pricing_config JSONB NOT NULL DEFAULT '{
    "volume_discounts": [
      { "min_segments": 500, "discount_pct": 12.5 }
    ],
    "bounds": {
      "min": 50,
      "max": 50000,
      "step": 50
    },
    "estimator": {
      "guests_per_party": 2.2,
      "segments_per_message_latin": 1.4,
      "segments_per_message_arabic": 2.6,
      "unlimited_tier_assumed_guests": 500
    },
    "type_frequencies": {
      "rsvp_confirmation": 1,
      "rsvp_reminder": 0.6,
      "event_reminder": 0.7,
      "qr_ticket": 0.7,
      "decline_ack": 0.2,
      "organizer_report": 3,
      "campaign": 2
    }
  }'::jsonb;

COMMENT ON COLUMN public.super_admin_config.sms_pricing_config IS
  'Admin-editable SMS pricing model. volume_discounts: tiered discounts, best matching tier wins (not cumulative). bounds: min/max/step for a single purchase. estimator: the assumptions behind the recommended allowance shown at checkout. type_frequencies: messages per party for each message type (per EVENT for organizer_report). Normalized and clamped by backend/config/smsPricing.js on every read and write — see that file before changing this shape.';

-- The singleton row predates this column, so DEFAULT alone would not populate it.
UPDATE public.super_admin_config
SET sms_pricing_config = DEFAULT
WHERE sms_pricing_config IS NULL
   OR sms_pricing_config = '{}'::jsonb;
