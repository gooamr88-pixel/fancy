-- ════════════════════════════════════════════════════════════════════════
-- LANDING STATS — LIVE SOURCE. "Events Created" and "Guests Managed" were
-- hand-typed admin numbers with no relationship to real platform activity.
-- Tags each landing_stats entry with a `source` so the public API knows
-- which ones to overwrite with a real COUNT(*) at request time vs which
-- stay admin-set (e.g. "Platform Uptime", which nothing in this codebase
-- measures automatically). See backend/routes/publicRoutes.js.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

UPDATE super_admin_config
SET landing_stats = (
  SELECT jsonb_agg(
    CASE elem->>'label'
      WHEN 'Events Created' THEN elem || '{"source": "events_count"}'::jsonb
      WHEN 'Guests Managed' THEN elem || '{"source": "guests_count"}'::jsonb
      ELSE elem || '{"source": "static"}'::jsonb
    END
  )
  FROM jsonb_array_elements(landing_stats) AS elem
)
WHERE landing_stats IS NOT NULL;

ALTER TABLE super_admin_config
  ALTER COLUMN landing_stats SET DEFAULT '[
    {"label": "Events Created", "target": 10000, "suffix": "+", "decimals": 0, "source": "events_count"},
    {"label": "Guests Managed", "target": 50000, "suffix": "+", "decimals": 0, "source": "guests_count"},
    {"label": "Platform Uptime", "target": 99.9, "suffix": "%", "decimals": 1, "source": "static"}
  ]'::jsonb;

COMMIT;
