/**
 * ─────────────────────────────────────────────────────────────────────────────
 * LIFECYCLE EMAIL SCHEDULER
 *
 * A dependency-free interval scheduler that sweeps the database for "due" lifecycle
 * emails (reminders, reports, post-event) and dispatches them idempotently. Each job:
 *   • filters on per-entity "*_sent_at" stamps so a row is processed once, and
 *   • routes every send through emailService.dispatch (email_log (kind,ref) dedupe).
 *
 * Safety:
 *   • OFF unless EMAIL_AUTOMATION_ENABLED=true (controlled rollout — never blasts
 *     real users on deploy).
 *   • Single-leader: in a pm2 cluster only instance 0 schedules (idempotency still
 *     protects against accidental multi-run).
 *   • Best-effort throughout — a failing job never crashes the server.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const crypto = require('crypto');
const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');
const { dispatch } = require('./emailService');
const { getEventStats } = require('../utils/emailContext');
const tokenService = require('./tokenService');
const T = require('../utils/emailTemplates');
const { getPublicBaseUrl } = require('../utils/publicUrl');
const { sendTransactionalSms } = require('./smsDispatch');
const { getSmsType } = require('../config/smsMessageTypes');

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const LIMIT = 250; // per-event guest cap per run (safety)
const MAX_RETRIES = 3; // max retry attempts for failed email sends
const RETRY_BASE_MS = 1000; // base delay for exponential backoff (1s, 2s, 4s)
const nowISO = () => new Date().toISOString();
const stamp = (table, id, col) => supabase.from(table).update({ [col]: nowISO() }).eq('id', id);

/**
 * Wraps dispatch() with retry logic and exponential backoff.
 * Retries up to MAX_RETRIES times on failure before giving up.
 * Returns { sent: true } on success, { sent: false, error } after exhausting retries.
 */
async function dispatchWithRetry(payload) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await dispatch(payload);
      if (res.sent) return res;
      // dispatch returned but didn't send (e.g. dedup) — don't retry
      if (res.deduplicated) return res;
    } catch (err) {
      if (attempt >= MAX_RETRIES) {
        logger.error({ err, kind: payload.kind, ref: payload.ref, attempt }, '[email-scheduler] permanently failed after max retries');
        return { sent: false, error: err.message || 'MAX_RETRIES_EXCEEDED' };
      }
      const delay = RETRY_BASE_MS * Math.pow(2, attempt);
      logger.warn({ err, kind: payload.kind, ref: payload.ref, attempt, nextRetryMs: delay }, '[email-scheduler] dispatch failed, retrying');
      await new Promise(resolve => setTimeout(resolve, delay));
      continue;
    }
    // dispatch returned { sent: false } without throwing — retry
    if (attempt >= MAX_RETRIES) {
      logger.error({ kind: payload.kind, ref: payload.ref, attempt }, '[email-scheduler] permanently failed after max retries (send returned false)');
      return { sent: false, error: 'MAX_RETRIES_EXCEEDED' };
    }
    const delay = RETRY_BASE_MS * Math.pow(2, attempt);
    logger.warn({ kind: payload.kind, ref: payload.ref, attempt, nextRetryMs: delay }, '[email-scheduler] send returned false, retrying');
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  return { sent: false, error: 'MAX_RETRIES_EXCEEDED' };
}

const frontendBase = () => getPublicBaseUrl();

// Per-party "already sent?" stamps (reminder_sent_at etc.) were absorbed into the
// invitations ledger's per-channel tracking; lifecycle reminders aren't an
// invitation-delivery channel, so they rely solely on dispatch()'s email_log(kind,ref)
// UNIQUE-index dedup for idempotency rather than a pre-filter column.
const rsvpLinks = (partyId, eventId) => {
  const link = (response) => `${frontendBase()}/rsvp?token=${encodeURIComponent(tokenService.signRsvpInvite({ partyId, eventId, response }))}`;
  return { accept: link('accepted'), decline: link('declined'), maybe: link('maybe'), manage: link(undefined) };
};
const orgEmailOk = (ev) => !(ev.notification_preferences && ev.notification_preferences.email === false);
const primaryEmailOf = (party) => (party.guests || []).find((g) => g.is_primary_contact)?.email || null;

/**
 * The guest's entry-pass link, or null if they should not have one.
 *
 * signQrTicketForResponse returns null for anyone who is not a confirmed 'yes',
 * which is exactly the gate wanted: a guest who declined has no pass, and the
 * seating_reminder template has a shape for that. Never throws — a missing link
 * degrades the message, it does not fail the send.
 */
const ticketUrlFor = (party, ev, tableName = null) => {
  try {
    const token = tokenService.signQrTicketForResponse({
      response: party.response || 'yes',
      partyId: party.id,
      eventId: ev.id,
      tableName,
      partySize: (party.guests || []).length || 1,
      eventDate: ev.event_date,
    });
    return token ? T.buildTicketLinks(token).ticketUrl : null;
  } catch {
    return null;
  }
};

/**
 * Try to deliver a lifecycle message by SMS, and report whether the email should
 * be skipped.
 *
 * Returns TRUE only when a text was actually sent AND that type is defined as
 * replacing its email. Every other outcome — the add-on was never bought, the
 * organizer switched the type off, the guest never consented, they replied STOP,
 * the allowance ran dry, Twilio failed — returns false, and the caller sends the
 * email exactly as it always did.
 *
 * That asymmetry is the whole design: SMS is an upgrade to the delivery of a
 * message, never a precondition for it. A guest is always told; the channel is a
 * billing and preference question.
 *
 * Types with replacesEmail = false (RSVP confirmation, entry pass, organizer
 * report) always return false, because their email carries something the text
 * cannot — a scannable pass, a formatted report — so both must go.
 */
async function trySms(ev, { type, partyId = null, ref, context, lang = 'en' }) {
  if (!ev?.sms_addon_purchased_at) return false;   // cheap pre-check; the gate re-verifies
  const typeDef = getSmsType(type);
  if (!typeDef) return false;

  try {
    const result = await sendTransactionalSms({
      type, eventId: ev.id, partyId, ref, event: ev, lang, context,
    });
    return !!result.sent && typeDef.replacesEmail === true;
  } catch (err) {
    logger.warn({ err, type, eventId: ev.id }, '[email-scheduler] SMS attempt failed; falling back to email');
    return false;
  }
}

/* ─── 1. RSVP reminders — invited, still-pending guests as the deadline nears ─── */
async function jobRsvpReminders() {
  const soon = new Date(Date.now() + 3 * DAY).toISOString();
  const { data: events } = await supabase
    .from('events')
    // sms_* are selected once per EVENT and passed down to every party, so adding
    // the SMS channel costs one column set per event rather than a query per guest.
    .select('id, title, slug, event_date, rsvp_deadline, sms_addon_purchased_at, sms_settings')
    .eq('status', 'active').eq('is_paid', true)
    .not('rsvp_deadline', 'is', null).gte('rsvp_deadline', nowISO()).lte('rsvp_deadline', soon)
    .limit(100);
  let sent = 0;
  for (const ev of (events || [])) {
    const { data: parties } = await supabase
      .from('rsvp_parties').select('id, label, response, preferred_lang, guests(is_primary_contact, email)')
      .eq('event_id', ev.id).eq('response', 'pending').limit(LIMIT);
    for (const party of (parties || [])) {
      // EMAIL ONLY. The `rsvp_reminder` SMS type is retired.
      //
      // Chasing a non-responder is the least valuable thing a charged message can
      // do — the guest has already ignored an invitation, and the second nudge
      // converts poorly enough that it was never worth what it cost. The organizer
      // can text the invitation again by hand from the RSVPs tab if they want to,
      // which is a decision rather than a standing charge.
      const email = primaryEmailOf(party);
      if (!email) continue;
      const r = { id: party.id, guest_name: party.label, email, response: party.response };
      const html = T.getRsvpReminderTemplate(r, ev, rsvpLinks(party.id, ev.id));
      const res = await dispatchWithRetry({ kind: 'rsvp_reminder', ref: `rsvp:${party.id}`, to: email, subject: `Reminder: please RSVP for ${ev.title}`, html, eventId: ev.id });
      if (res.sent) sent++;
    }
  }
  return sent;
}

/* ─── 2. Event reminders — confirmed guests, event imminent (+ table if revealed) ─── */
async function jobEventReminders() {
  const soon = new Date(Date.now() + 3 * DAY).toISOString();
  const { data: events } = await supabase
    .from('events')
    .select('id, title, slug, event_date, location_name, location_address, sms_addon_purchased_at, sms_settings')
    .eq('status', 'active').eq('is_paid', true)
    .gte('event_date', nowISO()).lte('event_date', soon)
    .limit(100);
  let sent = 0;
  for (const ev of (events || [])) {
    const revealed = (new Date(ev.event_date).getTime() - Date.now()) <= DAY; // 24h seating reveal
    const { data: parties } = await supabase
      .from('rsvp_parties').select('id, label, preferred_lang, guests(is_primary_contact, email), seating_assignments(tables(table_name))')
      .eq('event_id', ev.id).eq('response', 'yes').limit(LIMIT);
    for (const party of (parties || [])) {
      const tableName = revealed ? (party.seating_assignments?.[0]?.tables?.table_name || null) : null;

      /**
       * THE DAY-BEFORE TEXT — the second and last time `seating_reminder` fires.
       *
       * A table number read weeks early is not the one anybody is looking at
       * while standing outside a venue. This is the single most useful message in
       * the whole lifecycle, and cutting the old `event_reminder` type without
       * replacing it would have left a guest with nothing but a text from the day
       * the organizer happened to seat them.
       *
       * ref is `evday:` and NOT `seat:` on purpose. The seating sweep uses
       * `seat:<party>:<table>`, so a guest seated at table 7 and then reminded
       * about table 7 would collide on the (kind, ref) unique index and the
       * reminder would be swallowed as a DUPLICATE. A distinct ref lets exactly
       * one of each through, and the `evday:` key is itself unique per party, so
       * the scheduler re-running every fifteen minutes still only sends once.
       *
       * Additive to the email below, never a replacement — `replacesEmail` is
       * false for every current type, so `viaSms` is not consulted and the mail
       * goes regardless of what the carrier did.
       */
      await trySms(ev, {
        type: 'seating_reminder',
        partyId: party.id,
        ref: `evday:${party.id}`,
        // The language this guest actually used when they RSVP'd. Without it a
        // guest who replied in Arabic gets an English reminder days later.
        lang: party.preferred_lang || 'en',
        context: {
          guestName: party.label,
          eventTitle: ev.title,
          dateLabel: T.formatEventDate ? T.formatEventDate(ev.event_date) : null,
          tableName,
          ticketUrl: ticketUrlFor(party, ev, tableName),
        },
      });

      const email = primaryEmailOf(party);
      if (!email) continue;
      const r = { id: party.id, guest_name: party.label, email, party_size: (party.guests || []).length || 1 };
      const html = T.getEventReminderTemplate(r, ev, { tableName });
      const res = await dispatchWithRetry({ kind: 'event_reminder', ref: `rsvp:${party.id}`, to: email, subject: `See you soon at ${ev.title}`, html, eventId: ev.id });
      if (res.sent) sent++;
    }
  }
  return sent;
}

/* ─── 3. Final headcount report — to the organizer ~24-30h before the event ─── */
async function jobFinalReports() {
  const soon = new Date(Date.now() + 30 * HOUR).toISOString();
  const { data: events } = await supabase
    .from('events')
    .select('id, title, slug, event_date, notification_preferences, sms_addon_purchased_at, sms_settings, organizations(name, email)')
    .eq('status', 'active').eq('is_paid', true)
    .gte('event_date', nowISO()).lte('event_date', soon)
    .is('final_report_sent_at', null).limit(100);
  let sent = 0;
  for (const ev of (events || [])) {
    const org = ev.organizations;

    // The organizer gets BOTH: the email carries the actual headcount table, the
    // text is the heads-up that it has landed. This is the one type addressed to
    // the customer rather than a guest, so it reads organizations.sms_consent —
    // their own opt-in — not any guest consent record (see resolveRecipient).
    const stats = (org && org.email && orgEmailOk(ev)) ? await getEventStats(ev.id) : null;
    await trySms(ev, {
      type: 'organizer_report',
      ref: `event:${ev.id}`,
      context: {
        eventTitle: ev.title,
        attending: stats?.attending ?? 0,
        pending: stats?.pending ?? 0,
        dashboardUrl: `${frontendBase()}/dashboard`,
      },
    });

    if (org && org.email && orgEmailOk(ev)) {
      const html = T.getFinalHeadcountReportTemplate({ orgName: org.name, event: ev, stats });
      const res = await dispatchWithRetry({ kind: 'final_report', ref: `event:${ev.id}`, to: org.email, subject: `Final headcount: ${ev.title}`, html, eventId: ev.id });
      if (res.sent) sent++;
    }
    await stamp('events', ev.id, 'final_report_sent_at');
  }
  return sent;
}

/* ─── 4. Post-event — organizer recap (once) + guest thank-you (attendees) ─── */
async function jobPostEvent() {
  const since = new Date(Date.now() - 3 * DAY).toISOString();
  const { data: events } = await supabase
    .from('events')
    .select('id, title, slug, event_date, recap_sent_at, notification_preferences, organizations(name, email)')
    .in('status', ['active', 'completed']).eq('is_paid', true)
    .lt('event_date', nowISO()).gte('event_date', since)
    .limit(100);
  let sent = 0;
  for (const ev of (events || [])) {
    if (!ev.recap_sent_at) {
      const org = ev.organizations;
      if (org && org.email && orgEmailOk(ev)) {
        const stats = await getEventStats(ev.id);
        const html = T.getPostEventRecapTemplate({ orgName: org.name, event: ev, stats });
        const res = await dispatchWithRetry({ kind: 'recap', ref: `event:${ev.id}`, to: org.email, subject: `Recap: ${ev.title}`, html, eventId: ev.id });
        if (res.sent) sent++;
      }
      await stamp('events', ev.id, 'recap_sent_at');
    }
    const { data: parties } = await supabase
      .from('rsvp_parties').select('id, label, guests(is_primary_contact, email)')
      .eq('event_id', ev.id).eq('response', 'yes').limit(LIMIT);
    for (const party of (parties || [])) {
      const email = primaryEmailOf(party);
      if (!email) continue;
      const r = { id: party.id, guest_name: party.label, email };
      const html = T.getPostEventThankYouTemplate(r, ev);
      const res = await dispatchWithRetry({ kind: 'thank_you', ref: `rsvp:${party.id}`, to: email, subject: `Thank you for celebrating ${ev.title}`, html, eventId: ev.id });
      if (res.sent) sent++;
    }
  }
  return sent;
}

/* ─── 5. Pending-payment nudge — unpaid drafts older than 24h ─── */
async function jobPendingPayments() {
  const cutoff = new Date(Date.now() - DAY).toISOString();
  const { data: events } = await supabase
    .from('events')
    .select('id, title, slug, created_at, organizations(name, email)')
    .eq('is_paid', false).eq('status', 'draft')
    .lte('created_at', cutoff).is('payment_reminder_sent_at', null).limit(100);
  let sent = 0;
  for (const ev of (events || [])) {
    const org = ev.organizations;
    if (org && org.email) {
      const html = T.getPendingPaymentReminderTemplate({ orgName: org.name, event: ev });
      const res = await dispatchWithRetry({ kind: 'pending_payment', ref: `event:${ev.id}`, to: org.email, subject: `Activate your event: ${ev.title}`, html, eventId: ev.id });
      if (res.sent) sent++;
    }
    await stamp('events', ev.id, 'payment_reminder_sent_at');
  }
  return sent;
}

/**
 * Trigger (not scheduled): notify confirmed/maybe guests when an organizer changes
 * a live event's date or venue. Gated by EMAIL_AUTOMATION_ENABLED (it's a broadcast),
 * and deduped per (event, new-details) so re-saving identical details never re-sends.
 * Called best-effort from eventController.updateEvent.
 */
/**
 * WHO HEARS THAT AN EVENT MOVED OR WAS CALLED OFF.
 *
 * Everyone who has not said no. This used to be `['yes', 'maybe']`, which is the
 * right audience only if the guest list is entirely self-serve — and it stopped
 * being that the moment an organizer could add someone by hand and invite them.
 *
 * The gap it left: a guest the organizer invited, who has not opened the
 * invitation yet, sits at `pending`. They had an invitation, they may well be
 * planning to come, and if the wedding was cancelled they were told nothing at
 * all. The organizer got a confirmation saying N guests had been contacted, and
 * N excluded every person who had not yet replied.
 *
 * `no` stays out on purpose: they have declined, they are not turning up, and a
 * cancellation notice to someone who already said no is a message nobody needs
 * and — on the SMS leg — one the organizer pays for.
 *
 * Exported so `eventController.countNotifiableGuests` counts the same rows this
 * function sends to. The confirm dialog's promise and the send have to be one
 * definition; two lists that agreed on the day they were written is exactly how
 * a dialog ends up quoting a number nobody receives.
 */
const NOTIFIABLE_RESPONSES = ['yes', 'maybe', 'pending', 'waitlist'];

async function notifyGuestsOfEventChange(eventId, { includeSms = false, force = false } = {}) {
  /**
   * THE ENV GATE IS BYPASSABLE, AND HAS TO BE.
   *
   * This returned 0 unless EMAIL_AUTOMATION_ENABLED was 'true', which is right for
   * the automatic date/venue path — that fires off a PATCH and is a broadcast
   * nobody explicitly asked for, so it belongs behind the same rollout switch as
   * every other scheduled job.
   *
   * It is catastrophically wrong for a CANCELLATION. On a deployment with the flag
   * unset, calling off an event would tell precisely nobody, silently, while
   * reporting success. `force` is passed only from the explicit cancel/notify
   * endpoints, where an organizer has already pressed a confirm dialog naming the
   * exact number of guests who will be contacted.
   */
  if (!force && process.env.EMAIL_AUTOMATION_ENABLED !== 'true') return { sent: 0, texted: 0 };

  try {
    const { data: ev } = await supabase
      .from('events')
      // sms_addon_purchased_at and sms_settings are NOT optional here.
      //
      // trySms pre-checks sms_addon_purchased_at on the row it is handed, so
      // omitting them from this select made the SMS leg return false for every
      // event on the platform — not erroring, not logging, simply never texting
      // anyone about a cancellation. A quiet always-false is the worst kind of
      // bug to own, so the columns are listed with a note rather than inherited.
      .select('id, title, slug, event_date, location_name, location_address, status, is_paid, cancellation_reason, sms_addon_purchased_at, sms_settings')
      .eq('id', eventId).single();

    // 'cancelled' is as valid a reason to notify as a date change — more so.
    if (!ev || !ev.is_paid) return { sent: 0, texted: 0 };
    if (ev.status !== 'active' && ev.status !== 'cancelled') return { sent: 0, texted: 0 };

    const cancelled = ev.status === 'cancelled';
    const where = ev.location_name || ev.location_address || '';
    const changes = [];
    if (ev.event_date) changes.push({ label: 'When', value: T.formatEventDate(ev.event_date) || '' });
    if (where) changes.push({ label: 'Where', value: where });
    const url = `${T.getPublicBaseUrl()}/${ev.slug || ''}`;

    // A cancellation is a single, final event in a party's life, so it gets a
    // fixed key rather than a content hash — an organizer who edits the date and
    // THEN cancels must not have the cancellation deduped against the change.
    const changeKey = cancelled
      ? 'cancelled'
      : crypto.createHash('sha1').update(`${ev.event_date}|${where}`).digest('hex').slice(0, 12);

    let sent = 0;
    let texted = 0;
    let from = 0;

    /**
     * PAGINATED, not `.limit(250)`.
     *
     * LIMIT is a per-run safety cap for jobs that sweep the same rows every
     * fifteen minutes — if one run misses a guest, the next picks them up. This
     * function runs ONCE per change. A 400-party event silently told 250 of them
     * their wedding had moved, and the other 150 never heard anything, ever.
     */
    for (;;) {
      const { data: parties } = await supabase
        .from('rsvp_parties')
        .select('id, label, preferred_lang, guests(is_primary_contact, email)')
        .eq('event_id', eventId)
        .in('response', NOTIFIABLE_RESPONSES)
        .order('id', { ascending: true })
        .range(from, from + LIMIT - 1);

      if (!parties || parties.length === 0) break;

      for (const party of parties) {
        // Text first, then mail — but the two are independent, and neither
        // suppresses the other. `event_update` has replacesEmail: false, so
        // trySms always returns false here and the mail below always goes. Both
        // channels, deliberately: this is the one message where a guest missing
        // it is a genuine harm, and a text and an email fail in different ways.
        if (includeSms && ev.sms_addon_purchased_at) {
          // sendTransactionalSms directly, NOT trySms.
          //
          // trySms answers "should I skip the email?", which for this type is
          // always false — so it cannot tell us whether a text actually went. The
          // count is what the confirm dialog promised the organizer, so it has to
          // come from the send itself.
          const smsResult = await sendTransactionalSms({
            type: 'event_update',
            eventId,
            partyId: party.id,
            ref: `evchg:${eventId}:${changeKey}:${party.id}`,
            event: ev,
            lang: party.preferred_lang || 'en',
            context: { guestName: party.label, eventTitle: ev.title, url, cancelled },
          }).catch(() => ({ sent: false }));
          if (smsResult.sent) texted += 1;
        }

        const email = primaryEmailOf(party);
        if (!email) continue;
        const r = { id: party.id, guest_name: party.label, email };
        const lang = party.preferred_lang === 'ar' ? 'ar' : 'en';
        const html = cancelled
          ? T.getEventCancelledTemplate(r, ev, url, lang, ev.cancellation_reason || null)
          : T.getEventUpdatedTemplate(r, ev, changes, url, lang);
        const res = await dispatch({
          kind: 'event_update',
          // sms_log and email_log are separate tables with separate (kind, ref)
          // uniques, so the identical ref is safe — and means one guest is
          // deduped identically on both channels.
          ref: `evchg:${eventId}:${changeKey}:${party.id}`,
          to: email,
          subject: cancelled ? `Cancelled: ${ev.title}` : `Update to ${ev.title}`,
          html,
          eventId,
        });
        if (res.sent) sent++;
      }

      if (parties.length < LIMIT) break;
      from += LIMIT;
    }

    return { sent, texted };
  } catch (err) {
    logger.warn({ err, eventId }, '[email-scheduler] event-change notify failed');
    return { sent: 0, texted: 0 };
  }
}

/* ─── 6. Seating notices — text guests their table, once the dust has settled ─── */

/**
 * How long a party's seat must sit UNCHANGED before we text them about it.
 *
 * The whole reason this job exists. Seating endpoints do not send; they upsert
 * into seating_notify_queue, and every subsequent move overwrites the row. This
 * job sweeps rows that have been still for the quiet period and sends once, with
 * the final table.
 *
 * Without it, a drag-and-drop session on a 200-guest chart would issue one text
 * per drop — hundreds of charged messages for one afternoon of tidying, and a
 * guest moved four times receiving four texts, three of them naming a table they
 * are not sitting at.
 *
 * Ten minutes, plus up to one scheduler interval, means a guest hears within
 * roughly 25 minutes of the organizer finishing. The seating screen says so.
 */
const SEATING_QUIET_MS = 10 * 60 * 1000;

async function jobSeatingNotices() {
  const dueBefore = new Date(Date.now() - SEATING_QUIET_MS).toISOString();

  const { data: due, error } = await supabase
    .from('seating_notify_queue')
    .select('event_id, party_id, table_id')
    .is('notified_at', null)
    .lt('queued_at', dueBefore)
    .order('queued_at', { ascending: true })
    .limit(500);

  // An unmigrated deployment has no queue table. Degrade to doing nothing rather
  // than failing the whole scheduler run — every other job is unrelated.
  if (error || !due || due.length === 0) return 0;

  // Group by event so each event's row and settings are fetched once, not once
  // per guest. A 300-guest chart is 300 queue rows and one event.
  const byEvent = new Map();
  for (const row of due) {
    if (!byEvent.has(row.event_id)) byEvent.set(row.event_id, []);
    byEvent.get(row.event_id).push(row);
  }

  let sent = 0;
  for (const [eventId, rows] of byEvent) {
    const { data: ev } = await supabase
      .from('events')
      .select('id, title, slug, event_date, sms_addon_purchased_at, sms_settings, status')
      .eq('id', eventId).maybeSingle();

    // A cancelled event must not text anyone about where they were going to sit.
    // Clear the rows so they are not reconsidered every fifteen minutes forever.
    if (!ev || ev.status === 'cancelled') {
      await supabase.from('seating_notify_queue')
        .update({ notified_at: nowISO() })
        .eq('event_id', eventId)
        .in('party_id', rows.map((r) => r.party_id));
      continue;
    }

    for (const row of rows) {
      try {
        const { data: party } = await supabase
          .from('rsvp_parties')
          .select('id, label, response, preferred_lang, guests(is_primary_contact), seating_assignments(tables(id, table_name))')
          .eq('id', row.party_id).maybeSingle();

        // Only confirmed attendees get a table text. Someone who declined after
        // being seated should not be told where they are sitting.
        if (party && party.response === 'yes') {
          // Read the table from the LIVE assignment, not from the queued
          // table_id. The queue row records that something changed; the database
          // records what it changed to, and between the two the database is the
          // one that cannot be stale.
          const tableName = party.seating_assignments?.[0]?.tables?.table_name || null;
          const tableId = party.seating_assignments?.[0]?.tables?.id || row.table_id || 'none';

          const result = await sendTransactionalSms({
            type: 'seating_reminder',
            eventId,
            partyId: party.id,
            /**
             * `seat:<party>:<table>` — the ref IS the idempotency rule, and it
             * reads as "we told this party about this table once".
             *
             * A guest moved A → B → A inside the quiet window collapses to one
             * queue row naming A, and this ref then matches the send already in
             * sms_log, so it skips as DUPLICATE and costs nothing. Which is
             * exactly right: nothing actually changed for that guest.
             *
             * A genuine A → B a week later is a new ref, so it sends once.
             */
            ref: `seat:${party.id}:${tableId}`,
            event: ev,
            lang: party.preferred_lang || 'en',
            context: {
              guestName: party.label,
              eventTitle: ev.title,
              tableName,
              ticketUrl: ticketUrlFor(party, ev, tableName),
            },
          });
          if (result.sent) sent += 1;
        }
      } catch (err) {
        logger.warn({ err, partyId: row.party_id }, '[email-scheduler] seating notice failed');
      }

      /**
       * Stamped WHATEVER happened — sent, skipped, or thrown.
       *
       * The outcome belongs in sms_log, which records it with a reason. This
       * column only answers "have we dealt with this queue row yet". Leaving it
       * null on a skip would retry a guest who has no phone number every fifteen
       * minutes until the event, forever.
       */
      await supabase.from('seating_notify_queue')
        .update({ notified_at: nowISO() })
        .eq('event_id', eventId)
        .eq('party_id', row.party_id);
    }
  }

  return sent;
}

const JOBS = [
  ['rsvp_reminders', jobRsvpReminders],
  ['event_reminders', jobEventReminders],
  ['final_reports', jobFinalReports],
  ['post_event', jobPostEvent],
  ['pending_payments', jobPendingPayments],
  ['seating_notices', jobSeatingNotices],
];

let running = false;
async function runOnce(trigger = 'interval') {
  if (running) { logger.info('[email-scheduler] previous run still in progress — skipping'); return {}; }
  running = true;
  const t0 = Date.now();
  const summary = {};
  for (const [name, fn] of JOBS) {
    try { summary[name] = await fn(); }
    catch (err) { logger.warn({ err, job: name }, '[email-scheduler] job failed'); summary[name] = 'error'; }
  }
  running = false;
  logger.info({ summary, ms: Date.now() - t0, trigger }, '[email-scheduler] run complete');
  return summary;
}

let timer = null;
function start() {
  if (process.env.EMAIL_AUTOMATION_ENABLED !== 'true') {
    logger.info('[email-scheduler] disabled — set EMAIL_AUTOMATION_ENABLED=true to enable lifecycle emails');
    return;
  }
  // Single-leader in a pm2 cluster: only instance 0 schedules.
  const instance = process.env.NODE_APP_INSTANCE;
  if (instance !== undefined && instance !== '0') {
    logger.info(`[email-scheduler] standby on instance ${instance} (leader is instance 0)`);
    return;
  }
  const intervalMin = Math.max(5, parseInt(process.env.EMAIL_SCHEDULER_INTERVAL_MIN, 10) || 15);
  logger.info(`[email-scheduler] enabled — sweeping every ${intervalMin} min`);
  timer = setInterval(() => runOnce('interval').catch(() => {}), intervalMin * 60 * 1000);
  if (timer.unref) timer.unref();
  setTimeout(() => runOnce('startup').catch(() => {}), 30 * 1000).unref();
}
function stop() { if (timer) { clearInterval(timer); timer = null; } }

module.exports = { start, stop, runOnce, notifyGuestsOfEventChange, NOTIFIABLE_RESPONSES, JOBS };
