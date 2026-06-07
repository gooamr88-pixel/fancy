-- ═══════════════════════════════════════════════════════════
-- FANCY RSVP - DATABASE SECURITY & RLS HARDENING MIGRATION
-- Target: PostgreSQL / Supabase Migration
-- ═══════════════════════════════════════════════════════════

-- 1. USER ROLES & SUPER ADMIN HELPER

CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL,           -- Links to auth.users (Supabase Auth)
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'organizer')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on user_roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Helper to check if a user is a super admin
CREATE OR REPLACE FUNCTION is_super_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = p_user_id AND role = 'super_admin'
    );
END;
$$;


-- 2. MANUAL CASH APPROVAL STORED PROCEDURE

CREATE OR REPLACE FUNCTION approve_event_cash(
    p_event_id UUID,
    p_approved_by UUID,
    p_amount_cents INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_is_admin BOOLEAN;
    v_payment_id UUID;
    v_org_id UUID;
BEGIN
    -- Verify approver is super admin
    SELECT is_super_admin(p_approved_by) INTO v_is_admin;
    IF NOT v_is_admin THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Only super admins can approve payments.');
    END IF;

    -- Verify event exists
    SELECT org_id INTO v_org_id FROM events WHERE id = p_event_id;
    IF v_org_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'EVENT_NOT_FOUND', 'message', 'Specified event not found.');
    END IF;

    -- Update event payment state
    UPDATE events
    SET is_paid = true,
        status = 'active',
        updated_at = now()
    WHERE id = p_event_id;

    -- Insert payment record
    INSERT INTO event_payments (
        event_id,
        amount_cents,
        currency,
        status,
        payment_method,
        approved_by,
        completed_at
    ) VALUES (
        p_event_id,
        p_amount_cents,
        'usd',
        'completed',
        'cash_manual',
        p_approved_by,
        now()
    ) RETURNING id INTO v_payment_id;

    -- Insert activity log
    INSERT INTO activity_logs (
        event_id,
        actor_id,
        action,
        entity_type,
        entity_id,
        metadata
    ) VALUES (
        p_event_id,
        p_approved_by,
        'event_payment_manual_approved',
        'event_payment',
        v_payment_id,
        jsonb_build_object('amount_cents', p_amount_cents)
    );

    RETURN jsonb_build_object('success', true, 'payment_id', v_payment_id);
END;
$$;


-- 3. ENABLE RLS GLOBALLY ON ALL TABLES

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rsvp_form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE rsvp_guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE super_admin_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;


-- 4. RE-DEFINE STRICT RLS POLICIES

-- Helper macro function (or direct SQL) to drop policies first
DROP POLICY IF EXISTS organizer_all_roles ON user_roles;
DROP POLICY IF EXISTS admin_all_roles ON user_roles;

CREATE POLICY admin_all_roles ON user_roles
    FOR ALL TO authenticated
    USING (is_super_admin(auth.uid()))
    WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY organizer_read_own_role ON user_roles
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- Organizations Policies
DROP POLICY IF EXISTS organizer_all_organizations ON organizations;
DROP POLICY IF EXISTS guest_select_organizations ON organizations;

CREATE POLICY organizer_all_organizations ON organizations
    FOR ALL TO authenticated
    USING (is_super_admin(auth.uid()) OR owner_user_id = auth.uid())
    WITH CHECK (is_super_admin(auth.uid()) OR owner_user_id = auth.uid());

-- Events Policies
DROP POLICY IF EXISTS organizer_all_events ON events;
DROP POLICY IF EXISTS guest_select_events ON events;

CREATE POLICY organizer_all_events ON events
    FOR ALL TO authenticated
    USING (is_super_admin(auth.uid()) OR org_id IN (SELECT id FROM organizations WHERE owner_user_id = auth.uid()))
    WITH CHECK (is_super_admin(auth.uid()) OR org_id IN (SELECT id FROM organizations WHERE owner_user_id = auth.uid()));

CREATE POLICY guest_select_events ON events
    FOR SELECT TO public
    USING (status = 'active');

-- Tables Policies
DROP POLICY IF EXISTS organizer_all_tables ON tables;
DROP POLICY IF EXISTS guest_select_tables ON tables;

CREATE POLICY organizer_all_tables ON tables
    FOR ALL TO authenticated
    USING (is_super_admin(auth.uid()) OR EXISTS (
        SELECT 1 FROM events e 
        JOIN organizations o ON e.org_id = o.id 
        WHERE e.id = tables.event_id AND o.owner_user_id = auth.uid()
    ))
    WITH CHECK (is_super_admin(auth.uid()) OR EXISTS (
        SELECT 1 FROM events e 
        JOIN organizations o ON e.org_id = o.id 
        WHERE e.id = tables.event_id AND o.owner_user_id = auth.uid()
    ));

CREATE POLICY guest_select_tables ON tables
    FOR SELECT TO public
    USING (EXISTS (SELECT 1 FROM events WHERE events.id = tables.event_id AND events.status = 'active'));

-- RSVP Form Fields Policies
DROP POLICY IF EXISTS organizer_all_fields ON rsvp_form_fields;
DROP POLICY IF EXISTS guest_select_fields ON rsvp_form_fields;

CREATE POLICY organizer_all_fields ON rsvp_form_fields
    FOR ALL TO authenticated
    USING (is_super_admin(auth.uid()) OR EXISTS (
        SELECT 1 FROM events e 
        JOIN organizations o ON e.org_id = o.id 
        WHERE e.id = rsvp_form_fields.event_id AND o.owner_user_id = auth.uid()
    ))
    WITH CHECK (is_super_admin(auth.uid()) OR EXISTS (
        SELECT 1 FROM events e 
        JOIN organizations o ON e.org_id = o.id 
        WHERE e.id = rsvp_form_fields.event_id AND o.owner_user_id = auth.uid()
    ));

CREATE POLICY guest_select_fields ON rsvp_form_fields
    FOR SELECT TO public
    USING (EXISTS (SELECT 1 FROM events WHERE events.id = rsvp_form_fields.event_id AND events.status = 'active'));

-- RSVPs Policies
DROP POLICY IF EXISTS organizer_all_rsvps ON rsvps;
DROP POLICY IF EXISTS guest_insert_rsvps ON rsvps;
DROP POLICY IF EXISTS guest_select_rsvps ON rsvps;

CREATE POLICY organizer_all_rsvps ON rsvps
    FOR ALL TO authenticated
    USING (is_super_admin(auth.uid()) OR EXISTS (
        SELECT 1 FROM events e 
        JOIN organizations o ON e.org_id = o.id 
        WHERE e.id = rsvps.event_id AND o.owner_user_id = auth.uid()
    ))
    WITH CHECK (is_super_admin(auth.uid()) OR EXISTS (
        SELECT 1 FROM events e 
        JOIN organizations o ON e.org_id = o.id 
        WHERE e.id = rsvps.event_id AND o.owner_user_id = auth.uid()
    ));

CREATE POLICY guest_insert_rsvps ON rsvps
    FOR INSERT TO public
    WITH CHECK (EXISTS (SELECT 1 FROM events WHERE events.id = rsvps.event_id AND events.status = 'active'));

CREATE POLICY guest_select_rsvps ON rsvps
    FOR SELECT TO public
    USING (EXISTS (
        SELECT 1 FROM events 
        WHERE events.id = rsvps.event_id 
          AND events.status = 'active' 
          AND events.privacy_mode = 'public'
    ));

-- RSVP Guests Policies
DROP POLICY IF EXISTS organizer_all_rsvp_guests ON rsvp_guests;
DROP POLICY IF EXISTS guest_all_rsvp_guests ON rsvp_guests;

CREATE POLICY organizer_all_rsvp_guests ON rsvp_guests
    FOR ALL TO authenticated
    USING (is_super_admin(auth.uid()) OR EXISTS (
        SELECT 1 FROM rsvps r
        JOIN events e ON r.event_id = e.id
        JOIN organizations o ON e.org_id = o.id
        WHERE r.id = rsvp_guests.rsvp_id AND o.owner_user_id = auth.uid()
    ))
    WITH CHECK (is_super_admin(auth.uid()) OR EXISTS (
        SELECT 1 FROM rsvps r
        JOIN events e ON r.event_id = e.id
        JOIN organizations o ON e.org_id = o.id
        WHERE r.id = rsvp_guests.rsvp_id AND o.owner_user_id = auth.uid()
    ));

CREATE POLICY guest_all_rsvp_guests ON rsvp_guests
    FOR ALL TO public
    USING (EXISTS (
        SELECT 1 FROM rsvps r
        JOIN events e ON r.event_id = e.id
        WHERE r.id = rsvp_guests.rsvp_id AND e.status = 'active'
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM rsvps r
        JOIN events e ON r.event_id = e.id
        WHERE r.id = rsvp_guests.rsvp_id AND e.status = 'active'
    ));

-- Custom Answers Policies
DROP POLICY IF EXISTS organizer_all_answers ON custom_answers;
DROP POLICY IF EXISTS guest_all_answers ON custom_answers;

CREATE POLICY organizer_all_answers ON custom_answers
    FOR ALL TO authenticated
    USING (is_super_admin(auth.uid()) OR EXISTS (
        SELECT 1 FROM rsvps r
        JOIN events e ON r.event_id = e.id
        JOIN organizations o ON e.org_id = o.id
        WHERE r.id = custom_answers.rsvp_id AND o.owner_user_id = auth.uid()
    ))
    WITH CHECK (is_super_admin(auth.uid()) OR EXISTS (
        SELECT 1 FROM rsvps r
        JOIN events e ON r.event_id = e.id
        JOIN organizations o ON e.org_id = o.id
        WHERE r.id = custom_answers.rsvp_id AND o.owner_user_id = auth.uid()
    ));

CREATE POLICY guest_all_answers ON custom_answers
    FOR ALL TO public
    USING (EXISTS (
        SELECT 1 FROM rsvps r
        JOIN events e ON r.event_id = e.id
        WHERE r.id = custom_answers.rsvp_id AND e.status = 'active'
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM rsvps r
        JOIN events e ON r.event_id = e.id
        WHERE r.id = custom_answers.rsvp_id AND e.status = 'active'
    ));

-- Seating Assignments Policies
DROP POLICY IF EXISTS organizer_all_seating ON seating_assignments;
DROP POLICY IF EXISTS guest_select_seating ON seating_assignments;

CREATE POLICY organizer_all_seating ON seating_assignments
    FOR ALL TO authenticated
    USING (is_super_admin(auth.uid()) OR EXISTS (
        SELECT 1 FROM events e 
        JOIN organizations o ON e.org_id = o.id 
        WHERE e.id = seating_assignments.event_id AND o.owner_user_id = auth.uid()
    ))
    WITH CHECK (is_super_admin(auth.uid()) OR EXISTS (
        SELECT 1 FROM events e 
        JOIN organizations o ON e.org_id = o.id 
        WHERE e.id = seating_assignments.event_id AND o.owner_user_id = auth.uid()
    ));

CREATE POLICY guest_select_seating ON seating_assignments
    FOR SELECT TO public
    USING (EXISTS (SELECT 1 FROM events WHERE events.id = seating_assignments.event_id AND events.status = 'active'));

-- Check-ins Policies
DROP POLICY IF EXISTS organizer_all_checkins ON check_ins;

CREATE POLICY organizer_all_checkins ON check_ins
    FOR ALL TO authenticated
    USING (is_super_admin(auth.uid()) OR EXISTS (
        SELECT 1 FROM events e 
        JOIN organizations o ON e.org_id = o.id 
        WHERE e.id = check_ins.event_id AND o.owner_user_id = auth.uid()
    ))
    WITH CHECK (is_super_admin(auth.uid()) OR EXISTS (
        SELECT 1 FROM events e 
        JOIN organizations o ON e.org_id = o.id 
        WHERE e.id = check_ins.event_id AND o.owner_user_id = auth.uid()
    ));

-- Event Payments Policies
DROP POLICY IF EXISTS organizer_read_payments ON event_payments;

CREATE POLICY organizer_read_payments ON event_payments
    FOR SELECT TO authenticated
    USING (is_super_admin(auth.uid()) OR EXISTS (
        SELECT 1 FROM events e 
        JOIN organizations o ON e.org_id = o.id 
        WHERE e.id = event_payments.event_id AND o.owner_user_id = auth.uid()
    ));

-- SMS Credit Wallets Policies
DROP POLICY IF EXISTS organizer_select_wallet ON sms_credit_wallets;

CREATE POLICY organizer_select_wallet ON sms_credit_wallets
    FOR SELECT TO authenticated
    USING (is_super_admin(auth.uid()) OR EXISTS (
        SELECT 1 FROM events e 
        JOIN organizations o ON e.org_id = o.id 
        WHERE e.id = sms_credit_wallets.event_id AND o.owner_user_id = auth.uid()
    ));

-- SMS Credit Ledger Policies
DROP POLICY IF EXISTS organizer_select_ledger ON sms_credit_ledger;

CREATE POLICY organizer_select_ledger ON sms_credit_ledger
    FOR SELECT TO authenticated
    USING (is_super_admin(auth.uid()) OR EXISTS (
        SELECT 1 FROM events e 
        JOIN organizations o ON e.org_id = o.id 
        WHERE e.id = sms_credit_ledger.event_id AND o.owner_user_id = auth.uid()
    ));

-- Super Admin Config Policies
DROP POLICY IF EXISTS admin_all_config ON super_admin_config;
DROP POLICY IF EXISTS organizer_select_config ON super_admin_config;

CREATE POLICY admin_all_config ON super_admin_config
    FOR ALL TO authenticated
    USING (is_super_admin(auth.uid()))
    WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY organizer_select_config ON super_admin_config
    FOR SELECT TO authenticated
    USING (true);

-- Activity Logs Policies
DROP POLICY IF EXISTS organizer_select_logs ON activity_logs;

CREATE POLICY organizer_select_logs ON activity_logs
    FOR SELECT TO authenticated
    USING (is_super_admin(auth.uid()) OR EXISTS (
        SELECT 1 FROM events e 
        JOIN organizations o ON e.org_id = o.id 
        WHERE e.id = activity_logs.event_id AND o.owner_user_id = auth.uid()
    ));
