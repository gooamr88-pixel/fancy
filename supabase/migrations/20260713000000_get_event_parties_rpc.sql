-- ─────────────────────────────────────────────────────────────────────────────
-- get_event_parties(): server-side filtering + pagination for the organizer's
-- RSVP list (H1 refactor).
--
-- Replaces the previous approach in guestService.listParties(), which resolved
-- the seated/meal/custom-answer filters by pulling id-sets into Node, intersecting
-- them there, then re-querying rsvp_parties with a (potentially huge) `.in('id',
-- [...])`. That path also capped post-filtered results at 5,000 rows, so large,
-- filtered events silently reported wrong totals and short pages.
--
-- This does the whole thing in one round trip: every filter is a WHERE/EXISTS
-- clause, the total is an exact COUNT over the filtered set (accurate even when a
-- page is empty), and each returned party carries the SAME nested shape the
-- frontend already consumes (dashboard/page.js maps `label`, `guests[]`,
-- `custom_answers[]`, `seating_assignments[].table_id`, `invitations[].status`).
--
-- Contract mirrors the embed the old query used:
--   *, guests(*), custom_answers(*),
--   seating_assignments(id, table_id, tables(table_name)),
--   invitations(channel, status)
-- returned as jsonb { total, parties: [...] } so the total is always present.
--
-- Search terms are pre-escaped by the caller (utils/normalize.escapeLikePattern)
-- so a guest-typed `%`/`_` can't act as a wildcard; the RPC only wraps with the
-- match-anywhere `%…%`.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_event_parties(
  p_event_id           UUID,
  p_response           TEXT DEFAULT NULL,   -- 'yes'|'no'|'maybe'|'pending'|'waitlist' (already validated)
  p_search             TEXT DEFAULT NULL,   -- pre-escaped LIKE fragment, matched as %…% on the label
  p_seated             TEXT DEFAULT NULL,   -- 'true' | 'false' | NULL (no filter)
  p_meal               TEXT DEFAULT NULL,
  p_custom_field_id    UUID DEFAULT NULL,
  p_custom_field_value TEXT DEFAULT NULL,
  p_sort               TEXT DEFAULT NULL,   -- 'name_asc'|'name_desc'|'date_asc' | default: created_at DESC
  p_limit              INT  DEFAULT 50,
  p_offset             INT  DEFAULT 0
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH filtered AS (
    SELECT p.id, p.label, p.created_at
    FROM rsvp_parties p
    WHERE p.event_id = p_event_id
      AND (p_response IS NULL OR p.response::text = p_response)
      AND (p_search IS NULL OR p.label ILIKE '%' || p_search || '%')
      AND (
        p_seated IS NULL
        OR (p_seated = 'true'  AND     EXISTS (SELECT 1 FROM seating_assignments sa WHERE sa.party_id = p.id AND sa.event_id = p_event_id))
        OR (p_seated = 'false' AND NOT EXISTS (SELECT 1 FROM seating_assignments sa WHERE sa.party_id = p.id AND sa.event_id = p_event_id))
      )
      AND (
        p_meal IS NULL
        OR EXISTS (SELECT 1 FROM guests g WHERE g.party_id = p.id AND g.meal_selection = p_meal)
      )
      AND (
        p_custom_field_id IS NULL
        OR EXISTS (
          SELECT 1 FROM custom_answers ca
          WHERE ca.party_id = p.id
            AND ca.field_id = p_custom_field_id
            -- answer_value is jsonb; `#>> '{}'` yields the scalar as unquoted text,
            -- matching the JS `String(answer_value).trim().toLowerCase()` compare.
            AND (
              p_custom_field_value IS NULL
              OR lower(btrim(ca.answer_value #>> '{}')) = lower(btrim(p_custom_field_value))
            )
        )
      )
  ),
  page AS (
    SELECT f.id,
           row_number() OVER (
             ORDER BY
               CASE WHEN p_sort = 'name_asc'  THEN f.label      END ASC  NULLS LAST,
               CASE WHEN p_sort = 'name_desc' THEN f.label      END DESC NULLS LAST,
               CASE WHEN p_sort = 'date_asc'  THEN f.created_at END ASC,
               CASE WHEN p_sort IS NULL OR p_sort NOT IN ('name_asc', 'name_desc', 'date_asc')
                    THEN f.created_at END DESC
           ) AS rn
    FROM filtered f
    ORDER BY rn
    LIMIT  GREATEST(p_limit, 0)
    OFFSET GREATEST(p_offset, 0)
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM filtered),
    'parties', COALESCE((
      SELECT jsonb_agg(party_json ORDER BY rn)
      FROM (
        SELECT
          pg.rn,
          to_jsonb(p)
            || jsonb_build_object(
                 'guests', COALESCE((
                   SELECT jsonb_agg(to_jsonb(g) ORDER BY g.is_primary_contact DESC, g.id)
                   FROM guests g WHERE g.party_id = p.id
                 ), '[]'::jsonb),
                 'custom_answers', COALESCE((
                   SELECT jsonb_agg(to_jsonb(ca) ORDER BY ca.created_at, ca.id)
                   FROM custom_answers ca WHERE ca.party_id = p.id
                 ), '[]'::jsonb),
                 'seating_assignments', COALESCE((
                   SELECT jsonb_agg(jsonb_build_object(
                            'id', sa.id,
                            'table_id', sa.table_id,
                            'tables', CASE WHEN t.id IS NULL THEN NULL
                                      ELSE jsonb_build_object('table_name', t.table_name) END)
                          ORDER BY sa.assigned_at, sa.id)
                   FROM seating_assignments sa
                   LEFT JOIN tables t ON t.id = sa.table_id
                   WHERE sa.party_id = p.id AND sa.event_id = p_event_id
                 ), '[]'::jsonb),
                 'invitations', COALESCE((
                   SELECT jsonb_agg(jsonb_build_object('channel', i.channel, 'status', i.status)
                          ORDER BY i.created_at, i.id)
                   FROM invitations i WHERE i.party_id = p.id
                 ), '[]'::jsonb)
               ) AS party_json
        FROM page pg
        JOIN rsvp_parties p ON p.id = pg.id
      ) x
    ), '[]'::jsonb)
  );
$$;

-- Callable only by the backend (service role). Mirrors the other read RPCs from
-- the guest-experience rebuild — never exposed to anon/authenticated clients.
REVOKE ALL ON FUNCTION public.get_event_parties(UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, INT, INT) FROM anon, authenticated;
