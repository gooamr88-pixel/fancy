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
const { getInvitationTemplate, getQRTicketTemplate, buildGuestEventUrl } = require('../utils/emailTemplates');
const { getPublicBaseUrl } = require('../utils/publicUrl');

const BACKEND_BASE = () =>
  process.env.BACKEND_URL ? process.env.BACKEND_URL.replace(/\/$/, '') : `http://localhost:${process.env.PORT || 5000}`;

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

/** Sends the QR check-in ticket + table assignment email for one seated party. */
async function sendQrTicketEmail(eventId, partyId) {
  const { data: assignment, error } = await supabase
    .from('seating_assignments')
    .select(`
      id, table_id,
      tables(table_name),
      rsvp_parties(id, label, guests(is_primary_contact, email)),
      events(id, title, event_date, location_name, location_address)
    `)
    .eq('party_id', partyId)
    .eq('event_id', eventId)
    .single();

  if (error || !assignment) throw new Error('NO_SEATING_ASSIGNMENT');

  const party = assignment.rsvp_parties;
  const primaryEmail = (party.guests || []).find((g) => g.is_primary_contact)?.email || null;
  const partySize = (party.guests || []).length || 1;
  const event = assignment.events;

  if (!primaryEmail) {
    logger.info(`[InvitationService] Party ${party.label} has no email configured. Skipping QR ticket email.`);
    return { sent: false, reason: 'NO_EMAIL' };
  }

  const token = tokenService.signQrTicket({
    partyId,
    eventId,
    tableName: assignment.tables.table_name,
    partySize,
    eventDate: event.event_date,
  });

  const qrImageUrl = `${BACKEND_BASE()}/api/v1/public/qr/${encodeURIComponent(token)}.png`;
  const ticketUrl = `${getPublicBaseUrl()}/ticket/${encodeURIComponent(token)}`;
  const shimParty = { id: party.id, guest_name: party.label, email: primaryEmail, party_size: partySize };
  // The data model has no table→zone relationship (zones are standalone venue
  // elements in the same `tables` table, not a parent of seatable tables), so a
  // ticket carries no zone label.
  const html = getQRTicketTemplate(shimParty, event, assignment.tables.table_name, qrImageUrl, null, ticketUrl);

  const success = await notificationService.sendEmailViaBrevo(primaryEmail, `Your Ticket & Table Assignment: ${event.title}`, html);
  await logInvitation({
    partyId, eventId, channel: 'qr', token, status: success ? 'sent' : 'failed',
    metadata: { tableName: assignment.tables.table_name },
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
