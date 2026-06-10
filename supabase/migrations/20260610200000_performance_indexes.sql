-- Migration: Performance Indexes
-- Date: 2026-06-10
-- Adds critical indexes for RLS policy performance and FK lookups

-- Critical: These two indexes are evaluated on EVERY authenticated request via RLS policies
CREATE INDEX IF NOT EXISTS idx_organizations_owner ON organizations(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_events_org_id ON events(org_id);

-- FK lookup indexes
CREATE INDEX IF NOT EXISTS idx_rsvp_guests_rsvp_id ON rsvp_guests(rsvp_id);
CREATE INDEX IF NOT EXISTS idx_custom_answers_rsvp_id ON custom_answers(rsvp_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_event_id ON check_ins(event_id);
CREATE INDEX IF NOT EXISTS idx_event_payments_event_id ON event_payments(event_id);
CREATE INDEX IF NOT EXISTS idx_sms_credit_ledger_event ON sms_credit_ledger(event_id);
