-- ════════════════════════════════════════════════════════════════════════
-- FIX: pricing plans on the landing page show incomplete/inconsistent
-- feature lists — most visibly, the "Free" plan shows only ONE feature
-- ("SMS campaign tools") and nothing else.
--
-- Root cause: super_admin_config.pricing_tiers[].features holds feature
-- KEYS (backend/config/featureRegistry.js), and the public pricing endpoint
-- (paymentController.getPublicPricing) converts each key to its display
-- label. The 4 features flagged `freeDefault: true` in the registry
-- (rsvp_basic, analytics_basic, email_notifications, support_community —
-- meant to be included on every event, paid or not) were never present in
-- ANY tier's stored features array. The earlier migration
-- 20260727000000_backfill_pricing_tier_features.sql only backfilled tiers
-- whose features array was completely empty, so it skipped "Free" (which
-- already had one stray entry, "sms_campaigns") and never added these
-- baseline keys to "Premium"/"Enterprise" either — "Enterprise" only looks
-- complete because someone added them there by hand.
--
-- Fix: append the 4 baseline keys to every tier's features array if not
-- already present, additive-only — nothing already configured is removed
-- or reordered, so any tier-specific add-ons an admin has already set stay
-- exactly as they are.
-- ════════════════════════════════════════════════════════════════════════

UPDATE public.super_admin_config
SET pricing_tiers = (
  SELECT jsonb_agg(
    tier || jsonb_build_object(
      'features',
      COALESCE(tier -> 'features', '[]'::jsonb) ||
      (
        SELECT COALESCE(jsonb_agg(k), '[]'::jsonb)
        FROM jsonb_array_elements_text(
          '["rsvp_basic", "analytics_basic", "email_notifications", "support_community"]'::jsonb
        ) AS k
        WHERE NOT (COALESCE(tier -> 'features', '[]'::jsonb) ? k)
      )
    )
  )
  FROM jsonb_array_elements(pricing_tiers) AS tier
)
WHERE pricing_tiers IS NOT NULL;
