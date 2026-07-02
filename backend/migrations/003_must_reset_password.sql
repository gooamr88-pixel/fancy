-- ═══════════════════════════════════════════════════════════════
-- Fancy RSVP — Phase 3 Database Migration
-- Forced Password Reset Flag
-- ═══════════════════════════════════════════════════════════════

-- Set by admin-triggered password resets (backend/controllers/admin/userMgmtController.js
-- resetOrganizerPassword) so the organizer is prompted to change their temp password.
-- Cleared by authController.js changePassword on the next successful password change.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS must_reset_password BOOLEAN NOT NULL DEFAULT false;
