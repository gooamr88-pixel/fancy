-- ═══════════════════════════════════════════════════════════
-- FANCY RSVP - RLS SECURITY FIX MIGRATION
-- Drops and re-creates all public/guest-facing RLS policies
-- to close overly permissive access from schema.sql defaults.
-- Organizer / super_admin policies are NOT touched.
-- ═══════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────
-- 1. EVENTS — fix public read policy
-- ─────────────────────────────────────────────────────────

-- Drop every known guest/public policy name on events
DROP POLICY IF EXISTS guest_select_events     ON events;
DROP POLICY IF EXISTS public_read_events      ON events;
DROP POLICY IF EXISTS anon_select_events      ON events;

-- Re-create: only show paid+active events, never expose is_paid
CREATE POLICY public_read_events ON events
    FOR SELECT TO public
    USING (is_paid = true AND status = 'active');


-- ─────────────────────────────────────────────────────────
-- 2. RSVPS — tighten INSERT + SELECT, remove UPDATE/DELETE
-- ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS guest_insert_rsvps    ON rsvps;
DROP POLICY IF EXISTS guest_select_rsvps    ON rsvps;
DROP POLICY IF EXISTS guest_update_rsvps    ON rsvps;
DROP POLICY IF EXISTS guest_delete_rsvps    ON rsvps;
DROP POLICY IF EXISTS anon_insert_rsvps     ON rsvps;
DROP POLICY IF EXISTS anon_select_rsvps     ON rsvps;
DROP POLICY IF EXISTS anon_update_rsvps     ON rsvps;
DROP POLICY IF EXISTS anon_delete_rsvps     ON rsvps;
DROP POLICY IF EXISTS public_insert_rsvps   ON rsvps;
DROP POLICY IF EXISTS public_select_rsvps   ON rsvps;
DROP POLICY IF EXISTS public_update_rsvps   ON rsvps;
DROP POLICY IF EXISTS public_delete_rsvps   ON rsvps;
DROP POLICY IF EXISTS guest_all_rsvps       ON rsvps;

-- Public INSERT: only into paid + active events
CREATE POLICY guest_insert_rsvps ON rsvps
    FOR INSERT TO public
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM events
            WHERE events.id = rsvps.event_id
              AND events.is_paid = true
              AND events.status = 'active'
        )
    );

-- Public SELECT: own RSVP by id, OR RSVPs for active events
CREATE POLICY guest_select_rsvps ON rsvps
    FOR SELECT TO public
    USING (
        EXISTS (
            SELECT 1 FROM events
            WHERE events.id = rsvps.event_id
              AND events.is_paid = true
              AND events.status = 'active'
        )
    );

-- NO public UPDATE or DELETE policies for rsvps


-- ─────────────────────────────────────────────────────────
-- 3. RSVP_GUESTS — tighten INSERT + SELECT, remove UPDATE/DELETE
-- ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS guest_insert_rsvp_guests  ON rsvp_guests;
DROP POLICY IF EXISTS guest_select_rsvp_guests  ON rsvp_guests;
DROP POLICY IF EXISTS guest_update_rsvp_guests  ON rsvp_guests;
DROP POLICY IF EXISTS guest_delete_rsvp_guests  ON rsvp_guests;
DROP POLICY IF EXISTS guest_all_rsvp_guests     ON rsvp_guests;
DROP POLICY IF EXISTS anon_insert_rsvp_guests   ON rsvp_guests;
DROP POLICY IF EXISTS anon_select_rsvp_guests   ON rsvp_guests;
DROP POLICY IF EXISTS anon_all_rsvp_guests      ON rsvp_guests;
DROP POLICY IF EXISTS public_insert_rsvp_guests ON rsvp_guests;
DROP POLICY IF EXISTS public_select_rsvp_guests ON rsvp_guests;

-- Public INSERT: only for RSVPs belonging to paid + active events
CREATE POLICY guest_insert_rsvp_guests ON rsvp_guests
    FOR INSERT TO public
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM rsvps r
            JOIN events e ON r.event_id = e.id
            WHERE r.id = rsvp_guests.rsvp_id
              AND e.is_paid = true
              AND e.status = 'active'
        )
    );

-- Public SELECT: only for paid + active events
CREATE POLICY guest_select_rsvp_guests ON rsvp_guests
    FOR SELECT TO public
    USING (
        EXISTS (
            SELECT 1 FROM rsvps r
            JOIN events e ON r.event_id = e.id
            WHERE r.id = rsvp_guests.rsvp_id
              AND e.is_paid = true
              AND e.status = 'active'
        )
    );

-- NO public UPDATE or DELETE policies for rsvp_guests


-- ─────────────────────────────────────────────────────────
-- 4. CUSTOM_ANSWERS — tighten INSERT + SELECT, remove UPDATE/DELETE
-- ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS guest_insert_answers    ON custom_answers;
DROP POLICY IF EXISTS guest_select_answers    ON custom_answers;
DROP POLICY IF EXISTS guest_update_answers    ON custom_answers;
DROP POLICY IF EXISTS guest_delete_answers    ON custom_answers;
DROP POLICY IF EXISTS guest_all_answers       ON custom_answers;
DROP POLICY IF EXISTS anon_insert_answers     ON custom_answers;
DROP POLICY IF EXISTS anon_select_answers     ON custom_answers;
DROP POLICY IF EXISTS anon_all_answers        ON custom_answers;
DROP POLICY IF EXISTS public_insert_answers   ON custom_answers;
DROP POLICY IF EXISTS public_select_answers   ON custom_answers;

-- Public INSERT: only for RSVPs belonging to paid + active events
CREATE POLICY guest_insert_answers ON custom_answers
    FOR INSERT TO public
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM rsvps r
            JOIN events e ON r.event_id = e.id
            WHERE r.id = custom_answers.rsvp_id
              AND e.is_paid = true
              AND e.status = 'active'
        )
    );

-- Public SELECT: only for paid + active events
CREATE POLICY guest_select_answers ON custom_answers
    FOR SELECT TO public
    USING (
        EXISTS (
            SELECT 1 FROM rsvps r
            JOIN events e ON r.event_id = e.id
            WHERE r.id = custom_answers.rsvp_id
              AND e.is_paid = true
              AND e.status = 'active'
        )
    );

-- NO public UPDATE or DELETE policies for custom_answers


-- ─────────────────────────────────────────────────────────
-- 5. RSVP_FORM_FIELDS — SELECT only for active events
-- ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS guest_select_fields       ON rsvp_form_fields;
DROP POLICY IF EXISTS guest_insert_fields       ON rsvp_form_fields;
DROP POLICY IF EXISTS guest_update_fields       ON rsvp_form_fields;
DROP POLICY IF EXISTS guest_delete_fields       ON rsvp_form_fields;
DROP POLICY IF EXISTS guest_all_fields          ON rsvp_form_fields;
DROP POLICY IF EXISTS anon_select_fields        ON rsvp_form_fields;
DROP POLICY IF EXISTS public_select_fields      ON rsvp_form_fields;

-- Public SELECT: only for paid + active events
CREATE POLICY guest_select_fields ON rsvp_form_fields
    FOR SELECT TO public
    USING (
        EXISTS (
            SELECT 1 FROM events
            WHERE events.id = rsvp_form_fields.event_id
              AND events.is_paid = true
              AND events.status = 'active'
        )
    );

-- NO public INSERT, UPDATE, or DELETE policies for rsvp_form_fields


-- ─────────────────────────────────────────────────────────
-- 6. SEATING_ASSIGNMENTS — SELECT only for active events
-- ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS guest_select_seating      ON seating_assignments;
DROP POLICY IF EXISTS guest_insert_seating      ON seating_assignments;
DROP POLICY IF EXISTS guest_update_seating      ON seating_assignments;
DROP POLICY IF EXISTS guest_delete_seating      ON seating_assignments;
DROP POLICY IF EXISTS guest_all_seating         ON seating_assignments;
DROP POLICY IF EXISTS anon_select_seating       ON seating_assignments;
DROP POLICY IF EXISTS public_select_seating     ON seating_assignments;

-- Public SELECT: only for paid + active events
CREATE POLICY guest_select_seating ON seating_assignments
    FOR SELECT TO public
    USING (
        EXISTS (
            SELECT 1 FROM events
            WHERE events.id = seating_assignments.event_id
              AND events.is_paid = true
              AND events.status = 'active'
        )
    );

-- NO public INSERT, UPDATE, or DELETE policies for seating_assignments


-- ─────────────────────────────────────────────────────────
-- 7. SUPER_ADMIN_CONFIG — remove public access, auth-only SELECT
-- ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS guest_select_config           ON super_admin_config;
DROP POLICY IF EXISTS anon_select_config            ON super_admin_config;
DROP POLICY IF EXISTS public_select_config          ON super_admin_config;
DROP POLICY IF EXISTS public_read_super_admin_config ON super_admin_config;

-- The organizer_select_config policy already limits to authenticated.
-- Re-create it to be explicit (idempotent):
DROP POLICY IF EXISTS organizer_select_config ON super_admin_config;

CREATE POLICY organizer_select_config ON super_admin_config
    FOR SELECT TO authenticated
    USING (true);

-- admin_all_config (FOR ALL TO authenticated, super_admin only) stays untouched.

COMMIT;
