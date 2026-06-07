-- ═══════════════════════════════════════════════════════════
-- FANCY RSVP - DATABASE INITIALIZATION SCHEMA
-- Target: PostgreSQL / Supabase Migration
-- ═══════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── 1. CORE DATABASE TABLES ───

-- Events Table
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,                    -- Links to auth.users in Supabase Auth
    slug TEXT UNIQUE NOT NULL,
    template_type TEXT NOT NULL DEFAULT 'custom',
    title TEXT NOT NULL,
    description TEXT,
    event_date TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
    is_paid BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_events_slug ON events(slug);

-- Tables (Venue Layout) Table
CREATE TABLE IF NOT EXISTS tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    table_name TEXT NOT NULL,
    max_capacity INTEGER NOT NULL CHECK (max_capacity > 0),
    shape TEXT DEFAULT 'round' CHECK (shape IN ('round', 'rectangular')),
    position_x DECIMAL DEFAULT 0,
    position_y DECIMAL DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RSVPs (Guest Attendance responses) Table
CREATE TABLE IF NOT EXISTS rsvps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    guest_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    response TEXT NOT NULL CHECK (response IN ('yes', 'no', 'pending')),
    party_size INTEGER DEFAULT 1 CHECK (party_size >= 1),
    notes TEXT,
    submitted_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rsvps_event_id ON rsvps(event_id);

-- Seating Assignments Table
CREATE TABLE IF NOT EXISTS seating_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    rsvp_id UUID NOT NULL REFERENCES rsvps(id) ON DELETE CASCADE,
    table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(event_id, rsvp_id)
);

CREATE INDEX IF NOT EXISTS idx_seating_table ON seating_assignments(table_id);

-- SMS wallets
CREATE TABLE IF NOT EXISTS sms_credit_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID UNIQUE NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    credits_purchased INTEGER DEFAULT 0 CHECK (credits_purchased >= 0),
    credits_used INTEGER DEFAULT 0 CHECK (credits_used >= 0),
    credits_remaining INTEGER GENERATED ALWAYS AS (credits_purchased - credits_used) STORED,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- SMS transaction ledger
CREATE TABLE IF NOT EXISTS sms_credit_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES sms_credit_wallets(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'consumption', 'refund')),
    credits INTEGER NOT NULL,
    sms_recipient TEXT,
    sms_sid TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);


-- ─── 2. STRICT ROW LEVEL SECURITY (RLS) POLICIES ───

-- Enable RLS globally
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE seating_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_credit_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_credit_ledger ENABLE ROW LEVEL SECURITY;

-- 2.1 Events RLS Policies
-- Organizers have full CRUD over their own events
CREATE POLICY organizer_all_events ON events
    FOR ALL TO authenticated
    USING (auth.uid() = org_id)
    WITH CHECK (auth.uid() = org_id);

-- Guests can select public active events
CREATE POLICY guest_select_events ON events
    FOR SELECT TO public
    USING (status = 'active');

-- 2.2 Tables RLS Policies
-- Organizers have full CRUD over tables of their owned events
CREATE POLICY organizer_all_tables ON tables
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM events WHERE events.id = tables.event_id AND events.org_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM events WHERE events.id = tables.event_id AND events.org_id = auth.uid()));

-- Guests can view table layouts
CREATE POLICY guest_select_tables ON tables
    FOR SELECT TO public
    USING (true);

-- 2.3 RSVPs RLS Policies
-- Organizers have full CRUD over RSVPs of their owned events
CREATE POLICY organizer_all_rsvps ON rsvps
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM events WHERE events.id = rsvps.event_id AND events.org_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM events WHERE events.id = rsvps.event_id AND events.org_id = auth.uid()));

-- Guests can insert their own RSVPs
CREATE POLICY guest_insert_rsvps ON rsvps
    FOR INSERT TO public
    WITH CHECK (true);

-- Guests can view RSVPs (for public attendance listing/lookup if configured)
CREATE POLICY guest_select_rsvps ON rsvps
    FOR SELECT TO public
    USING (true);

-- 2.4 Seating Assignments RLS Policies
-- Organizers have full CRUD over assignments of their owned events
CREATE POLICY organizer_all_seating ON seating_assignments
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM events WHERE events.id = seating_assignments.event_id AND events.org_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM events WHERE events.id = seating_assignments.event_id AND events.org_id = auth.uid()));

-- Guests can see seating assignments (to see their seats)
CREATE POLICY guest_select_seating ON seating_assignments
    FOR SELECT TO public
    USING (true);

-- 2.5 SMS Wallets RLS Policies
-- Organizers can select their event wallet details
CREATE POLICY organizer_select_wallet ON sms_credit_wallets
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM events WHERE events.id = sms_credit_wallets.event_id AND events.org_id = auth.uid()));

-- 2.6 SMS Ledger RLS Policies
-- Organizers can view credit transactions
CREATE POLICY organizer_select_ledger ON sms_credit_ledger
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM events WHERE events.id = sms_credit_ledger.event_id AND events.org_id = auth.uid()));


-- ─── 3. CONCURRENCY-SAFE RPCs & TRANSACTION FUNCTIONS ───

-- Safe Seating Function using Row-level Lock (FOR UPDATE)
CREATE OR REPLACE FUNCTION assign_seat_safe(
    p_event_id UUID,
    p_rsvp_id UUID,
    p_table_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_max_capacity INTEGER;
    v_current_occupied INTEGER;
    v_party_size INTEGER;
    v_remaining INTEGER;
    v_assignment_id UUID;
    v_existing UUID;
    v_table_name TEXT;
BEGIN
    -- Check if guest is already assigned
    SELECT id INTO v_existing
    FROM seating_assignments
    WHERE event_id = p_event_id AND rsvp_id = p_rsvp_id;

    IF v_existing IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'ALREADY_ASSIGNED',
            'message', 'This guest is already assigned to a table.'
        );
    END IF;

    -- Row Lock the table row dynamically using FOR UPDATE to prevent concurrent overbooking
    SELECT max_capacity, table_name
    INTO v_max_capacity, v_table_name
    FROM tables
    WHERE id = p_table_id AND event_id = p_event_id
    FOR UPDATE;

    IF v_max_capacity IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'TABLE_NOT_FOUND',
            'message', 'Specified table not found.'
        );
    END IF;

    -- Calculate current occupied count at the locked table
    SELECT COALESCE(SUM(r.party_size), 0)
    INTO v_current_occupied
    FROM seating_assignments sa
    JOIN rsvps r ON r.id = sa.rsvp_id
    WHERE sa.table_id = p_table_id;

    -- Fetch party size of guest
    SELECT party_size INTO v_party_size
    FROM rsvps
    WHERE id = p_rsvp_id AND event_id = p_event_id AND response = 'yes';

    IF v_party_size IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'RSVP_NOT_FOUND',
            'message', 'RSVP not found or guest is not attending.'
        );
    END IF;

    -- Capacity Assertion
    v_remaining := v_max_capacity - v_current_occupied;
    IF v_party_size > v_remaining THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'CAPACITY_EXCEEDED',
            'message', format('%s has %s remaining seats, party size is %s.', v_table_name, v_remaining, v_party_size)
        );
    END IF;

    -- Insert atomic seating assignment
    INSERT INTO seating_assignments (event_id, rsvp_id, table_id)
    VALUES (p_event_id, p_rsvp_id, p_table_id)
    RETURNING id INTO v_assignment_id;

    RETURN jsonb_build_object(
        'success', true,
        'assignment_id', v_assignment_id,
        'seats_remaining', v_remaining - v_party_size
    );
END;
$$;


-- Atomic SMS Credit Transaction Checker/Deductor
CREATE OR REPLACE FUNCTION deduct_sms_credit_atomic(
    p_event_id UUID,
    p_phone TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet_id UUID;
    v_remaining INTEGER;
    v_ledger_id UUID;
BEGIN
    -- Row-lock the wallet to prevent concurrent double-spending
    SELECT id, (credits_purchased - credits_used) 
    INTO v_wallet_id, v_remaining
    FROM sms_credit_wallets
    WHERE event_id = p_event_id
    FOR UPDATE;

    IF v_wallet_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'NO_WALLET');
    END IF;

    IF v_remaining < 1 THEN
        RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_CREDITS');
    END IF;

    -- Increment credits_used
    UPDATE sms_credit_wallets
    SET credits_used = credits_used + 1,
        updated_at = now()
    WHERE id = v_wallet_id;

    -- Insert ledger entry in consumption state
    INSERT INTO sms_credit_ledger (wallet_id, event_id, transaction_type, credits, sms_recipient)
    VALUES (v_wallet_id, p_event_id, 'consumption', -1, p_phone)
    RETURNING id INTO v_ledger_id;

    RETURN jsonb_build_object('success', true, 'wallet_id', v_wallet_id, 'ledger_id', v_ledger_id);
END;
$$;


-- Atomic SMS Credit Refund Function
CREATE OR REPLACE FUNCTION refund_sms_credit_atomic(
    p_wallet_id UUID,
    p_event_id UUID,
    p_ledger_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Revert credits_used decrement
    UPDATE sms_credit_wallets
    SET credits_used = credits_used - 1,
        updated_at = now()
    WHERE id = p_wallet_id;

    -- Delete the failed transaction record from ledger
    DELETE FROM sms_credit_ledger WHERE id = p_ledger_id;
END;
$$;
