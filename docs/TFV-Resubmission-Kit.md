# Toll-Free Verification — Resubmission Kit

Prepared 2026-07-16, after remediation of all repo-side findings in
`TWILIO_COMPLIANCE_MASTER_AUDIT.md`. Use this verbatim when filling the TFV form
and when replying to Twilio's pre-review offer. **Do not submit until every
unchecked box in the audit's Section 20 is done** (deploy + migrations + toll-free
number + Twilio Console webhooks + viamarketing.ca + dry run).

---

## 1. TFV form field values

| Field | Value |
|---|---|
| Business name | `16941460 Canada Corp.` |
| DBA / friendly name | `Via Marketing` (product: `Fancy RSVP`) |
| Business website | `https://fancyrsvp.com` |
| Corporate website (if asked) | `https://viamarketing.ca` |
| Business address | `2488 Selord Court, Mississauga, Ontario L5J 1P7, Canada` |
| Business contact email | `info@viamarketing.ca` (corporate) / `info@fancyrsvp.com` (product) |
| **Opt-in URL** | `https://fancyrsvp.com/sms-opt-in` — **never `https://viamarketing.ca/`** (that URL's interstitial caused Rejection Reason 1) |
| Opt-in type | Web Form |
| Use case category | Events / notifications (transactional event communications) |
| Use case description | "Fancy RSVP is an event invitation and RSVP platform. Event hosts send their invited guests transactional texts: event invitations with the guest's personal RSVP link, RSVP confirmations/updates, RSVP-deadline and event-date reminders, and event updates (date/time/venue changes, day-of logistics). Guests opt in via an unchecked consent checkbox when submitting their phone number on the public RSVP form (or on https://fancyrsvp.com/sms-opt-in); consent is stored as a timestamped, versioned record. No marketing or promotional messaging." |
| Message volume | Fill with a realistic monthly estimate (typical guest receives 1–5 messages per event) |
| Additional information | Business registration document links (Corporations Canada certificate / articles of incorporation), one per line, plus: "Fancy RSVP is owned and operated by 16941460 Canada Corp. o/a Via Marketing — stated in the site footer, Terms §1, and Privacy §11." |

## 2. Opt-in workflow description (for the form / reviewer)

> A guest receives a personal invitation link from their event host. On the public
> RSVP form (no login), the guest enters their own phone number; an **unchecked**
> consent checkbox appears with the exact language below and the form cannot be
> submitted with a phone number unless it is checked (enforced server-side).
> Consent is stored with a timestamp, the consent-text version, and the capture
> source. A standalone public opt-in form with identical language is at
> https://fancyrsvp.com/sms-opt-in. Privacy Policy and Terms of Service are linked
> directly beside the checkbox.

## 3. Consent language (must match the site character-for-character)

> I agree to receive text messages from Fancy RSVP about this event, including
> event invitations, RSVP updates, reminders, and event updates. Message frequency
> varies. Message & data rates may apply. Reply STOP to opt out at any time, or
> HELP for help. See our Privacy Policy and Terms of Service.

(Source of truth: `frontend/src/app/components/guest/SmsConsentText.js`, version `2026-07-16`.)

## 4. Sample messages (copied from actual dispatcher output format)

Every outbound body gets the compliance footer appended by
`backend/services/smsDispatch.js` — samples must include it:

1. **Event invitation**
   `Hello Sarah, you are invited to our event! RSVP now: https://fancyrsvp.com/amelia-noah/rsvp?g=<id> - Fancy RSVP. Msg&data rates may apply. Reply STOP to opt out, HELP for help.`
2. **Reminder**
   `Hello Sarah, a quick reminder to RSVP for Amelia & Noah's Wedding by Friday: https://fancyrsvp.com/amelia-noah/rsvp?g=<id> - Fancy RSVP. Msg&data rates may apply. Reply STOP to opt out, HELP for help.`
3. **Event update**
   `Hello Sarah, an update for Amelia & Noah's Wedding: the ceremony now starts at 5 PM. Details: https://fancyrsvp.com/amelia-noah/rsvp?g=<id> - Fancy RSVP. Msg&data rates may apply. Reply STOP to opt out, HELP for help.`

## 5. Screenshot set to capture after deploy

1. `https://fancyrsvp.com/sms-opt-in` — full page (identity block + live form visible)
2. Close-up of the consent checkbox + exact language (unchecked state)
3. The same consent step inside a real event RSVP form (`/{slug}/rsvp`, step 2)
4. `https://fancyrsvp.com/privacy` — Section 3 (SMS) heading visible
5. `https://fancyrsvp.com/terms` — Section 5 (SMS) heading visible
6. Site footer showing "16941460 Canada Corp. o/a Via Marketing" + Mississauga address

## 6. Pre-review reply to Isa Bell (send BEFORE resubmitting — offered in the rejection email)

> Subject: Re: Need help with your Toll-Free Verification?
>
> Hi Isa,
>
> Thank you for the detailed breakdown. We've completed the fixes:
>
> 1. **Opt-in URL** — please use `https://fancyrsvp.com/sms-opt-in` (the previously
>    submitted viamarketing.ca URL was our corporate site and won't be used as the
>    opt-in URL again). The new page is public, loads directly with no login or
>    interstitial, and contains a live opt-in form: phone number field, an unchecked
>    consent checkbox naming Fancy RSVP and the exact message types (event
>    invitations, RSVP updates, reminders, event updates), frequency and rates
>    disclosures, STOP/HELP instructions, and direct links to our Terms of Service
>    and Privacy Policy on the same page. Submissions store a timestamped consent record.
> 2. **The same consent flow in production** — the identical consent language and
>    unchecked checkbox appear on every event RSVP form whenever a guest enters a
>    phone number, enforced server-side. Screenshots attached.
> 3. **Business verification** — fancyrsvp.com now displays our legal identity
>    site-wide (footer, Terms, Privacy, Contact): 16941460 Canada Corp., operating
>    as Via Marketing, 2488 Selord Court, Mississauga, Ontario L5J 1P7, Canada.
>    Our registration documents are attached / will be listed in the Additional
>    Information field of the resubmission.
>
> Could you take a look before we resubmit?
>
> Thank you,
> Fadi
> 16941460 Canada Corp. o/a Via Marketing (Fancy RSVP)

## 7. Hard blockers before resubmission (from audit §20 — do not skip)

- Toll-free number purchased/confirmed and set as `TWILIO_PHONE_NUMBER` (currently a local 815 number)
- Migrations `20260809000000_sms_compliance.sql` + `20260810000000_sms_optin_submissions.sql` applied
- Twilio Console: inbound webhook + status callback + HELP text (deployment/README.md Step 8)
- Frontend **built** and PM2 restarted (a `git pull` alone does not ship the frontend)
- viamarketing.ca shows Fancy RSVP + the same legal identity
- Fresh-browser US-IP dry run passes on `/sms-opt-in`
