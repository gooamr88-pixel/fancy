-- ════════════════════════════════════════════════════════════════════════
-- LANDING STATS — admin-editable counters for the public landing page's
-- social-proof bar ("10,000+ Events Created", "50,000+ Guests Managed",
-- "99.9% Platform Uptime"). Piggybacks on the existing super_admin_config
-- singleton (same pattern as pricing_tiers / manual_payment_methods) rather
-- than introducing a new CMS table.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE super_admin_config
  ADD COLUMN IF NOT EXISTS landing_stats JSONB NOT NULL DEFAULT '[
    {"label": "Events Created", "target": 10000, "suffix": "+", "decimals": 0},
    {"label": "Guests Managed", "target": 50000, "suffix": "+", "decimals": 0},
    {"label": "Platform Uptime", "target": 99.9, "suffix": "%", "decimals": 1}
  ]'::jsonb;

COMMIT;
