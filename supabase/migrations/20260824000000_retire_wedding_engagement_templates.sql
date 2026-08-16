-- ════════════════════════════════════════════════════════════════════════════
-- RETIRE 'wedding' (Royale Wedding) AND 'engagement' (Eternal Love)
--
-- Both were the same stationery-envelope page as each other with the copy
-- reworded, and the cinematic pair supersedes them on both occasions:
--
--     wedding     → bab    Door of Joy    (knock three times, the door opens)
--     engagement  → ring   Velvet Ring    (touch the box, the lid lifts)
--
-- The mapping is duplicated in frontend/src/app/utils/curatedTemplates.js as
-- RETIRED_TEMPLATE_SUCCESSOR; test/templatePicker.test.jsx asserts this file
-- and that constant agree, so the two cannot drift.
--
-- ─── WHAT THIS CHANGES FOR A GUEST ──────────────────────────────────────────
-- This is NOT a cosmetic backfill. Every invitation on these two templates is
-- already published and already linked. After this runs, a guest opening the
-- same URL gets a different opening (a carved door or a velvet box instead of
-- a wax-sealed envelope) and, for the engagement, a dark velvet page instead
-- of a light gold one. That is the intended outcome — it is why the templates
-- are being retired rather than merely hidden — but it is a visible change to
-- live invitations and should be applied deliberately, not as a side effect of
-- a deploy.
--
-- ─── WHY IT IS SAFE STRUCTURALLY ────────────────────────────────────────────
-- • template_type is free-text TEXT with no CHECK constraint and no FK
--   (see 20260607000000_init_schema.sql), so there is nothing to satisfy.
-- • The successors take the IDENTICAL template_data field sets:
--     'wedding' and 'bab'     both use WEDDING_FIELD_KEYS
--     'engagement' and 'ring' both use the engagement field list
--   (TEMPLATE_TYPE_FIELD_KEYS in frontend/.../create-event/page.js), so no
--   partner name, venue, story, schedule, FAQ or gift-list entry is orphaned.
-- • Both successors are already in FULL_PAGE_TEMPLATES, so the guest router
--   picks the same page engine it was picking before.
--
-- ─── WHAT IS DELIBERATELY LEFT ALONE ────────────────────────────────────────
-- • event_type — a separate column with separate meaning (guest-side labels,
--   analytics grouping). 'bab' is wedding-style so a converted wedding's
--   event_type stays correct; changing it here would rewrite history for no
--   gain.
-- • custom_colors — an organizer's own palette outranks the template's native
--   one in buildPalette(). Anyone who picked their colours keeps them; anyone
--   who never opened the picker inherits the new template's palette, which is
--   what makes the page look like the template it now claims to be.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

UPDATE public.events
   SET template_type = 'bab'
 WHERE template_type = 'wedding';

UPDATE public.events
   SET template_type = 'ring'
 WHERE template_type = 'engagement';

COMMIT;

-- Verification — expect zero rows:
--   SELECT template_type, count(*) FROM public.events
--    WHERE template_type IN ('wedding', 'engagement')
--    GROUP BY template_type;
