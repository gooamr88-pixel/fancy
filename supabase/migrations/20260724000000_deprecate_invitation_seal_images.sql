-- ════════════════════════════════════════════════════════════════════════
-- DEPRECATE INVITATION SEAL / BACKGROUND IMAGE UPLOADS
--
-- The "Invitation Seal & Stationery" section used to let organizers upload a
-- Custom Seal Artwork image and an Invitation Background image, stored as
-- `seal_image_url` and `invitation_bg_url` inside events.template_data (a
-- latent `seal_image_gold_url` was also read by the old renderer but never
-- written by any form).
--
-- The guest reveal is now a single, fully-generated wax seal (InvitationReveal)
-- whose seal, stationery and gold light are rendered as vectors and coloured
-- from the event's own custom_colors. The only organizer-controlled input that
-- remains is the `seal_text` (Seal Name / Monogram), which is preserved.
--
-- These three values are JSON keys inside the events.template_data JSONB column
-- (not table columns), so there is nothing to DROP — we strip the dead keys
-- from existing rows. `seal_text` and every other template_data key are left
-- untouched. Note: any files already uploaded to the `event-assets` storage
-- bucket under seals/, seal/ and invitation-bg/ are orphaned (no FK/RLS ties
-- them to the row); a separate storage sweep can reclaim them later.
-- ════════════════════════════════════════════════════════════════════════

UPDATE public.events
SET template_data = template_data - 'seal_image_url' - 'invitation_bg_url' - 'seal_image_gold_url'
WHERE template_data ?| array['seal_image_url', 'invitation_bg_url', 'seal_image_gold_url'];
