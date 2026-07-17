-- ═══════════════════════════════════════════════════════════════════════
-- Add a real "Enterprise+" custom-quote tier so events with more guests than
-- the largest fixed plan (Enterprise, 1000) have an actual configured plan
-- to be pointed at, instead of only FAQ/UI copy promising "contact us" with
-- nothing behind it — /pricing's guest-cap FAQ and PlanRecommender have
-- always been able to render an is_custom tier correctly (Contact Sales CTA,
-- "Unlimited guests", /contact link), there was just never one seeded.
--
-- price_cents is a placeholder (never charged): createCheckoutSession and
-- initiateManualPayment both reject is_custom tiers outright, so this can
-- never be paid for online — it only exists to be recommended/linked to,
-- with the actual price agreed by sales.
--
-- Idempotent: only appends when no tier with is_custom = true exists yet, so
-- an admin who already configured their own custom tier via /admin/config is
-- never overwritten or duplicated.
-- ═══════════════════════════════════════════════════════════════════════

UPDATE public.super_admin_config
SET pricing_tiers = pricing_tiers || jsonb_build_array(
  jsonb_build_object(
    'name', 'Enterprise+',
    'price_cents', 0,
    'max_guests', 0,
    'max_events', 0,
    'remove_watermark', true,
    'recommended', false,
    'is_custom', true,
    'features', '["rsvp_basic", "analytics_basic", "email_notifications", "support_community"]'::jsonb,
    'price_label', 'Custom',
    'cta_label', 'Contact Sales',
    'description', 'For events beyond our largest fixed plan — a custom guest cap and price quoted by our team before anything is charged.'
  )
)
WHERE pricing_tiers IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(pricing_tiers) AS t
    WHERE COALESCE((t ->> 'is_custom')::boolean, false) = true
  );
