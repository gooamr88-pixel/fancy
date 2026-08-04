-- ============================================================================
-- Seating map — allow the eight venue zones the organizer palette already offers
--
-- 20260616000000_seating_elements_scale.sql widened `tables_shape_check` from
-- the original 2 shapes to 13. The seating-map UI later grew its zone catalogue
-- to 14 zone types (restroom, coat check, gift table, cake table, photo booth,
-- welcome desk, buffet, lounge) but neither this CHECK nor the API's ZONE_SHAPES
-- whitelist followed, so picking any of those eight from the palette failed with
-- `Invalid shape "<name>"` — two thirds of the zone picker was dead.
--
-- Additive only: every previously-valid shape stays valid, so this cannot
-- invalidate an existing row and needs no data backfill.
-- ============================================================================

ALTER TABLE tables DROP CONSTRAINT IF EXISTS tables_shape_check;
ALTER TABLE tables ADD CONSTRAINT tables_shape_check CHECK (shape IN (
  -- seatable table shapes (legacy 'rectangular' kept for back-compat)
  'round', 'oval', 'square', 'rectangle', 'rectangular', 'banquet', 'head',
  -- non-seating venue zones
  'stage', 'dance_floor', 'bar', 'dj_booth', 'entrance', 'custom',
  'restroom', 'coat_check', 'gift_table', 'cake_table',
  'photo_booth', 'welcome_desk', 'buffet', 'lounge'
));

COMMENT ON CONSTRAINT tables_shape_check ON tables IS
  'Keep in sync with backend/controllers/tableController.js (TABLE_SHAPES/ZONE_SHAPES) and the SHAPES catalogues in frontend/src/app/dashboard/seating-map/page.js, [slug]/rsvp/SeatingMiniMap.js and [slug]/rsvp/SeatingMapFullscreen.js.';
