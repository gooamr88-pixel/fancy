-- ═══════════════════════════════════════════════════════════
-- FANCY RSVP - DATABASE SCHEMA COMPLETION MIGRATION
-- Target: PostgreSQL / Supabase Migration
-- ═══════════════════════════════════════════════════════════

-- 1. CREATE MISSING TABLES

CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL,            -- Links to auth.users (Supabase Auth)
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    stripe_customer_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure events references organizations
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_events_org_id' 
          AND table_name = 'events'
    ) THEN
        ALTER TABLE events ADD CONSTRAINT fk_events_org_id FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Alter existing events table to match schema.sql columns
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_end_date TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS location_name TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS location_address TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS location_lat DECIMAL(10, 8);
ALTER TABLE events ADD COLUMN IF NOT EXISTS location_lng DECIMAL(11, 8);
ALTER TABLE events ADD COLUMN IF NOT EXISTS location_place_id TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS dress_code TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS rsvp_deadline TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS privacy_mode TEXT DEFAULT 'private' CHECK (privacy_mode IN ('public', 'private', 'password'));
ALTER TABLE events ADD COLUMN IF NOT EXISTS access_password TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS gallery_urls JSONB DEFAULT '[]';
ALTER TABLE events ADD COLUMN IF NOT EXISTS custom_colors JSONB DEFAULT '{}';
ALTER TABLE events ADD COLUMN IF NOT EXISTS custom_fonts JSONB DEFAULT '{}';
ALTER TABLE events ADD COLUMN IF NOT EXISTS manual_override BOOLEAN DEFAULT FALSE;

-- Create RSVP Form Fields Table
CREATE TABLE IF NOT EXISTS rsvp_form_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    field_key TEXT NOT NULL,
    field_label TEXT NOT NULL,
    field_type TEXT NOT NULL CHECK (field_type IN ('text', 'email', 'phone', 'select', 'multiselect', 'textarea', 'number', 'checkbox')),
    options JSONB DEFAULT '[]',
    is_required BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Alter RSVPs table to add missing email/qr sent markers
ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS confirmation_email_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS qr_email_sent BOOLEAN DEFAULT FALSE;

-- Create RSVP Guests Table
CREATE TABLE IF NOT EXISTS rsvp_guests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rsvp_id UUID NOT NULL REFERENCES rsvps(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    meal_selection TEXT,
    dietary_notes   TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create Custom Answers Table
CREATE TABLE IF NOT EXISTS custom_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rsvp_id UUID NOT NULL REFERENCES rsvps(id) ON DELETE CASCADE,
    field_id UUID NOT NULL REFERENCES rsvp_form_fields(id) ON DELETE CASCADE,
    answer_value TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Alter Seating Assignments Table to add assigned_by tracking
ALTER TABLE seating_assignments ADD COLUMN IF NOT EXISTS assigned_by UUID;

-- Create Check-ins Table
CREATE TABLE IF NOT EXISTS check_ins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    rsvp_id UUID NOT NULL REFERENCES rsvps(id) ON DELETE CASCADE,
    checked_in_at TIMESTAMPTZ DEFAULT now(),
    checked_in_by TEXT,
    method TEXT CHECK (method IN ('qr_scan', 'manual_search', 'self_service')),
    party_count_arrived INTEGER DEFAULT 1,
    UNIQUE(event_id, rsvp_id)
);

-- Create Event Payments Table
CREATE TABLE IF NOT EXISTS event_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    stripe_checkout_session_id TEXT UNIQUE,
    stripe_payment_intent_id TEXT UNIQUE,
    amount_cents INTEGER NOT NULL,
    currency TEXT DEFAULT 'usd',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    payment_method TEXT DEFAULT 'stripe' CHECK (payment_method IN ('stripe', 'cash_manual')),
    approved_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- Alter SMS Credit Ledger to add payment intent tracking
ALTER TABLE sms_credit_ledger ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

-- Create Super Admin Config Table
CREATE TABLE IF NOT EXISTS super_admin_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pricing_tiers JSONB NOT NULL DEFAULT '[
        {"name": "Essential", "price_cents": 7900, "max_guests": 100},
        {"name": "Premium", "price_cents": 14900, "max_guests": 300},
        {"name": "Enterprise", "price_cents": 24900, "max_guests": 1000}
    ]',
    sms_rate_cents_per_credit INTEGER DEFAULT 8,
    sms_markup_percentage DECIMAL DEFAULT 40.0,
    platform_commission_pct DECIMAL DEFAULT 0.0,
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by UUID
);

-- Create Activity Logs Table
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    actor_id UUID,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Add indices
CREATE INDEX IF NOT EXISTS idx_rsvps_event_response ON rsvps(event_id, response);
CREATE INDEX IF NOT EXISTS idx_seating_event ON seating_assignments(event_id);
CREATE INDEX IF NOT EXISTS idx_activity_event ON activity_logs(event_id, created_at DESC);


-- Seed default config if none exists
INSERT INTO super_admin_config (id, pricing_tiers, sms_rate_cents_per_credit)
SELECT '00000000-0000-0000-0000-000000000000', '[
    {"name": "Essential", "price_cents": 7900, "max_guests": 100},
    {"name": "Premium", "price_cents": 14900, "max_guests": 300},
    {"name": "Enterprise", "price_cents": 24900, "max_guests": 1000}
]', 8
WHERE NOT EXISTS (SELECT 1 FROM super_admin_config);


-- 2. RE-DEFINE CONCURRENCY-SAFE AND SECURITY DEFINER FUNCTIONS

-- Atomic Seating Function (assign_seat)
CREATE OR REPLACE FUNCTION assign_seat(
    p_event_id UUID,
    p_rsvp_id UUID,
    p_table_id UUID,
    p_assigned_by UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_table_capacity INTEGER;
    v_current_occupied INTEGER;
    v_party_size INTEGER;
    v_remaining INTEGER;
    v_assignment_id UUID;
    v_existing UUID;
    v_table_name TEXT;
BEGIN
    -- Acquire transactional advisory lock based on the table's UUID hash
    PERFORM pg_advisory_xact_lock(hashtext(p_table_id::text));

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

    -- Fetch capacity and lock the table row to avoid modifications during transaction
    SELECT max_capacity, table_name
    INTO v_table_capacity, v_table_name
    FROM tables
    WHERE id = p_table_id AND event_id = p_event_id
    FOR UPDATE;

    IF v_table_capacity IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'TABLE_NOT_FOUND',
            'message', 'Specified table not found.'
        );
    END IF;

    -- Calculate current table occupancy
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
    v_remaining := v_table_capacity - v_current_occupied;
    IF v_party_size > v_remaining THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'CAPACITY_EXCEEDED',
            'message', format('%s has %s remaining seats, party size is %s.', v_table_name, v_remaining, v_party_size)
        );
    END IF;

    -- Insert atomic seating assignment
    INSERT INTO seating_assignments (event_id, rsvp_id, table_id, assigned_by)
    VALUES (p_event_id, p_rsvp_id, p_table_id, p_assigned_by)
    RETURNING id INTO v_assignment_id;

    -- Log transaction
    INSERT INTO activity_logs (event_id, actor_id, action, entity_type, entity_id, metadata)
    VALUES (p_event_id, p_assigned_by, 'table_assigned', 'seating_assignment', v_assignment_id, 
            jsonb_build_object('table_id', p_table_id, 'table_name', v_table_name, 'party_size', v_party_size));

    RETURN jsonb_build_object(
        'success', true,
        'assignment_id', v_assignment_id,
        'seats_remaining', v_remaining - v_party_size
    );
END;
$$;


-- Atomic Reassignment Function (reassign_seat)
CREATE OR REPLACE FUNCTION reassign_seat(
    p_event_id UUID,
    p_rsvp_id UUID,
    p_new_table_id UUID,
    p_assigned_by UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_old_table_id UUID;
    v_old_table_name TEXT;
    v_new_table_capacity INTEGER;
    v_new_occupied INTEGER;
    v_party_size INTEGER;
    v_new_remaining INTEGER;
    v_new_table_name TEXT;
    v_assignment_id UUID;
BEGIN
    -- Resolve old assignment
    SELECT sa.table_id, t.table_name
    INTO v_old_table_id, v_old_table_name
    FROM seating_assignments sa
    JOIN tables t ON t.id = sa.table_id
    WHERE sa.event_id = p_event_id AND sa.rsvp_id = p_rsvp_id;

    IF v_old_table_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'NOT_ASSIGNED',
            'message', 'Guest is not currently assigned to any table.'
        );
    END IF;

    IF v_old_table_id = p_new_table_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'SAME_TABLE',
            'message', 'Guest is already assigned to this table.'
        );
    END IF;

    -- Lock both tables in UUID order to prevent deadlocks
    IF p_new_table_id > v_old_table_id THEN
        PERFORM pg_advisory_xact_lock(hashtext(v_old_table_id::text));
        PERFORM pg_advisory_xact_lock(hashtext(p_new_table_id::text));
    ELSE
        PERFORM pg_advisory_xact_lock(hashtext(p_new_table_id::text));
        PERFORM pg_advisory_xact_lock(hashtext(v_old_table_id::text));
    END IF;

    -- Fetch party size
    SELECT party_size INTO v_party_size FROM rsvps WHERE id = p_rsvp_id;

    -- Check new table capacity
    SELECT max_capacity, table_name
    INTO v_new_table_capacity, v_new_table_name
    FROM tables
    WHERE id = p_new_table_id AND event_id = p_event_id
    FOR UPDATE;

    SELECT COALESCE(SUM(r.party_size), 0)
    INTO v_new_occupied
    FROM seating_assignments sa
    JOIN rsvps r ON r.id = sa.rsvp_id
    WHERE sa.table_id = p_new_table_id;

    v_new_remaining := v_new_table_capacity - v_new_occupied;

    IF v_party_size > v_new_remaining THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'CAPACITY_EXCEEDED',
            'message', format('%s has %s remaining seats, party size is %s.', v_new_table_name, v_new_remaining, v_party_size)
        );
    END IF;

    -- Update seating assignment
    UPDATE seating_assignments
    SET table_id = p_new_table_id,
        assigned_at = now(),
        assigned_by = p_assigned_by
    WHERE event_id = p_event_id AND rsvp_id = p_rsvp_id
    RETURNING id INTO v_assignment_id;

    -- Log transaction
    INSERT INTO activity_logs (event_id, actor_id, action, entity_type, entity_id, metadata)
    VALUES (p_event_id, p_assigned_by, 'table_reassigned', 'seating_assignment', v_assignment_id,
            jsonb_build_object('from_table', v_old_table_name, 'to_table', v_new_table_name, 'party_size', v_party_size));

    RETURN jsonb_build_object(
        'success', true,
        'assignment_id', v_assignment_id,
        'from_table', v_old_table_name,
        'to_table', v_new_table_name,
        'seats_remaining_new_table', v_new_remaining - v_party_size
    );
END;
$$;


-- Atomic SMS Credit Deduction Function (deduct_sms_credit)
CREATE OR REPLACE FUNCTION deduct_sms_credit(
    p_event_id UUID,
    p_phone TEXT,
    p_sms_sid TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet_id UUID;
    v_remaining INTEGER;
BEGIN
    -- Row-lock wallet
    SELECT id, credits_remaining INTO v_wallet_id, v_remaining
    FROM sms_credit_wallets
    WHERE event_id = p_event_id
    FOR UPDATE;

    IF v_wallet_id IS NULL OR v_remaining < 1 THEN
        RAISE EXCEPTION 'INSUFFICIENT_CREDITS';
    END IF;

    -- Increment usage
    UPDATE sms_credit_wallets
    SET credits_used = credits_used + 1,
        updated_at = now()
    WHERE id = v_wallet_id;

    -- Insert ledger entry
    INSERT INTO sms_credit_ledger (wallet_id, event_id, transaction_type, credits, sms_recipient, sms_sid)
    VALUES (v_wallet_id, p_event_id, 'consumption', -1, p_phone, p_sms_sid);
END;
$$;
