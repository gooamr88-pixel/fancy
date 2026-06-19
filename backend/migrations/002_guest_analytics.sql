-- ═══════════════════════════════════════════════════════════════
-- Fancy RSVP — Phase 2 Database Migration
-- Guest Analytics, Engagement Tracking, and RSVP Enhancements
-- ═══════════════════════════════════════════════════════════════

-- 1. Add new columns to rsvps table for enhanced guest response tracking
ALTER TABLE rsvps
  ADD COLUMN IF NOT EXISTS decline_reason TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS maybe_confirm_by TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS response_source TEXT DEFAULT 'web_form';

-- Set response_source for any RSVPs that already have rsvp_at (from email flow)
UPDATE rsvps SET response_source = 'email' WHERE response_source IS NULL AND rsvp_at IS NOT NULL;
UPDATE rsvps SET response_source = 'web_form' WHERE response_source IS NULL;

-- 2. Guest Analytics — Tracks all guest engagement events (page views, CTA clicks, etc.)
CREATE TABLE IF NOT EXISTS guest_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  rsvp_id UUID REFERENCES rsvps(id) ON DELETE SET NULL,
  session_id TEXT,
  event_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  user_agent TEXT,
  ip_hash TEXT,
  referrer TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common analytics queries
CREATE INDEX IF NOT EXISTS idx_guest_analytics_event_id ON guest_analytics(event_id);
CREATE INDEX IF NOT EXISTS idx_guest_analytics_event_type ON guest_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_guest_analytics_created_at ON guest_analytics(created_at);
CREATE INDEX IF NOT EXISTS idx_guest_analytics_session ON guest_analytics(session_id);

-- 3. Guest Reminders — Tracks scheduled and sent reminders for guests
CREATE TABLE IF NOT EXISTS guest_reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  rsvp_id UUID NOT NULL REFERENCES rsvps(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL DEFAULT 'rsvp_follow_up',
  channel TEXT NOT NULL DEFAULT 'email',
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guest_reminders_event_id ON guest_reminders(event_id);
CREATE INDEX IF NOT EXISTS idx_guest_reminders_status ON guest_reminders(status);
CREATE INDEX IF NOT EXISTS idx_guest_reminders_scheduled ON guest_reminders(scheduled_at);

-- 4. Enable RLS on new tables
ALTER TABLE guest_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_reminders ENABLE ROW LEVEL SECURITY;

-- RLS policies: service role (used by backend) can do everything
CREATE POLICY "service_role_full_access_analytics" ON guest_analytics
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_access_reminders" ON guest_reminders
  FOR ALL USING (true) WITH CHECK (true);

-- 5. Add index on rsvps for the new columns
CREATE INDEX IF NOT EXISTS idx_rsvps_decline_reason ON rsvps(decline_reason) WHERE decline_reason IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rsvps_response_source ON rsvps(response_source);
