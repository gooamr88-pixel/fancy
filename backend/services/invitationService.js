/**
 * InvitationService — unified delivery + tracking for email and QR-ticket
 * invitations. Writes every attempt to the `invitations` ledger (Phase 1),
 * which replaces the old scattered tracking: invitation_sent/invitation_sent_at/
 * qr_email_sent booleans on rsvps, plus the separate guest_reminders table.
 *
 * SMS campaigns deliberately stay on their own path (campaignController.js +
 * services/smsDispatch.js): that subsystem already has a single, well-tested
 * source of truth for segment-accurate atomic credit billing, sync/async
 * dispatch, and idempotent delivery — re-deriving that here would risk the
 * one part of the old system the audit found to be genuinely solid. The
 * unified `POST /events/:eventId/invitations/send` route normalizes the
 * *response shape* across channels; for `channel: 'sms'` it forwards to the
 * existing campaign dispatcher rather than reimplementing billing.
 */
const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');
const tokenService = require('./tokenService');
const notificationService = require('../utils/notificationService');
const { getInvitationTemplate, getQRTicketTemplate, buildGuestEventUrl, buildTicketLinks } = require('../utils/emailTemplates');

/** Records one delivery attempt in the unified ledger. */
async function logInvitation({ partyId, eventId, channel, token = null, status, metadata = {} }) {
  const { data, error } = await supabase.from('invitations').insert({
    party_id: partyId,
    event_id: eventId,
    channel,
    token,
    status,
    sent_at: status === 'sent' ? new Date() : null,
    metadata,
  }).select('id').single();
  if (error) {
    logger.error({ err: error }, 'Failed to write invitation ledger row');
    return null;
  }
  return data.id;
}

/** Fetches the event context every channel needs, and confirms it's live. */
async function resolveLiveEvent(eventId) {
  const { data: event, error } = await supabase
    .from('events')
    .select('id, title, event_date, slug, location_name, location_address, is_paid, status, notification_preferences')
    .eq('id', eventId)
    .single();
  if (error || !event) return { event: null, code: 'EVENT_NOT_FOUND' };
  if (!event.is_paid || event.status !== 'active') {
    return {
      event: null,
      code: 'EVENT_NOT_LIVE',
      message: !event.is_paid
        ? "This event hasn't been paid for yet. Invitations can only be sent once your event is paid and live."
        : `Your event isn't live yet — it's currently "${event.status}". Invitations can only be sent once it becomes active.`,
    };
  }
  return { event };
}

/** Sends one email invitation (single "View Invitation" link to the guest's card) to a party's primary contact. */
async function sendEmailInvite(event, party) {
  if (!party.primaryEmail) return { sent: false, reason: 'NO_EMAIL' };

  // One link straight to the guest's own invitation card (/{slug}?party_id=...) —
  // no vote-by-email buttons. The guest sees the full invitation first and RSVPs
  // from there, same as every other entry point into the event page.
  const viewUrl = buildGuestEventUrl(event.slug, party.id);
  // Still mint a token for the ledger (kept for tracking/resend parity with the
  // other channels) even though it's no longer embedded in the email itself.
  const ledgerToken = tokenService.signRsvpInvite({ partyId: party.id, eventId: event.id, response: undefined });

  const shimParty = { id: party.id, guest_name: party.label, email: party.primaryEmail, party_size: party.partySize };
  const shimEvent = {
    title: event.title, event_date: event.event_date, slug: event.slug,
    location_name: event.location_name, location_address: event.location_address,
  };
  const html = getInvitationTemplate(shimParty, shimEvent, { view: viewUrl });

  const success = await notificationService.sendEmailViaBrevo(party.primaryEmail, `You're Invited: ${event.title}`, html);
  if (!success) {
    await logInvitation({ partyId: party.id, eventId: event.id, channel: 'email', status: 'failed' });
    return { sent: false, reason: 'DELIVERY_FAILED' };
  }
  await logInvitation({ partyId: party.id, eventId: event.id, channel: 'email', token: ledgerToken, status: 'sent' });
  return { sent: true };
}

/**
 * Bulk-sends email invitations. By default targets parties with a primary
 * contact email who haven't already received one (per the invitations
 * ledger); `resend: true` re-sends to everyone with an email; `partyIds`
 * targets specific parties.
 */
async function sendEmailBulk(eventId, { partyIds, resend = false } = {}) {
  const { event, code, message } = await resolveLiveEvent(eventId);
  if (!event) return { code, message };

  const { data: parties, error } = await supabase
    .from('rsvp_parties')
    .select('id, label, guests(is_primary_contact, email)')
    .eq('event_id', eventId)
    .limit(2000);
  if (error) throw error;

  let candidates = (parties || [])
    .map((p) => ({
      id: p.id,
      label: p.label,
      primaryEmail: (p.guests || []).find((g) => g.is_primary_contact)?.email || null,
      partySize: (p.guests || []).length || 1,
    }))
    .filter((p) => !!p.primaryEmail);

  if (Array.isArray(partyIds) && partyIds.length > 0) {
    const want = new Set(partyIds);
    candidates = candidates.filter((p) => want.has(p.id));
  } else if (!resend) {
    const { data: alreadySent } = await supabase
      .from('invitations').select('party_id').eq('event_id', eventId).eq('channel', 'email')
      .in('status', ['sent', 'delivered', 'opened', 'responded']);
    const sentIds = new Set((alreadySent || []).map((i) => i.party_id));
    candidates = candidates.filter((p) => !sentIds.has(p.id));
  }

  if (candidates.length === 0) {
    return { queued: 0, sent: 0, skipped: 0, failed: 0, message: 'No parties with an email address were eligible for an invitation.' };
  }

  let sent = 0, skipped = 0, failed = 0;
  const failures = [];
  const BATCH = 10;
  for (let i = 0; i < candidates.length; i += BATCH) {
    const batch = candidates.slice(i, i + BATCH);
    const results = await Promise.allSettled(batch.map((p) => sendEmailInvite(event, p)));
    results.forEach((r, idx) => {
      if (r.status === 'fulfilled' && r.value?.sent) sent++;
      else if (r.status === 'fulfilled' && r.value?.reason === 'NO_EMAIL') skipped++;
      else { failed++; failures.push({ partyId: batch[idx].id, reason: r.status === 'fulfilled' ? r.value.reason : String(r.reason) }); }
    });
  }

  await supabase.from('activity_logs').insert({
    event_id: eventId, action: 'invitation_campaign_sent', entity_type: 'campaign',
    metadata: { channel: 'email', total: candidates.length, sent, skipped, failed },
  }).then(() => {}).catch(() => {});

  return { queued: candidates.length, sent, skipped, failed, failures };
}

/**
 * Sends the QR check-in pass for one party.
 *
 * Seating is OPTIONAL. This used to query `seating_assignments` as the ROOT
 * table with `.single()`, so a party the organizer hadn't seated yet threw
 * NO_SEATING_ASSIGNMENT and the organizer's "resend QR ticket" action failed
 * with a 400 — meaning an event with no seating chart at all (a reception, a
 * standing party) could never issue a check-in code to anyone. The door
 * scanner never trusted the token's tableName in the first place
 * (checkinController.scanCheckIn re-reads the live assignment and falls back to
 * "Unassigned"), so an unseated pass has always been valid at the gate; only
 * this send path disagreed. The party row is now the root and the assignment is
 * an optional embed.
 */
async function sendQrTicketEmail(eventId, partyId) {
  const { data: party, error } = await supabase
    .from('rsvp_parties')
    .select(`
      id, label, response,
      guests(is_primary_contact, email),
      seating_assignments(tables(table_name)),
      events(id, title, event_date, location_name, location_address, location_lat, location_lng)
    `)
    .eq('id', partyId)
    .eq('event_id', eventId)
    .single();

  if (error || !party) throw new Error('PARTY_NOT_FOUND');
  // An entry pass for someone who declined is a mistake, not a courtesy — and
  // the QR would still open the door if they showed up with it.
  if (party.response === 'no') throw new Error('NOT_ATTENDING');

  const primaryEmail = (party.guests || []).find((g) => g.is_primary_contact)?.email || null;
  const partySize = (party.guests || []).length || 1;
  const event = party.events;
  const tableName = (Array.isArray(party.seating_assignments) ? party.seating_assignments[0] : party.seating_assignments)
    ?.tables?.table_name || null;

  if (!primaryEmail) {
    logger.info(`[InvitationService] Party ${party.label} has no email configured. Skipping QR ticket email.`);
    return { sent: false, reason: 'NO_EMAIL' };
  }

  const token = tokenService.signQrTicket({
    partyId,
    eventId,
    tableName,
    partySize,
    eventDate: event.event_date,
  });

  const links = buildTicketLinks(token);

  // NO SMS IS SENT FROM HERE ANY MORE.
  //
  // This used to fire the `qr_ticket` text alongside the email. That type is gone,
  // absorbed into `seating_reminder`, and — more importantly — the text is no
  // longer sent at the moment of seating at all. It is QUEUED.
  //
  // The reason is cost. Seating fires this function once per guest, and a
  // drag-and-drop session on a 200-guest chart issues one call per drop, so
  // texting inline meant an organizer tidying their layout for twenty minutes
  // spent hundreds of messages and a guest moved four times received four texts,
  // three of them naming the wrong table.
  //
  // seatingController now upserts into seating_notify_queue instead, and
  // emailScheduler.jobSeatingNotices sweeps it after a quiet period and sends once
  // with the final table. The EMAIL below stays immediate — it is free, and it is
  // what actually carries the scannable pass.

  const shimParty = { id: party.id, guest_name: party.label, email: primaryEmail, party_size: partySize };
  // The data model has no table→zone relationship (zones are standalone venue
  // elements in the same `tables` table, not a parent of seatable tables), so a
  // ticket carries no zone label.
  const html = getQRTicketTemplate(shimParty, event, { tableName, zoneName: null, links });

  const subject = tableName
    ? `Your Entry Pass & Table: ${event.title}`
    : `Your Entry Pass: ${event.title}`;
  const success = await notificationService.sendEmailViaBrevo(primaryEmail, subject, html);
  await logInvitation({
    partyId, eventId, channel: 'qr', token, status: success ? 'sent' : 'failed',
    metadata: { tableName },
  });
  if (success) {
    await supabase.from('activity_logs').insert({
      event_id: eventId, action: 'qr_email_sent', entity_type: 'rsvp_party', entity_id: partyId,
      metadata: { label: party.label, email: primaryEmail },
    });
  }
  return { sent: success };
}

/* ─── SMS invitations ──────────────────────────────────────────────────────
 *
 * Concurrency for a manual send. Ten at a time with a short pause between
 * batches keeps a 500-guest send inside a request timeout without presenting the
 * carrier with 500 simultaneous connections, which is how an account gets
 * rate-limited at exactly the wrong moment.
 */
const SMS_BATCH_SIZE = 10;
const SMS_BATCH_PAUSE_MS = 1000;
const MAX_SMS_RECIPIENTS = 5000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Text the invitation to a chosen set of guests.
 *
 * THE ONLY manual SMS path in the platform, and deliberately unlike the campaign
 * blaster it replaces. There is no message body in the request: the organizer
 * chooses WHO, and the platform decides WHAT — a templated invitation, the same
 * shape the email channel sends.
 *
 * That is what makes this safe as an ordinary button rather than something behind
 * an attestation dialog. Free-form text to a resolved audience segment is the
 * pattern that got our toll-free number rejected; a templated invitation to a
 * guest carrying a recorded consent record is precisely what it is registered to
 * carry.
 *
 * Every send still runs the full sendTransactionalSms gate chain — entitlement,
 * the organizer's per-type switch, (kind, ref) idempotency, per-party consent,
 * global STOP suppression, transport availability, atomic billing. Nothing here
 * re-implements any of it.
 *
 * @returns {Promise<{code?:string, message:string, sent?:number, skipped?:number,
 *                    failed?:number, breakdown?:Array}>}
 */
/**
 * The context for the full-detail confirmation text.
 *
 * Everything comes from the committed party row, so what the message says and what
 * the page behind its link shows are derived from the same data. The table is read
 * from the LIVE seating assignment rather than anything cached: between a stored
 * value and the chart, the chart is the one that cannot be stale.
 */
function buildDetailContext(party, event) {
  const members = party.guests || [];
  const companions = members
    .filter((g) => !g.is_primary_contact && g.full_name)
    .map((g) => g.full_name);

  // A tally, not a dish per person. "Beef Steak x2, Fish x1" answers "what did we
  // order" in a fraction of the characters, and characters are segments.
  const tally = {};
  for (const g of members) {
    if (g.meal_selection) tally[g.meal_selection] = (tally[g.meal_selection] || 0) + 1;
  }
  for (const [meal, n] of Object.entries(party.companion_meal_counts || {})) {
    if (meal && Number(n) > 0) tally[meal] = (tally[meal] || 0) + Number(n);
  }
  const meals = Object.entries(tally)
    .sort((a, b) => b[1] - a[1])
    .map(([meal, n]) => (n > 1 ? `${meal} x${n}` : meal));

  const seat = Array.isArray(party.seating_assignments) ? party.seating_assignments[0] : party.seating_assignments;
  const tableName = seat?.tables?.table_name || null;

  let ticketUrl = null;
  try {
    const token = tokenService.signQrTicketForResponse({
      response: party.response,
      partyId: party.id,
      eventId: event.id,
      tableName,
      partySize: members.length || 1,
      eventDate: event.event_date,
    });
    if (token) ticketUrl = buildTicketLinks(token).ticketUrl;
  } catch {
    // A missing link degrades the message; it must not fail the send.
  }

  return {
    guestName: party.label || 'Guest',
    eventTitle: event.title,
    dateLabel: formatEventDate ? formatEventDate(event.event_date) : null,
    venue: event.location_name || event.location_address || null,
    tableName,
    companions,
    meals,
    ticketUrl,
  };
}

/**
 * @param {object}  [opts]
 * @param {string}  [opts.type='invitation']  'invitation' | 'rsvp_confirmation'
 */
async function sendInvitationSmsBulk(eventId, partyIds, { user = null, type = 'invitation' } = {}) {
  const ids = [...new Set(partyIds || [])];
  const refPrefix = type === 'rsvp_confirmation' ? 'detail' : 'inv';
  const what = type === 'rsvp_confirmation' ? 'Details' : 'Invitation';

  if (ids.length === 0) {
    return { code: 'NO_RECIPIENTS', message: 'Choose at least one guest to text.' };
  }
  if (ids.length > MAX_SMS_RECIPIENTS) {
    return {
      code: 'TOO_MANY_RECIPIENTS',
      message: `That is more than ${MAX_SMS_RECIPIENTS} guests in one go. Send it in smaller groups.`,
    };
  }

  const { data: event } = await supabase
    .from('events')
    /**
     * `event_date`, `location_name` and `location_address` are here for the
     * DETAIL type, and leaving them out is a silent content bug rather than a
     * crash — which is how it got shipped.
     *
     * buildDetailContext reads all three: the first for the "on Sat 12 Sep" clause
     * AND for the entry-pass token's expiry (signQrTicket falls back to a flat 30
     * days when eventDate is undefined, so the link still worked and nothing
     * complained), the other two for the venue. Without them the manual "All their
     * details" text sent with no date and no venue — the two facts the message
     * exists to carry — while the automatic path, which loads its own event row,
     * included them. The same button producing a different message depending on who
     * triggered it is exactly the kind of thing a template test does not catch.
     */
    .select('id, title, slug, event_date, location_name, location_address, sms_addon_purchased_at, sms_settings')
    .eq('id', eventId)
    .single();
  if (!event) return { code: 'EVENT_NOT_FOUND', message: 'That event could not be found.' };
  if (!event.sms_addon_purchased_at) {
    return { code: 'ADDON_INACTIVE', message: 'Text messaging is not active for this event yet.' };
  }

  // The ramp-up cap. Route middleware checks it too; this is the backstop for any
  // caller that reaches the service directly, and being told "50 at a time" AFTER
  // half a list has been charged is far worse than being told before.
  const { resolveSendLimit } = require('../controllers/campaignController');
  const { maxPerSend } = await resolveSendLimit(eventId, user);
  if (maxPerSend > 0 && ids.length > maxPerSend) {
    return {
      code: 'SEND_LIMIT',
      message: `You can text ${maxPerSend} guests at a time for now. This lifts as your event sends more messages — you can still reach everyone, just in a few goes.`,
    };
  }

  /**
   * One query for every recipient rather than one per guest inside the send loop.
   *
   * The column list covers BOTH message types this function can send. Two of them
   * matter for reasons that are easy to miss:
   *   • preferred_lang — a guest who filled the form in Arabic must not get an
   *     English message days later;
   *   • response + guests + seating — the detail text names who is coming and what
   *     they ordered, and reads it from the committed party so the text and the
   *     page it links to can never disagree.
   */
  const { data: parties } = await supabase
    .from('rsvp_parties')
    .select(`
      id, label, preferred_lang, response, companion_meal_counts,
      guests(full_name, is_primary_contact, meal_selection),
      seating_assignments(tables(table_name))
    `)
    .eq('event_id', eventId)
    .in('id', ids);
  const byId = new Map((parties || []).map((p) => [p.id, p]));

  const { sendTransactionalSms } = require('./smsDispatch');
  const { buildGuestRsvpUrl, buildTicketLinks, formatEventDate } = require('../utils/emailTemplates');
  const tokenService = require('./tokenService');
  const { explainSkip } = require('../utils/smsUsage');

  const chunk = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  let sent = 0, skipped = 0, failed = 0, processed = 0;
  const reasons = {};

  for (const group of chunk(ids, SMS_BATCH_SIZE)) {
    const outcomes = await Promise.all(group.map(async (partyId) => {
      const party = byId.get(partyId);
      // An id that is not in this event is not worth failing the whole request
      // for — a stale browser tab holds one very easily.
      if (!party) return { sent: false, reason: 'NOT_FOUND' };

      /**
       * The detail text is only meaningful for a guest who accepted.
       *
       * It names their table and links to an entry pass, and
       * signQrTicketForResponse mints nothing for a maybe or a no — so without
       * this the message would go out with an empty link slot. Refused here with
       * a reason the organizer can read, rather than sent broken.
       */
      if (type === 'rsvp_confirmation' && party.response !== 'yes') {
        return { sent: false, reason: 'NOT_ATTENDING' };
      }

      const context = type === 'rsvp_confirmation'
        ? buildDetailContext(party, event)
        : {
          guestName: party.label || 'Guest',
          eventTitle: event.title,
          rsvpUrl: buildGuestRsvpUrl(event.slug, partyId),
        };

      return sendTransactionalSms({
        type,
        eventId,
        partyId,
        // Timestamped, so a deliberate re-send is never swallowed by the
        // (kind, ref) idempotency guard. That guard exists to stop a SCHEDULER
        // re-sending on every tick; an organizer pressing this button is stating
        // intent, and the confirm dialog tells them what it will cost.
        //
        // NOTE the automatic path uses `rsvpconf:<party>` with no timestamp, so
        // the once-per-guest guarantee holds there while a manual resend stays
        // possible here. Two refs, two different jobs, on purpose.
        ref: `${refPrefix}:${partyId}:${Date.now()}`,
        event,
        lang: party.preferred_lang || 'en',
        context,
      });
    }));

    for (const outcome of outcomes) {
      processed += 1;
      if (outcome.sent) { sent += 1; continue; }
      const reason = outcome.reason || 'SKIPPED';
      reasons[reason] = (reasons[reason] || 0) + 1;
      if (reason === 'SEND_FAILED' || reason === 'ERROR') failed += 1;
      else skipped += 1;
    }

    if (processed < ids.length) await sleep(SMS_BATCH_PAUSE_MS);
  }

  // Grouped and already in the organizer's own language, so the result reads
  // "3 haven't agreed to receive texts" rather than NO_CONSENT × 3.
  const breakdown = Object.entries(reasons)
    .map(([reason, count]) => ({ reason, count, message: explainSkip(reason) || 'It could not be delivered' }))
    .sort((a, b) => b.count - a.count);

  return {
    sent,
    skipped,
    failed,
    breakdown,
    message: sent === ids.length
      ? `${what} texted to ${sent} ${sent === 1 ? 'guest' : 'guests'}.`
      : `Texted ${sent} of ${ids.length}. ${skipped + failed} could not be reached.`,
  };
}

module.exports = {
  logInvitation,
  resolveLiveEvent,
  sendEmailInvite,
  sendEmailBulk,
  sendQrTicketEmail,
  sendInvitationSmsBulk,
};
