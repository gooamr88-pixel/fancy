-- ════════════════════════════════════════════════════════════════════════
-- Seating map: venue elements (zones) + 100k-guest scalability
-- ────────────────────────────────────────────────────────────────────────
-- 1. Extend `tables` so it can store non-seating venue elements (stage, dance
--    floor, bar, DJ booth, entrance, custom) alongside real seatable tables.
--    Zones carry no capacity and have width/height/rotation/color geometry.
-- 2. Add aggregate RPCs so the dashboard never has to pull every RSVP/assignment
--    into Node just to compute occupancy or summary counts (scales to 100k+).
-- 3. Add indexes (incl. trigram on guest_name) to keep the paginated, searchable
--    guest panel fast at scale.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. New geometry / typing columns ──────────────────────────────────────
ALTER TABLE tables ADD COLUMN IF NOT EXISTS element_type TEXT NOT NULL DEFAULT 'table';
ALTER TABLE tables ADD COLUMN IF NOT EXISTS width DECIMAL;       -- canvas units (zones / rectangles)
ALTER TABLE tables ADD COLUMN IF NOT EXISTS height DECIMAL;      -- canvas units (zones / rectangles)
ALTER TABLE tables ADD COLUMN IF NOT EXISTS rotation DECIMAL NOT NULL DEFAULT 0;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- element_type: 'table' (seatable) | 'zone' (decor / no seats)
ALTER TABLE tables DROP CONSTRAINT IF EXISTS tables_element_type_check;
ALTER TABLE tables ADD CONSTRAINT tables_element_type_check
  CHECK (element_type IN ('table', 'zone'));

-- ── 2. Relax capacity so zones can exist without seats ────────────────────
-- Original inline check was `CHECK (max_capacity > 0)` → auto-named tables_max_capacity_check.
ALTER TABLE tables DROP CONSTRAINT IF EXISTS tables_max_capacity_check;
ALTER TABLE tables ALTER COLUMN max_capacity DROP NOT NULL;
ALTER TABLE tables ADD CONSTRAINT tables_max_capacity_check
  CHECK (max_capacity IS NULL OR max_capacity > 0);

-- ── 3. Expand the allowed shape set ───────────────────────────────────────
ALTER TABLE tables DROP CONSTRAINT IF EXISTS tables_shape_check;
ALTER TABLE tables ADD CONSTRAINT tables_shape_check CHECK (shape IN (
  -- seatable table shapes (legacy 'rectangular' kept for back-compat)
  'round', 'oval', 'square', 'rectangle', 'rectangular', 'banquet', 'head',
  -- non-seating venue zones
  'stage', 'dance_floor', 'bar', 'dj_booth', 'entrance', 'custom'
));

-- ── 4. Indexes for scale ──────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_rsvps_guest_name_trgm ON rsvps USING gin (guest_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_rsvps_event_response ON rsvps(event_id, response);
CREATE INDEX IF NOT EXISTS idx_seating_assignments_event ON seating_assignments(event_id);
CREATE INDEX IF NOT EXISTS idx_seating_assignments_table ON seating_assignments(table_id);
CREATE INDEX IF NOT EXISTS idx_tables_event ON tables(event_id);

-- ── 5. Aggregate occupancy per table (DB-side SUM, never streams rows) ─────
CREATE OR REPLACE FUNCTION public.get_table_occupancy(p_event_id UUID)
RETURNS TABLE(table_id UUID, occupied BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id AS table_id,
         COALESCE(SUM(r.party_size), 0)::BIGINT AS occupied
  FROM tables t
  LEFT JOIN seating_assignments sa ON sa.table_id = t.id
  LEFT JOIN rsvps r ON r.id = sa.rsvp_id AND r.response = 'yes'
  WHERE t.event_id = p_event_id
  GROUP BY t.id;
$$;

-- ── 6. Seating summary counts (header stats without loading rows) ─────────
CREATE OR REPLACE FUNCTION public.get_seating_summary(p_event_id UUID)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH attending AS (
    SELECT id, party_size FROM rsvps
    WHERE event_id = p_event_id AND response = 'yes'
  ),
  seated AS (
    SELECT DISTINCT sa.rsvp_id
    FROM seating_assignments sa
    JOIN attending a ON a.id = sa.rsvp_id
    WHERE sa.event_id = p_event_id
  )
  SELECT jsonb_build_object(
    'attendingParties', (SELECT COUNT(*) FROM attending),
    'attendingGuests',  (SELECT COALESCE(SUM(party_size), 0) FROM attending),
    'seatedParties',    (SELECT COUNT(*) FROM seated),
    'seatedGuests',     (SELECT COALESCE(SUM(a.party_size), 0)
                           FROM attending a WHERE a.id IN (SELECT rsvp_id FROM seated)),
    'unseatedParties',  (SELECT COUNT(*) FROM attending a WHERE a.id NOT IN (SELECT rsvp_id FROM seated)),
    'unseatedGuests',   (SELECT COALESCE(SUM(a.party_size), 0)
                           FROM attending a WHERE a.id NOT IN (SELECT rsvp_id FROM seated))
  );
$$;

-- ── 7. Paginated + searchable attending-guest list (server-side) ──────────
-- p_filter: 'all' | 'seated' | 'unseated'. total_count is a window count so the
-- UI can paginate/infinite-scroll without a second round-trip.
CREATE OR REPLACE FUNCTION public.get_seating_guests(
  p_event_id UUID,
  p_search   TEXT DEFAULT '',
  p_filter   TEXT DEFAULT 'all',
  p_limit    INT  DEFAULT 100,
  p_offset   INT  DEFAULT 0,
  p_table_id UUID DEFAULT NULL
)
RETURNS TABLE(id UUID, guest_name TEXT, party_size INT, table_id UUID, total_count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id,
         r.guest_name,
         r.party_size,
         sa.table_id,
         COUNT(*) OVER() AS total_count
  FROM rsvps r
  LEFT JOIN seating_assignments sa
    ON sa.rsvp_id = r.id AND sa.event_id = p_event_id
  WHERE r.event_id = p_event_id
    AND r.response = 'yes'
    AND (p_search IS NULL OR p_search = '' OR r.guest_name ILIKE '%' || p_search || '%')
    AND (
      p_table_id IS NOT NULL AND sa.table_id = p_table_id
      OR (p_table_id IS NULL AND (
            p_filter = 'all'
            OR (p_filter = 'seated'   AND sa.table_id IS NOT NULL)
            OR (p_filter = 'unseated' AND sa.table_id IS NULL)
      ))
    )
  ORDER BY r.guest_name, r.id
  LIMIT GREATEST(p_limit, 0) OFFSET GREATEST(p_offset, 0);
$$;

-- These RPCs are only invoked server-side (service role) after the event-owner
-- middleware has authorized the caller; keep EXECUTE off the public anon role.
REVOKE ALL ON FUNCTION public.get_table_occupancy(UUID) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.get_seating_summary(UUID) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.get_seating_guests(UUID, TEXT, TEXT, INT, INT, UUID) FROM anon, authenticated;
