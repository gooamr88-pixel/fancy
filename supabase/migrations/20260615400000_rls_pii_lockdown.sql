-- ═══════════════════════════════════════════════════════════
-- FANCY RSVP — CRITICAL RLS PII LOCKDOWN
-- ═══════════════════════════════════════════════════════════
-- Problem: prior migrations granted the `public` (anon) role broad SELECT/INSERT
-- on guest data. Because the anon key ships in the browser bundle, ANYONE could
-- query PostgREST directly, e.g.
--     GET {SUPABASE_URL}/rest/v1/rsvps?select=guest_name,email,phone&event_id=eq.<uuid>
-- and exfiltrate every guest's name/email/phone for every active event, plus meal
-- selections, custom answers, seating, and the events row (incl. access_password).
--
-- This platform does NOT use Supabase Auth for organizers — the Express API talks
-- to Postgres with the SERVICE ROLE key, which bypasses RLS entirely. Every public
-- guest interaction (view event, submit/search RSVP, seating lookup, self check-in)
-- is served by that backend. Therefore the anon role needs NO direct table access.
--
-- This migration revokes all anon/public table policies. The `authenticated`
-- organizer/super_admin policies are intentionally LEFT IN PLACE as defense-in-depth
-- (harmless: the backend uses the service role; a future Supabase-Auth migration can
-- rely on them). Realtime that previously rode on the permissive anon SELECT is
-- replaced in the app layer by authenticated polling of the backend API.
-- ═══════════════════════════════════════════════════════════

BEGIN;

-- EVENTS — drop public read (exposed access_password + is_paid). Backend serves the
-- public event page via /public/events/:slug and strips sensitive fields itself.
DROP POLICY IF EXISTS guest_select_events  ON events;
DROP POLICY IF EXISTS public_read_events   ON events;
DROP POLICY IF EXISTS anon_select_events   ON events;

-- RSVPS — drop ALL public access (PII: name/email/phone).
DROP POLICY IF EXISTS guest_select_rsvps   ON rsvps;
DROP POLICY IF EXISTS guest_insert_rsvps   ON rsvps;
DROP POLICY IF EXISTS public_select_rsvps  ON rsvps;
DROP POLICY IF EXISTS public_insert_rsvps  ON rsvps;
DROP POLICY IF EXISTS anon_select_rsvps    ON rsvps;
DROP POLICY IF EXISTS anon_insert_rsvps    ON rsvps;

-- RSVP_GUESTS — drop ALL public access (per-person names, meals, dietary notes).
DROP POLICY IF EXISTS guest_select_rsvp_guests  ON rsvp_guests;
DROP POLICY IF EXISTS guest_insert_rsvp_guests  ON rsvp_guests;
DROP POLICY IF EXISTS public_select_rsvp_guests ON rsvp_guests;
DROP POLICY IF EXISTS public_insert_rsvp_guests ON rsvp_guests;

-- CUSTOM_ANSWERS — drop ALL public access.
DROP POLICY IF EXISTS guest_select_answers   ON custom_answers;
DROP POLICY IF EXISTS guest_insert_answers   ON custom_answers;
DROP POLICY IF EXISTS public_select_answers  ON custom_answers;
DROP POLICY IF EXISTS public_insert_answers  ON custom_answers;

-- RSVP_FORM_FIELDS — drop public read. Served via the backend public event payload.
DROP POLICY IF EXISTS guest_select_fields   ON rsvp_form_fields;
DROP POLICY IF EXISTS public_select_fields  ON rsvp_form_fields;
DROP POLICY IF EXISTS anon_select_fields    ON rsvp_form_fields;

-- TABLES — drop public read.
DROP POLICY IF EXISTS guest_select_tables   ON tables;
DROP POLICY IF EXISTS public_select_tables  ON tables;
DROP POLICY IF EXISTS anon_select_tables    ON tables;

-- SEATING_ASSIGNMENTS — drop public read (guest→table mapping). Seating lookup is
-- served by the backend /public/events/:slug/seating/search endpoint.
DROP POLICY IF EXISTS guest_select_seating   ON seating_assignments;
DROP POLICY IF EXISTS public_select_seating  ON seating_assignments;
DROP POLICY IF EXISTS anon_select_seating    ON seating_assignments;

-- RLS stays ENABLED on every table, so with no public policy the anon role is
-- denied by default. The service-role backend is unaffected (it bypasses RLS).

COMMIT;
