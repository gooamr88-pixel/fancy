-- ════════════════════════════════════════════════════════════════════════════
-- A FIFTH SMS TYPE: rsvp_confirmation, with the guest's details in it
--
-- This key is not new — it is REVIVED. 20260822000000 retired it, on the
-- reasoning that it "told the guest something they had just done themselves, and
-- charged for it". That was a fair description of what it used to send: a bare
-- "thanks, you're confirmed".
--
-- What it sends now is the thing the guest cannot already know at the moment they
-- reply: the date, the venue, their table, who is sitting with them, what was
-- ordered for each of them, and the link to their own entry pass and seating map.
-- It replaces an organizer answering those questions by hand, one guest at a time.
--
-- Cost, measured with backend/utils/smsSegments and the real 78-character
-- compliance footer rather than estimated:
--
--     full detail  EN   3 segments    9c/guest    200 guests = $18.00
--     full detail  AR   6 segments   18c/guest    200 guests = $36.00
--
-- Hence the 1.6 weight below — the heaviest guest type, because it is the longest
-- message and it fires for everyone who accepts. The estimator has to quote for
-- that up front instead of the organizer discovering it mid-event.
-- ════════════════════════════════════════════════════════════════════════════


/* ── 1. Switch it on for existing events ──────────────────────────────────────
 *
 * `||` MERGES, so this adds the key and leaves every other switch exactly as the
 * organizer left it. Writing a fresh jsonb_build_object here instead would reset
 * their four existing choices to all-on — the mistake 20260822000000's own
 * comment warns about at length.
 *
 * Guarded on the key being ABSENT, which makes the statement idempotent: re-running
 * this file cannot switch the type back on for an organizer who has since turned
 * it off. A migration that quietly undoes a customer setting when re-applied is
 * worse than one that fails loudly.
 */
UPDATE public.events
   SET sms_settings = COALESCE(sms_settings, '{}'::jsonb)
                   || jsonb_build_object('rsvp_confirmation', true)
 WHERE NOT (COALESCE(sms_settings, '{}'::jsonb) ? 'rsvp_confirmation');


/* ── 2. …and for events created from now on ── */
ALTER TABLE public.events
  ALTER COLUMN sms_settings SET DEFAULT
    '{"invitation":true,"rsvp_confirmation":true,"seating_reminder":true,"event_update":true,"organizer_report":true}'::jsonb;

COMMENT ON COLUMN public.events.sms_settings IS
  'Per-event on/off switch for each of the FIVE SMS types (backend/config/smsMessageTypes.js). An absent key falls back to the registry default rather than to false — treating "absent" as "off" would silently disable a newly-shipped type for every existing event.';


/* ── 3. Price it ──────────────────────────────────────────────────────────────
 *
 * jsonb_set on the type_weights object rather than rebuilding it, for the same
 * reason as above: an admin may have tuned the other three weights, and this
 * migration has no business resetting them.
 *
 * `true` as the create_missing argument adds the key when absent. The COALESCE
 * chain covers a deployment where sms_pricing_config or type_weights does not
 * exist yet, which is the state of any environment that has not run
 * 20260819000000 — there, this seeds a usable object instead of erroring.
 */
-- ORDER MATTERS, and getting it backwards silently loses three weights.
--
-- Seed the whole object FIRST, where it is missing entirely. If the single-key
-- update below ran first, its jsonb_set(create_missing => true) would CREATE
-- type_weights containing nothing but rsvp_confirmation — and this statement's
-- "is it empty?" guard would then be false, so the other three would never be
-- written. The estimator would fall back to its JS defaults and appear to work,
-- which is exactly why it would go unnoticed.
UPDATE public.super_admin_config
   SET sms_pricing_config = jsonb_set(
         COALESCE(sms_pricing_config, '{}'::jsonb),
         '{type_weights}',
         jsonb_build_object(
           'invitation',        1.0,
           'rsvp_confirmation', 1.6,
           'seating_reminder',  1.2,
           'event_update',      0.3
         ),
         true
       )
 WHERE COALESCE(sms_pricing_config -> 'type_weights', '{}'::jsonb) = '{}'::jsonb;

-- Then add just the new key where an admin already has tuned weights we must not
-- touch.
UPDATE public.super_admin_config
   SET sms_pricing_config = jsonb_set(
         sms_pricing_config,
         '{type_weights,rsvp_confirmation}',
         '1.6'::jsonb,
         true
       )
 WHERE NOT (
   COALESCE(sms_pricing_config -> 'type_weights', '{}'::jsonb) ? 'rsvp_confirmation'
 );
