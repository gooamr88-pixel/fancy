-- ═══════════════════════════════════════════════════════════
-- FANCY RSVP - DATABASE SCHEMA & CORE LOGIC
-- Target Database: PostgreSQL 15+ / Supabase
-- This file represents the FINAL state after all migrations.
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
    password_hash TEXT,
    reset_otp TEXT,
    reset_otp_expires_at TIMESTAMPTZ,
    otp_attempts INTEGER DEFAULT 0,
    failed_login_attempts INTEGER DEFAULT 0,
    lockout_until TIMESTAMPTZ,
    email_verified BOOLEAN DEFAULT true,
    registration_otp TEXT,
    registration_otp_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT organizations_email_unique UNIQUE (email),
    CONSTRAINT fk_organizations_owner_user_id FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_organizations_owner ON organizations(owner_user_id);

CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'organizer' CHECK (role IN ('organizer', 'super_admin')),
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_user_roles_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_role ON user_roles(user_id, role);

CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    slug TEXT UNIQUE NOT NULL,
    template_type TEXT NOT NULL DEFAULT 'custom',
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
    template_data JSONB DEFAULT '{}',
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
    is_paid BOOLEAN DEFAULT FALSE,
    manual_override BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_events_slug ON events(slug);
CREATE INDEX IF NOT EXISTS idx_events_org_id ON events(org_id);

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
CREATE UNIQUE INDEX IF NOT EXISTS idx_rsvps_event_email_unique
  ON rsvps(event_id, email)
  WHERE response != 'no';

CREATE TABLE IF NOT EXISTS rsvp_guests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rsvp_id UUID NOT NULL REFERENCES rsvps(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    meal_selection TEXT,
    dietary_notes   TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rsvp_guests_rsvp_id ON rsvp_guests(rsvp_id);

CREATE TABLE IF NOT EXISTS custom_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rsvp_id UUID NOT NULL REFERENCES rsvps(id) ON DELETE CASCADE,
    field_id UUID NOT NULL REFERENCES rsvp_form_fields(id) ON DELETE CASCADE,
    answer_value TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custom_answers_rsvp_id ON custom_answers(rsvp_id);

-- ─── 2. SEATING & CHECK-IN TABLES ───

CREATE TABLE IF NOT EXISTS seating_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    rsvp_id UUID NOT NULL REFERENCES rsvps(id) ON DELETE CASCADE,
    table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT now(),
    assigned_by UUID,
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

CREATE INDEX IF NOT EXISTS idx_check_ins_event_id ON check_ins(event_id);

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

CREATE INDEX IF NOT EXISTS idx_event_payments_event_id ON event_payments(event_id);

CREATE TABLE IF NOT EXISTS sms_credit_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID UNIQUE NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    credits_purchased INTEGER DEFAULT 0 CHECK (credits_purchased >= 0),
    credits_used INTEGER DEFAULT 0 CHECK (credits_used >= 0),
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

CREATE INDEX IF NOT EXISTS idx_sms_credit_ledger_event ON sms_credit_ledger(event_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_credit_ledger_unique_purchase
  ON sms_credit_ledger(stripe_payment_intent_id)
  WHERE (transaction_type = 'purchase');

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


-- ─── 4. UPDATED_AT TRIGGER ───

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply updated_at trigger to all tables that have the column
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT table_name FROM information_schema.columns
    WHERE column_name = 'updated_at'
    AND table_schema = 'public'
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_updated_at ON %I; CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
      tbl, tbl
    );
  END LOOP;
END;
$$;


-- ─── 5. HELPER FUNCTIONS ───

-- Super admin check helper
CREATE OR REPLACE FUNCTION is_super_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = p_user_id AND role = 'super_admin'
    );
END;
$$;


-- ─── 6. STORED FUNCTIONS & CONCURRENCY SEATING LOGIC ───

-- Atomic Seating Function
CREATE OR REPLACE FUNCTION assign_seat(
    p_event_id UUID,
    p_rsvp_id UUID,
    p_table_id UUID,
    p_assigned_by UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
SECURITY DEFINER
SET search_path = public
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
    p_event_id   UUID,
    p_rsvp_id    UUID,
    p_assigned_by UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_assignment_id  UUID;
    v_table_id       UUID;
    v_table_name     TEXT;
    v_party_size     INTEGER;
BEGIN
    -- Verify the seating assignment exists for this event + rsvp
    SELECT sa.id, sa.table_id, t.table_name
    INTO v_assignment_id, v_table_id, v_table_name
    FROM seating_assignments sa
    JOIN tables t ON t.id = sa.table_id
    WHERE sa.event_id = p_event_id
      AND sa.rsvp_id  = p_rsvp_id
    FOR UPDATE OF sa;

    IF v_assignment_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error',   'ASSIGNMENT_NOT_FOUND',
            'message', 'No seating assignment found for this event and RSVP.'
        );
    END IF;

    -- Fetch party size for logging
    SELECT party_size INTO v_party_size
    FROM rsvps
    WHERE id = p_rsvp_id;

    -- Delete the seating assignment
    DELETE FROM seating_assignments
    WHERE event_id = p_event_id
      AND rsvp_id  = p_rsvp_id;

    -- Log to activity_logs
    INSERT INTO activity_logs (
        event_id,
        actor_id,
        action,
        entity_type,
        entity_id,
        metadata
    ) VALUES (
        p_event_id,
        p_assigned_by,
        'table_unassigned',
        'seating_assignment',
        v_assignment_id,
        jsonb_build_object(
            'table_id',    v_table_id,
            'table_name',  v_table_name,
            'rsvp_id',     p_rsvp_id,
            'party_size',  v_party_size
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', format('Guest unassigned from %s.', v_table_name)
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
SECURITY DEFINER
SET search_path = public
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

-- Atomic SMS Credit Transaction Checker/Deductor
CREATE OR REPLACE FUNCTION deduct_sms_credit_atomic(
    p_event_id UUID,
    p_phone TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    p_wallet_id  UUID,
    p_event_id   UUID,
    p_ledger_id  UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_credits_used INTEGER;
BEGIN
    -- Row-lock the wallet to prevent concurrent modifications
    SELECT credits_used
    INTO v_credits_used
    FROM sms_credit_wallets
    WHERE id = p_wallet_id
      AND event_id = p_event_id
    FOR UPDATE;

    -- Validate wallet exists
    IF v_credits_used IS NULL THEN
        RAISE EXCEPTION 'WALLET_NOT_FOUND: No wallet found for id=% event=%',
            p_wallet_id, p_event_id;
    END IF;

    -- Validate credits_used > 0 before decrementing (prevent going negative)
    IF v_credits_used <= 0 THEN
        RAISE EXCEPTION 'INVALID_REFUND: credits_used is already 0, cannot refund further';
    END IF;

    -- Revert credits_used decrement
    UPDATE sms_credit_wallets
    SET credits_used = credits_used - 1,
        updated_at   = now()
    WHERE id = p_wallet_id;

    -- Delete the failed/refunded transaction record from ledger
    DELETE FROM sms_credit_ledger
    WHERE id = p_ledger_id;
END;
$$;

-- Atomic SMS credit increment function (replaces read-modify-write pattern)
CREATE OR REPLACE FUNCTION increment_sms_credits(
  p_event_id UUID,
  p_credit_amount INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE sms_credit_wallets
  SET credits_purchased = credits_purchased + p_credit_amount
  WHERE event_id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SMS credit wallet not found for event %', p_event_id;
  END IF;
END;
$$;


-- ─── 7. RSVP MODIFICATION TRIGGER ───

CREATE OR REPLACE FUNCTION handle_rsvp_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_table_id UUID;
    v_table_name TEXT;
    v_max_capacity INTEGER;
    v_current_occupied INTEGER;
    v_remaining_seats INTEGER;
BEGIN
    -- 1. If response is changing from 'yes' to 'no' or 'pending', clean up assignment and reset party size to 1
    IF (NEW.response <> 'yes') THEN
        NEW.party_size := 1;
        DELETE FROM seating_assignments WHERE rsvp_id = NEW.id;
    END IF;

    -- 2. If response is 'yes' and party_size changed, validate capacity at the assigned table (if any)
    IF (NEW.response = 'yes' AND OLD.party_size <> NEW.party_size) THEN
        -- Check if the guest is assigned to a table
        SELECT table_id INTO v_table_id
        FROM seating_assignments
        WHERE rsvp_id = NEW.id;

        IF v_table_id IS NOT NULL THEN
            -- Acquire row-level lock on the table to prevent race conditions during trigger execution
            SELECT max_capacity, table_name
            INTO v_max_capacity, v_table_name
            FROM tables
            WHERE id = v_table_id
            FOR UPDATE;

            -- Calculate total seats occupied by *other* guests at this table
            SELECT COALESCE(SUM(r.party_size), 0)
            INTO v_current_occupied
            FROM seating_assignments sa
            JOIN rsvps r ON r.id = sa.rsvp_id
            WHERE sa.table_id = v_table_id AND sa.rsvp_id <> NEW.id;

            v_remaining_seats := v_max_capacity - v_current_occupied;

            -- Assert capacity
            IF NEW.party_size > v_remaining_seats THEN
                RAISE EXCEPTION 'RSVP party size increase to % exceeds remaining capacity (%) of table %.',
                    NEW.party_size, v_remaining_seats, v_table_name;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Bind the trigger to rsvps table
DROP TRIGGER IF EXISTS trg_rsvp_modification ON rsvps;
CREATE TRIGGER trg_rsvp_modification
    BEFORE UPDATE OF response, party_size ON rsvps
    FOR EACH ROW
    EXECUTE FUNCTION handle_rsvp_modification();


-- ─── 8. ENABLE ROW LEVEL SECURITY ───

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
-- 9. HARDENED RLS POLICIES
-- (Matches final state after rls_hardening + rls_security_fix migrations)
-- ═══════════════════════════════════════════════════════════

-- ── User Roles ──

CREATE POLICY admin_all_roles ON user_roles
    FOR ALL TO authenticated
    USING (is_super_admin(auth.uid()))
    WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY organizer_read_own_role ON user_roles
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- ── Organizations ──

CREATE POLICY organizer_all_organizations ON organizations
    FOR ALL TO authenticated
    USING (is_super_admin(auth.uid()) OR owner_user_id = auth.uid())
    WITH CHECK (is_super_admin(auth.uid()) OR owner_user_id = auth.uid());

-- ── Events ──

CREATE POLICY organizer_all_events ON events
    FOR ALL TO authenticated
    USING (is_super_admin(auth.uid()) OR org_id IN (SELECT id FROM organizations WHERE owner_user_id = auth.uid()))
    WITH CHECK (is_super_admin(auth.uid()) OR org_id IN (SELECT id FROM organizations WHERE owner_user_id = auth.uid()));

-- Public: only show paid + active events
CREATE POLICY public_read_events ON events
    FOR SELECT TO public
    USING (is_paid = true AND status = 'active');

-- ── Tables (venue layout) ──

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
    USING (EXISTS (SELECT 1 FROM events WHERE events.id = tables.event_id AND events.is_paid = true AND events.status = 'active'));

-- ── RSVP Form Fields ──

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

-- ── RSVPs ──

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

-- Public SELECT: only for paid + active events
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

-- ── RSVP Guests ──

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

-- ── Custom Answers ──

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

-- ── Seating Assignments ──

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

-- ── Check-ins ──

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

-- ── Event Payments ──

CREATE POLICY organizer_read_payments ON event_payments
    FOR SELECT TO authenticated
    USING (is_super_admin(auth.uid()) OR EXISTS (
        SELECT 1 FROM events e
        JOIN organizations o ON e.org_id = o.id
        WHERE e.id = event_payments.event_id AND o.owner_user_id = auth.uid()
    ));

-- ── SMS Credit Wallets ──

CREATE POLICY organizer_select_wallet ON sms_credit_wallets
    FOR SELECT TO authenticated
    USING (is_super_admin(auth.uid()) OR EXISTS (
        SELECT 1 FROM events e
        JOIN organizations o ON e.org_id = o.id
        WHERE e.id = sms_credit_wallets.event_id AND o.owner_user_id = auth.uid()
    ));

-- ── SMS Credit Ledger ──

CREATE POLICY organizer_select_ledger ON sms_credit_ledger
    FOR SELECT TO authenticated
    USING (is_super_admin(auth.uid()) OR EXISTS (
        SELECT 1 FROM events e
        JOIN organizations o ON e.org_id = o.id
        WHERE e.id = sms_credit_ledger.event_id AND o.owner_user_id = auth.uid()
    ));

-- ── Super Admin Config ──

CREATE POLICY admin_all_config ON super_admin_config
    FOR ALL TO authenticated
    USING (is_super_admin(auth.uid()))
    WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY organizer_select_config ON super_admin_config
    FOR SELECT TO authenticated
    USING (true);

-- ── Activity Logs ──

CREATE POLICY organizer_select_logs ON activity_logs
    FOR SELECT TO authenticated
    USING (is_super_admin(auth.uid()) OR EXISTS (
        SELECT 1 FROM events e
        JOIN organizations o ON e.org_id = o.id
        WHERE e.id = activity_logs.event_id AND o.owner_user_id = auth.uid()
    ));
