-- ════════════════════════════════════════════════════════════════════════
-- DEPRECATE `seal_text` (Seal Name / Monogram)
--
-- Continues 20260724000000_deprecate_invitation_seal_images.sql, which
-- deprecated the old upload-based seal images but explicitly preserved
-- `seal_text` as "the only organizer-controlled input that remains".
--
-- InvitationReveal's wax seal is no longer a per-event generated SVG with an
-- engraved monogram — it's now fixed baked artwork (public/images/reveal/),
-- the same blank seal for every event, chosen for its photoreal/cinematic
-- quality over the previous generated rendering. `seal_text` has no reader
-- left anywhere in the app (Stage2_FormConfiguration.js and EventSettings.js
-- both dropped the "Seal Name / Monogram" field in the same change).
--
-- `seal_text` is a JSON key inside events.template_data JSONB (not a table
-- column), so there is nothing to DROP — strip the dead key from existing
-- rows, same pattern as the prior seal-images migration.
-- ════════════════════════════════════════════════════════════════════════

UPDATE public.events
SET template_data = template_data - 'seal_text'
WHERE template_data ? 'seal_text';
