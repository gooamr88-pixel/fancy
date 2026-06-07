-- ═══════════════════════════════════════════════════════════
-- FANCY RSVP - QA STRESS TEST FIXES
-- Target: PostgreSQL / Supabase Migration
-- ═══════════════════════════════════════════════════════════

-- Scenario 5: Ghost Organizer (Cascading user deletions)
-- Ensure organizations are automatically wiped when their owner's user account is deleted in auth.users
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_organizations_owner_user_id' 
          AND table_name = 'organizations'
    ) THEN
        ALTER TABLE organizations 
        ADD CONSTRAINT fk_organizations_owner_user_id 
        FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Ensure user_roles are automatically wiped when the user is deleted in auth.users
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_user_roles_user_id' 
          AND table_name = 'user_roles'
    ) THEN
        ALTER TABLE user_roles 
        ADD CONSTRAINT fk_user_roles_user_id 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;


-- Scenario 1: The Fickle Guest (RSVP Modification capacity release & overbooking check)
-- Define a trigger function to handle changes in guest response or party size
CREATE OR REPLACE FUNCTION handle_rsvp_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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
