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

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const LIMIT = 250; // per-event guest cap per run (safety)
const nowISO = () => new Date().toISOString();
const stamp = (table, id, col) => supabase.from(table).update({ [col]: nowISO() }).eq('id', id);

const frontendBase = () =>
  (process.env.FRONTEND_URL || 'https://fancyrsvp.com').split(',')[0].trim().replace(/\/$/, '');

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

/* ─── 1. RSVP reminders — invited, still-pending guests as the deadline nears ─── */
async function jobRsvpReminders() {
  const soon = new Date(Date.now() + 3 * DAY).toISOString();
  const { data: events } = await supabase
    .from('events')
    .select('id, title, slug, event_date, rsvp_deadline')
    .eq('status', 'active').eq('is_paid', true)
    .not('rsvp_deadline', 'is', null).gte('rsvp_deadline', nowISO()).lte('rsvp_deadline', soon)
    .limit(100);
  let sent = 0;
  for (const ev of (events || [])) {
    const { data: parties } = await supabase
      .from('rsvp_parties').select('id, label, response, guests(is_primary_contact, email)')
      .eq('event_id', ev.id).eq('response', 'pending').limit(LIMIT);
    for (const party of (parties || [])) {
      const email = primaryEmailOf(party);
      if (!email) continue;
      const r = { id: party.id, guest_name: party.label, email, response: party.response };
      const html = T.getRsvpReminderTemplate(r, ev, rsvpLinks(party.id, ev.id));
      const res = await dispatch({ kind: 'rsvp_reminder', ref: `rsvp:${party.id}`, to: email, subject: `Reminder: please RSVP for ${ev.title}`, html, eventId: ev.id });
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
    .select('id, title, slug, event_date, location_name, location_address')
    .eq('status', 'active').eq('is_paid', true)
    .gte('event_date', nowISO()).lte('event_date', soon)
    .limit(100);
  let sent = 0;
  for (const ev of (events || [])) {
    const revealed = (new Date(ev.event_date).getTime() - Date.now()) <= DAY; // 24h seating reveal
    const { data: parties } = await supabase
      .from('rsvp_parties').select('id, label, guests(is_primary_contact, email), seating_assignments(tables(table_name))')
      .eq('event_id', ev.id).eq('response', 'yes').limit(LIMIT);
    for (const party of (parties || [])) {
      const email = primaryEmailOf(party);
      if (!email) continue;
      const r = { id: party.id, guest_name: party.label, email, party_size: (party.guests || []).length || 1 };
      const tableName = revealed ? (party.seating_assignments?.[0]?.tables?.table_name || null) : null;
      const html = T.getEventReminderTemplate(r, ev, { tableName });
      const res = await dispatch({ kind: 'event_reminder', ref: `rsvp:${party.id}`, to: email, subject: `See you soon at ${ev.title}`, html, eventId: ev.id });
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
    .select('id, title, slug, event_date, notification_preferences, organizations(name, email)')
    .eq('status', 'active').eq('is_paid', true)
    .gte('event_date', nowISO()).lte('event_date', soon)
    .is('final_report_sent_at', null).limit(100);
  let sent = 0;
  for (const ev of (events || [])) {
    const org = ev.organizations;
    if (org && org.email && orgEmailOk(ev)) {
      const stats = await getEventStats(ev.id);
      const html = T.getFinalHeadcountReportTemplate({ orgName: org.name, event: ev, stats });
      const res = await dispatch({ kind: 'final_report', ref: `event:${ev.id}`, to: org.email, subject: `Final headcount: ${ev.title}`, html, eventId: ev.id });
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
        const res = await dispatch({ kind: 'recap', ref: `event:${ev.id}`, to: org.email, subject: `Recap: ${ev.title}`, html, eventId: ev.id });
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
      const res = await dispatch({ kind: 'thank_you', ref: `rsvp:${party.id}`, to: email, subject: `Thank you for celebrating ${ev.title}`, html, eventId: ev.id });
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
      const res = await dispatch({ kind: 'pending_payment', ref: `event:${ev.id}`, to: org.email, subject: `Activate your event: ${ev.title}`, html, eventId: ev.id });
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
async function notifyGuestsOfEventChange(eventId) {
  if (process.env.EMAIL_AUTOMATION_ENABLED !== 'true') return 0;
  try {
    const { data: ev } = await supabase
      .from('events')
      .select('id, title, slug, event_date, location_name, location_address, status, is_paid')
      .eq('id', eventId).single();
    if (!ev || ev.status !== 'active' || !ev.is_paid) return 0;

    const where = ev.location_name || ev.location_address || '';
    const changes = [];
    if (ev.event_date) changes.push({ label: 'When', value: T.formatEventDate(ev.event_date) || '' });
    if (where) changes.push({ label: 'Where', value: where });
    const url = `${T.getPublicBaseUrl()}/${ev.slug || ''}`;
    const changeKey = crypto.createHash('sha1').update(`${ev.event_date}|${where}`).digest('hex').slice(0, 12);

    const { data: parties } = await supabase
      .from('rsvp_parties').select('id, label, guests(is_primary_contact, email)')
      .eq('event_id', eventId).in('response', ['yes', 'maybe']).limit(LIMIT);
    let sent = 0;
    for (const party of (parties || [])) {
      const email = primaryEmailOf(party);
      if (!email) continue;
      const r = { id: party.id, guest_name: party.label, email };
      const html = T.getEventUpdatedTemplate(r, ev, changes, url);
      const res = await dispatch({ kind: 'event_update', ref: `evchg:${eventId}:${changeKey}:${party.id}`, to: email, subject: `Update to ${ev.title}`, html, eventId });
      if (res.sent) sent++;
    }
    return sent;
  } catch (err) {
    logger.warn({ err, eventId }, '[email-scheduler] event-change notify failed');
    return 0;
  }
}

const JOBS = [
  ['rsvp_reminders', jobRsvpReminders],
  ['event_reminders', jobEventReminders],
  ['final_reports', jobFinalReports],
  ['post_event', jobPostEvent],
  ['pending_payments', jobPendingPayments],
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

module.exports = { start, stop, runOnce, notifyGuestsOfEventChange, JOBS };
