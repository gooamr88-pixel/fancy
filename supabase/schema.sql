-- ═══════════════════════════════════════════════════════════
-- FANCY RSVP - DATABASE SCHEMA & CORE LOGIC
-- Target Database: PostgreSQL 15+ / Supabase
-- ═══════════════════════════════════════════════════════════

-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── 1. CORE CLIENT / ORGANIZER TABLES ───

CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL,            -- Links to Supabase auth.users (handled via app logic)
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    stripe_customer_id TEXT UNIQUE,
    password_hash TEXT,                     -- Added for password hashing verification
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role TEXT NOT NULL DEFAULT 'organizer' CHECK (role IN ('organizer', 'super_admin')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    slug TEXT UNIQUE NOT NULL,
    template_type TEXT NOT NULL CHECK (template_type IN ('wedding', 'corporate', 'birthday', 'engagement', 'gala', 'custom')),
    title TEXT NOT NULL,
    description TEXT,
    event_date TIMESTAMPTZ NOT NULL,
    event_end_date TIMESTAMPTZ,
    location_name TEXT,
    location_address TEXT,
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    location_place_id TEXT,
    dress_code TEXT,
    rsvp_deadline TIMESTAMPTZ,
    privacy_mode TEXT DEFAULT 'private' CHECK (privacy_mode IN ('public', 'private', 'password')),
    access_password TEXT,
    cover_image_url TEXT,
    gallery_urls JSONB DEFAULT '[]',
    custom_colors JSONB DEFAULT '{}',
    custom_fonts JSONB DEFAULT '{}',
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
    is_paid BOOLEAN DEFAULT FALSE,
    manual_override BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_events_slug ON events(slug);

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

CREATE TABLE IF NOT EXISTS rsvps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    guest_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    response TEXT NOT NULL CHECK (response IN ('yes', 'no', 'pending')),
    party_size INTEGER DEFAULT 1 CHECK (party_size >= 1),
    notes TEXT,
    confirmation_email_sent BOOLEAN DEFAULT FALSE,
    qr_email_sent BOOLEAN DEFAULT FALSE,
    submitted_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rsvps_event_id ON rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_rsvps_event_response ON rsvps(event_id, response);

CREATE TABLE IF NOT EXISTS rsvp_guests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rsvp_id UUID NOT NULL REFERENCES rsvps(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    meal_selection TEXT,
    dietary_notes   TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS custom_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rsvp_id UUID NOT NULL REFERENCES rsvps(id) ON DELETE CASCADE,
    field_id UUID NOT NULL REFERENCES rsvp_form_fields(id) ON DELETE CASCADE,
    answer_value TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 2. SEATING & CHECK-IN TABLES ───

CREATE TABLE IF NOT EXISTS seating_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    rsvp_id UUID NOT NULL REFERENCES rsvps(id) ON DELETE CASCADE,
    table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT now(),
    assigned_by UUID,                       -- Can reference auth.users if needed
    UNIQUE(event_id, rsvp_id)
);

CREATE INDEX IF NOT EXISTS idx_seating_table ON seating_assignments(table_id);
CREATE INDEX IF NOT EXISTS idx_seating_event ON seating_assignments(event_id);

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

-- ─── 3. FINANCIALS & SMS WALLET ───

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

CREATE TABLE IF NOT EXISTS sms_credit_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID UNIQUE NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    credits_purchased INTEGER DEFAULT 0,
    credits_used INTEGER DEFAULT 0,
    credits_remaining INTEGER GENERATED ALWAYS AS (credits_purchased - credits_used) STORED,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sms_credit_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES sms_credit_wallets(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'consumption', 'refund')),
    credits INTEGER NOT NULL,
    stripe_payment_intent_id TEXT,
    sms_recipient TEXT,
    sms_sid TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

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

CREATE INDEX IF NOT EXISTS idx_activity_event ON activity_logs(event_id, created_at DESC);

-- ─── 4. STORED FUNCTIONS & CONCURRENCY SEATING LOGIC ───

-- Atomic Seating Function
CREATE OR REPLACE FUNCTION assign_seat(
    p_event_id UUID,
    p_rsvp_id UUID,
    p_table_id UUID,
    p_assigned_by UUID
) RETURNS JSONB
LANGUAGE plpgsql
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

-- Atomic Reassignment Function
CREATE OR REPLACE FUNCTION reassign_seat(
    p_event_id UUID,
    p_rsvp_id UUID,
    p_new_table_id UUID,
    p_assigned_by UUID
) RETURNS JSONB
LANGUAGE plpgsql
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

-- Atomic Seating Unassignment Function
CREATE OR REPLACE FUNCTION unassign_seat(
    p_event_id UUID,
    p_rsvp_id UUID,
    p_assigned_by UUID
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_assignment_id UUID;
    v_table_id UUID;
    v_table_name TEXT;
    v_party_size INTEGER;
    v_table_capacity INTEGER;
    v_current_occupied INTEGER;
    v_remaining INTEGER;
BEGIN
    -- Resolve assignment details
    SELECT sa.id, sa.table_id, t.table_name, t.max_capacity, r.party_size
    INTO v_assignment_id, v_table_id, v_table_name, v_table_capacity, v_party_size
    FROM seating_assignments sa
    JOIN tables t ON t.id = sa.table_id
    JOIN rsvps r ON r.id = sa.rsvp_id
    WHERE sa.event_id = p_event_id AND sa.rsvp_id = p_rsvp_id;

    IF v_assignment_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'NOT_ASSIGNED',
            'message', 'Guest is not currently assigned to any table.'
        );
    END IF;

    -- Delete assignment
    DELETE FROM seating_assignments
    WHERE id = v_assignment_id;

    -- Calculate remaining seats
    SELECT COALESCE(SUM(r.party_size), 0)
    INTO v_current_occupied
    FROM seating_assignments sa
    JOIN rsvps r ON r.id = sa.rsvp_id
    WHERE sa.table_id = v_table_id;

    v_remaining := v_table_capacity - v_current_occupied;

    -- Log transaction
    INSERT INTO activity_logs (event_id, actor_id, action, entity_type, entity_id, metadata)
    VALUES (p_event_id, p_assigned_by, 'table_unassigned', 'seating_assignment', v_assignment_id,
            jsonb_build_object('table_id', v_table_id, 'table_name', v_table_name, 'party_size', v_party_size));

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Guest unassigned from table successfully.',
        'seats_remaining', v_remaining
    );
END;
$$;

-- Super Admin manual cash approval of event payments
CREATE OR REPLACE FUNCTION approve_event_cash(
    p_event_id UUID,
    p_approved_by UUID,
    p_amount_cents INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_payment_id UUID;
BEGIN
    -- Update event to paid and active
    UPDATE events
    SET is_paid = TRUE,
        status = 'active',
        updated_at = now()
    WHERE id = p_event_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'EVENT_NOT_FOUND',
            'message', 'Event not found.'
        );
    END IF;

    -- Record event payment
    INSERT INTO event_payments (
        event_id,
        amount_cents,
        status,
        payment_method,
        approved_by,
        completed_at
    ) VALUES (
        p_event_id,
        p_amount_cents,
        'completed',
        'cash_manual',
        p_approved_by,
        now()
    ) RETURNING id INTO v_payment_id;

    -- Record activity log
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

    RETURN jsonb_build_object(
        'success', true,
        'payment_id', v_payment_id
    );
END;
$$;


-- Atomic SMS Credit Deduction Function
CREATE OR REPLACE FUNCTION deduct_sms_credit(
    p_event_id UUID,
    p_phone TEXT,
    p_sms_sid TEXT
) RETURNS VOID
LANGUAGE plpgsql
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

-- Seed Default super_admin_config row if not exists
INSERT INTO super_admin_config (id, pricing_tiers, sms_rate_cents_per_credit, sms_markup_percentage, platform_commission_pct)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    '[
        {"name": "Essential", "price_cents": 7900, "max_guests": 100},
        {"name": "Premium", "price_cents": 14900, "max_guests": 300},
        {"name": "Enterprise", "price_cents": 24900, "max_guests": 1000}
    ]'::jsonb,
    8,
    40.0,
    0.0
) ON CONFLICT (id) DO NOTHING;

-- Enable Row Level Security (RLS) on tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE rsvp_form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE rsvp_guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE seating_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_credit_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE super_admin_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════
-- RLS POLICIES FOR SECURE ACCESS CONTROL
-- ═══════════════════════════════════════════════════════════

-- Organizations access policies
CREATE POLICY "Organizers can read their own organization"
    ON organizations FOR SELECT
    USING (auth.uid() = owner_user_id);

CREATE POLICY "Organizers can update their own organization"
    ON organizations FOR UPDATE
    USING (auth.uid() = owner_user_id);

-- User roles access policies
CREATE POLICY "Users can read their own roles"
    ON user_roles FOR SELECT
    USING (auth.uid() = user_id);

-- Events access policies
CREATE POLICY "Organizers can read their events"
    ON events FOR SELECT
    USING (org_id IN (SELECT id FROM organizations WHERE owner_user_id = auth.uid()));

CREATE POLICY "Organizers can insert their events"
    ON events FOR INSERT
    WITH CHECK (org_id IN (SELECT id FROM organizations WHERE owner_user_id = auth.uid()));

CREATE POLICY "Organizers can update their events"
    ON events FOR UPDATE
    USING (org_id IN (SELECT id FROM organizations WHERE owner_user_id = auth.uid()));

CREATE POLICY "Organizers can delete their events"
    ON events FOR DELETE
    USING (org_id IN (SELECT id FROM organizations WHERE owner_user_id = auth.uid()));

CREATE POLICY "Public read for paid active event pages"
    ON events FOR SELECT
    USING (is_paid = true OR status = 'active' OR slug = 'demo');

-- RSVP Form Fields policies
CREATE POLICY "Organizers can manage fields"
    ON rsvp_form_fields FOR ALL
    USING (event_id IN (SELECT id FROM events WHERE org_id IN (SELECT id FROM organizations WHERE owner_user_id = auth.uid())));

CREATE POLICY "Public read for RSVP fields"
    ON rsvp_form_fields FOR SELECT
    USING (true);

-- Seating Tables policies
CREATE POLICY "Organizers can manage seating tables"
    ON tables FOR ALL
    USING (event_id IN (SELECT id FROM events WHERE org_id IN (SELECT id FROM organizations WHERE owner_user_id = auth.uid())));

-- RSVPs policies
CREATE POLICY "Organizers can select RSVPs"
    ON rsvps FOR SELECT
    USING (event_id IN (SELECT id FROM events WHERE org_id IN (SELECT id FROM organizations WHERE owner_user_id = auth.uid())));

CREATE POLICY "Organizers can manage RSVPs"
    ON rsvps FOR ALL
    USING (event_id IN (SELECT id FROM events WHERE org_id IN (SELECT id FROM organizations WHERE owner_user_id = auth.uid())));

CREATE POLICY "Public can search and read RSVPs"
    ON rsvps FOR SELECT
    USING (true);

CREATE POLICY "Public can submit RSVPs"
    ON rsvps FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Public can update RSVPs"
    ON rsvps FOR UPDATE
    USING (true);

-- RSVP Guests policies
CREATE POLICY "Organizers can manage RSVP guests"
    ON rsvp_guests FOR ALL
    USING (rsvp_id IN (SELECT id FROM rsvps WHERE event_id IN (SELECT id FROM events WHERE org_id IN (SELECT id FROM organizations WHERE owner_user_id = auth.uid()))));

CREATE POLICY "Public can manage RSVP guests"
    ON rsvp_guests FOR ALL
    USING (true);

-- Custom Answers policies
CREATE POLICY "Organizers can select custom answers"
    ON custom_answers FOR SELECT
    USING (rsvp_id IN (SELECT id FROM rsvps WHERE event_id IN (SELECT id FROM events WHERE org_id IN (SELECT id FROM organizations WHERE owner_user_id = auth.uid()))));

CREATE POLICY "Public can submit custom answers"
    ON custom_answers FOR INSERT
    WITH CHECK (true);

-- Seating Assignments policies
CREATE POLICY "Organizers can manage seating assignments"
    ON seating_assignments FOR ALL
    USING (event_id IN (SELECT id FROM events WHERE org_id IN (SELECT id FROM organizations WHERE owner_user_id = auth.uid()))));

CREATE POLICY "Public read for seating assignments"
    ON seating_assignments FOR SELECT
    USING (true);

-- Check-ins policies
CREATE POLICY "Organizers can manage check-ins"
    ON check_ins FOR ALL
    USING (event_id IN (SELECT id FROM events WHERE org_id IN (SELECT id FROM organizations WHERE owner_user_id = auth.uid()))));

-- Event Payments policies
CREATE POLICY "Organizers can view their payments"
    ON event_payments FOR SELECT
    USING (event_id IN (SELECT id FROM events WHERE org_id IN (SELECT id FROM organizations WHERE owner_user_id = auth.uid()))));

-- SMS wallets and ledgers policies
CREATE POLICY "Organizers can view their SMS wallet"
    ON sms_credit_wallets FOR SELECT
    USING (event_id IN (SELECT id FROM events WHERE org_id IN (SELECT id FROM organizations WHERE owner_user_id = auth.uid()))));

CREATE POLICY "Organizers can view their SMS ledger"
    ON sms_credit_ledger FOR SELECT
    USING (event_id IN (SELECT id FROM events WHERE org_id IN (SELECT id FROM organizations WHERE owner_user_id = auth.uid()))));

-- Super Admin config policies
CREATE POLICY "Super admins can manage platform pricing"
    ON super_admin_config FOR ALL
    USING (auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'super_admin'));

CREATE POLICY "Public read platform pricing configurations"
    ON super_admin_config FOR SELECT
    USING (true);

-- Activity Logs policies
CREATE POLICY "Organizers can view their activity logs"
    ON activity_logs FOR SELECT
    USING (event_id IN (SELECT id FROM events WHERE org_id IN (SELECT id FROM organizations WHERE owner_user_id = auth.uid()))));

