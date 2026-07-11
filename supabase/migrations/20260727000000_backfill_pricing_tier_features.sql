-- ════════════════════════════════════════════════════════════════════════
-- FIX: SMS campaigns (and every other paid, gate-enforced feature) were
-- "not detected" for ANY event — paid or unpaid, on any tier.
--
-- Root cause: `super_admin_config.pricing_tiers` has never had a `features`
-- array on any tier since it was introduced — neither the column default
-- (schema.sql) nor its seed INSERT (20260607100000_schema_completion.sql)
-- ever included one, and no later migration backfilled it. The feature-gate
-- middleware (backend/middleware/featureGate.js, requireFeature) resolves an
-- event's tier from this table and checks `tier.features.includes(key)`;
-- with `features` missing/undefined on every tier, that check is `[].
-- includes(...)` === false universally, regardless of which event, tier, or
-- paid status is being checked. The gating LOGIC is correct (see
-- backend/test/featureGate.test.js, which mocks tiers WITH a features
-- array and passes) — only the real seed data was ever incomplete.
--
-- Fix: backfill the features registry's real, gate-enforced paid features
-- (backend/config/featureRegistry.js entries with freeDefault:false and
-- builtIn !== false — i.e. keys an actual route checks via requireFeature,
-- as opposed to pricing-page-only bullets like white_label/custom_api that
-- have no route gate yet) onto every existing paid tier, uniformly. This
-- only touches a tier whose `features` is missing or empty, so it can't
-- clobber a tier an admin has already configured via /admin/config since
-- this bug was first noticed. Tier-by-tier differentiation (e.g. reserving
-- some of these for a higher tier only) remains a business decision for
-- the admin to make afterwards through that same UI — this migration only
-- restores "paying for a tier actually unlocks its gated features" as a
-- baseline, it doesn't invent a pricing ladder.
-- ════════════════════════════════════════════════════════════════════════

UPDATE public.super_admin_config
SET pricing_tiers = (
  SELECT jsonb_agg(
    CASE
      WHEN jsonb_typeof(tier -> 'features') = 'array' AND jsonb_array_length(tier -> 'features') > 0
        THEN tier
      ELSE tier || jsonb_build_object('features', '[
        "rsvp_custom_fields", "add_guest_manual", "import_guests_csv",
        "guest_export_csv", "guest_export_excel",
        "seating_map", "table_management",
        "qr_checkin", "manual_checkin",
        "sms_campaigns", "remove_watermark"
      ]'::jsonb)
    END
  )
  FROM jsonb_array_elements(pricing_tiers) AS tier
)
WHERE pricing_tiers IS NOT NULL;
