-- ═══════════════════════════════════════════════════════════
-- FANCY RSVP — REMOVE PRE-CLEAN SURVIVORS
--
-- Surgical follow-up to a clean_database.sql run made BEFORE 2026-08-10, back
-- when the truncate list was a hand-maintained ARRAY that had drifted ~30
-- migrations behind the schema.
--
-- Most of the missed tables were emptied anyway: TRUNCATE ... CASCADE reaches
-- every table holding an FK to a truncated one, so the whole check-in family
-- (event_staff, event_devices, event_device_pairing_codes,
-- event_checkin_cursors, event_check_in_conflicts, event_guest_changes),
-- short_links, referral_credit_ledger, referral_credit_holds and
-- promo_code_redemptions all went out with events/organizations. Whatever is
-- in those tables now was created after the clean, so this script does not
-- touch them.
--
-- Exactly four tables have no FK path to anything that was truncated, so they
-- came through completely intact:
--
--   testimonials    no FK at all   (20260731000000_testimonials.sql)
--   press_mentions  no FK at all   (20260801000000_press_mentions.sql)
--   blog_posts      no FK at all   (20260804000000_blog.sql)
--   promo_codes     its only FK was created_by -> auth.users, and that FK was
--                   dropped by 20260808000000_drop_auth_users_actor_fks.sql
--
-- Those four are landing-page and blog content, which is why stale marketing
-- copy kept showing on a supposedly empty database.
--
-- ─── How old vs. new is decided ───
-- The clean truncated `roles` and reseeded the six system roles in the same
-- transaction, so max(roles.created_at) is the exact instant the last clean
-- ran. Rows older than that instant are pre-clean survivors; anything newer is
-- yours and is kept.
--
-- Rows with a NULL created_at are never deleted — they are only reported, so a
-- surprise cannot be destroyed silently. (blog_posts.created_at is the one
-- nullable column of the four.)
--
-- Usage: run PART 1 alone and read the numbers. Only if they look right, run
-- PART 2. PART 2 is wrapped in a transaction and prints what it deleted.
-- ═══════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════
-- PART 1 — PREVIEW (read-only, changes nothing)
-- ═══════════════════════════════════════════════════════════

DROP TABLE IF EXISTS _stale_preview;
CREATE TEMP TABLE _stale_preview (
    table_name        text,
    will_delete       bigint,
    will_keep         bigint,
    null_created_at   bigint
);

DO $$
DECLARE
    t       text;
    cutoff  timestamptz;
BEGIN
    SELECT max(created_at) INTO cutoff FROM roles;

    IF cutoff IS NULL THEN
        RAISE EXCEPTION
            'Cannot determine the last clean timestamp: table `roles` is empty. '
            'Re-seed the RBAC roles first, or replace the cutoff manually below.';
    END IF;

    RAISE NOTICE 'Last clean_database.sql run: %', cutoff;

    FOREACH t IN ARRAY ARRAY['testimonials', 'press_mentions', 'blog_posts', 'promo_codes'] LOOP
        IF to_regclass('public.' || t) IS NOT NULL THEN
            EXECUTE format(
                'INSERT INTO _stale_preview
                 SELECT %L,
                        count(*) FILTER (WHERE created_at <  %L),
                        count(*) FILTER (WHERE created_at >= %L),
                        count(*) FILTER (WHERE created_at IS NULL)
                 FROM public.%I',
                t, cutoff, cutoff, t
            );
        END IF;
    END LOOP;
END $$;

SELECT
    (SELECT max(created_at) FROM roles) AS last_clean_at,
    *
FROM _stale_preview
ORDER BY table_name;

-- Want to eyeball the actual rows before deleting anything? Run any of these:
--
--   SELECT id, created_at, name        FROM testimonials   ORDER BY created_at;
--   SELECT id, created_at, title       FROM press_mentions ORDER BY created_at;
--   SELECT id, created_at, title, slug FROM blog_posts     ORDER BY created_at;
--   SELECT id, created_at, code        FROM promo_codes    ORDER BY created_at;


-- ═══════════════════════════════════════════════════════════
-- PART 2 — DELETE the survivors
-- Run this only after PART 1's numbers look right.
-- ═══════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
    t        text;
    cutoff   timestamptz;
    removed  bigint;
    total    bigint := 0;
BEGIN
    SELECT max(created_at) INTO cutoff FROM roles;

    IF cutoff IS NULL THEN
        RAISE EXCEPTION 'Cannot determine the last clean timestamp: table `roles` is empty.';
    END IF;

    RAISE NOTICE 'Deleting rows created before %', cutoff;

    FOREACH t IN ARRAY ARRAY['testimonials', 'press_mentions', 'blog_posts', 'promo_codes'] LOOP
        IF to_regclass('public.' || t) IS NOT NULL THEN
            -- `created_at < cutoff` deliberately excludes NULLs: a NULL here is
            -- unexplained, and this script should not be the thing that quietly
            -- destroys it. PART 1 counts them so they stay visible.
            EXECUTE format('DELETE FROM public.%I WHERE created_at < %L', t, cutoff);
            GET DIAGNOSTICS removed = ROW_COUNT;
            total := total + removed;
            RAISE NOTICE '  % -> % row(s) deleted', rpad(t, 16), removed;
        END IF;
    END LOOP;

    RAISE NOTICE 'Total: % row(s) deleted', total;
END $$;

COMMIT;


-- ═══════════════════════════════════════════════════════════
-- PART 3 — VERIFY (optional)
-- Re-runs the same counts. `will_delete` should now be 0 everywhere.
-- ═══════════════════════════════════════════════════════════
--
-- Just re-run PART 1.
--
-- ─── Not covered by this script ───
-- Supabase Storage is separate from Postgres and was never touched by any
-- clean. If old uploaded images are still showing, list them first and delete
-- only what predates the cutoff:
--
--   SELECT name, created_at FROM storage.objects
--    WHERE bucket_id = 'event-assets'
--      AND created_at < (SELECT max(created_at) FROM roles)
--    ORDER BY created_at;
--
--   -- then, once the list looks right:
--   DELETE FROM storage.objects
--    WHERE bucket_id = 'event-assets'
--      AND created_at < (SELECT max(created_at) FROM roles);
-- ═══════════════════════════════════════════════════════════
