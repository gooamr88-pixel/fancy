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

  // Text the pass link alongside the email.
  //
  // ADDITIVE, not a replacement (smsMessageTypes.replacesEmail = false): an SMS
  // cannot carry the scannable QR image itself, only a link to the page holding
  // it — so the email remains the thing that actually contains the pass.
  //
  // This is the ONE place the qr_ticket type fires. The RSVP confirmation already
  // includes the pass link on first submission, so sending qr_ticket there too
  // would put two texts on the guest's phone and charge the organizer twice for
  // one event. Here the organizer has explicitly asked to re-send the pass, which
  // is exactly when a guest wants it on their phone rather than buried in mail.
  //
  // Fire-and-forget: a texting problem must never fail the email that carries the
  // actual pass. Every gate (add-on purchased, type enabled, guest consented, not
  // opted out, balance available) is enforced inside sendTransactionalSms.
  try {
    const { sendTransactionalSms } = require('./smsDispatch');
    sendTransactionalSms({
      type: 'qr_ticket',
      eventId,
      partyId,
      // Not keyed on partyId alone: a resend is a deliberate repeat, and the
      // (kind, ref) idempotency guard would otherwise refuse every one after the
      // first as a duplicate.
      ref: `qr:${partyId}:${Date.now()}`,
      context: { guestName: party.label, eventTitle: event.title, ticketUrl: links.ticketUrl },
    }).catch((err) => logger.warn({ err, partyId }, 'entry-pass SMS failed (email still sent)'));
  } catch (err) {
    logger.warn({ err, partyId }, 'entry-pass SMS dispatch threw (email still sent)');
  }

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

module.exports = {
  logInvitation,
  resolveLiveEvent,
  sendEmailInvite,
  sendEmailBulk,
  sendQrTicketEmail,
};
