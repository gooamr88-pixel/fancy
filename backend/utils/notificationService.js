const { supabase } = require('../config/supabase');
const logger = require('./logger');
const { generateTicketToken } = require('./qrHelper');
const { generateRsvpToken } = require('./rsvpToken');
const { getRSVPConfirmationTemplate, getQRTicketTemplate, getInvitationTemplate } = require('./emailTemplates');

/** Resolves the public frontend origin (FRONTEND_URL may be a comma-separated allowlist). */
const getFrontendBase = () =>
  (process.env.FRONTEND_URL || 'https://fancyrsvp.com').split(',')[0].trim().replace(/\/$/, '');

/**
 * Sends a transactional email using Brevo's HTTP SMTP API.
 */
const sendEmailViaBrevo = async (to, subject, htmlContent) => {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.BREVO_FROM_EMAIL || 'noreply@fancyrsvp.com';
  const fromName = process.env.BREVO_FROM_NAME || 'Fancy RSVP';

  if (!apiKey) {
    logger.info(`[MOCK BREVO EMAIL] To: ${to} | Subject: ${subject}`);
    return true;
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: fromName, email: fromEmail },
        to: [{ email: to }],
        subject: subject,
        htmlContent: htmlContent
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Brevo API error: ${response.status} - ${errorText}`);
    }

    return true;
  } catch (err) {
    logger.error({ err }, 'Brevo email delivery failure');
    return false;
  }
};

/**
 * Sends/resends RSVP confirmation email.
 * Internal service method that does not depend on req/res.
 */
const sendConfirmationEmail = async (eventId, rsvpId) => {
  if (!rsvpId) {
    throw new Error('rsvpId is required.');
  }

  // Fetch RSVP details and event title
  const { data: rsvp, error: rsvpError } = await supabase
    .from('rsvps')
    .select('*, events(title, event_date)')
    .eq('id', rsvpId)
    .eq('event_id', eventId)
    .single();

  if (rsvpError || !rsvp) {
    throw new Error('RSVP_NOT_FOUND');
  }

  if (!rsvp.email) {
    logger.info(`[Notification Service] Guest ${rsvp.guest_name} has no email configured. Skipping confirmation email.`);
    return false;
  }

  const emailHtml = getRSVPConfirmationTemplate(rsvp, rsvp.events);
  const success = await sendEmailViaBrevo(rsvp.email, `RSVP Confirmed: ${rsvp.events.title}`, emailHtml);

  if (success) {
    await supabase.from('rsvps').update({ confirmation_email_sent: true }).eq('id', rsvpId);
  }

  return success;
};

/** Resolves the public backend origin (for hosted QR images in emails). */
const getBackendBase = () => {
  // Prefer an explicit env var; fall back to a sensible prod/dev default.
  if (process.env.BACKEND_URL) return process.env.BACKEND_URL.replace(/\/$/, '');
  const port = process.env.PORT || 5000;
  return `http://localhost:${port}`;
};

/**
 * Generates and sends QR code ticket.
 * Internal service method that does not depend on req/res.
 */
const sendQRTicketEmail = async (eventId, rsvpId) => {
  if (!rsvpId) {
    throw new Error('rsvpId is required.');
  }

  // 1. Fetch assignment details
  const { data: assignment, error: assignError } = await supabase
    .from('seating_assignments')
    .select('*, tables(table_name), rsvps(*), events(id, title, event_date)')
    .eq('rsvp_id', rsvpId)
    .eq('event_id', eventId)
    .single();

  if (assignError || !assignment) {
    throw new Error('NO_SEATING_ASSIGNMENT');
  }

  // 2. Generate signed token
  const token = generateTicketToken({
    guest_id: rsvpId,
    event_id: eventId,
    assignment_id: assignment.id,
    table_name: assignment.tables.table_name,
    party_size: assignment.rsvps.party_size,
    event_date: assignment.events.event_date
  });

  // 3. Build a hosted QR image URL instead of a data URI.
  //    Email clients (Gmail, Outlook, Yahoo) block data:image/… URIs for security.
  //    The public GET /api/v1/public/qr/:token.png endpoint generates the PNG on
  //    the fly from the same signed JWT, so the image is always reachable.
  const qrImageUrl = `${getBackendBase()}/api/v1/public/qr/${encodeURIComponent(token)}.png`;

  // 4. Send email containing QR
  const emailHtml = getQRTicketTemplate(assignment.rsvps, assignment.events, assignment.tables.table_name, qrImageUrl);

  if (!assignment.rsvps.email) {
    logger.info(`[Notification Service] Guest ${assignment.rsvps.guest_name} has no email configured. Skipping QR Ticket email.`);
    return false;
  }

  const success = await sendEmailViaBrevo(
    assignment.rsvps.email,
    `Your Ticket & Table Assignment: ${assignment.events.title}`,
    emailHtml
  );

  if (success) {
    await supabase.from('rsvps').update({ qr_email_sent: true }).eq('id', rsvpId);
    await supabase.from('activity_logs').insert({
      event_id: eventId,
      action: 'qr_email_sent',
      entity_type: 'rsvp',
      entity_id: rsvpId,
      metadata: { guest_name: assignment.rsvps.guest_name, email: assignment.rsvps.email }
    });
  }

  return success;
};

/**
 * Sends the guest invitation email with one-click Accept / Decline / Maybe
 * buttons. Each button is a signed, per-guest link to the frontend RSVP
 * confirmation page. Marks the RSVP as invited on success.
 * Internal service method that does not depend on req/res.
 *
 * Returns { sent: boolean, reason?: string } so the bulk caller can aggregate.
 */
const sendInvitationEmail = async (eventId, rsvpId) => {
  if (!rsvpId) throw new Error('rsvpId is required.');

  const { data: rsvp, error: rsvpError } = await supabase
    .from('rsvps')
    .select('id, guest_name, email, events(id, title, event_date, slug, location_name, location_address, is_paid, status)')
    .eq('id', rsvpId)
    .eq('event_id', eventId)
    .single();

  if (rsvpError || !rsvp) throw new Error('RSVP_NOT_FOUND');

  const event = rsvp.events;
  if (!event) throw new Error('EVENT_NOT_FOUND');

  // Invitations are only useful once the event page is live — the RSVP links
  // resolve against status = 'active'. Refuse early so the organizer gets a
  // clear reason instead of guests landing on a dead link.
  if (!event.is_paid || event.status !== 'active') {
    return { sent: false, reason: 'EVENT_NOT_LIVE' };
  }

  if (!rsvp.email) {
    return { sent: false, reason: 'NO_EMAIL' };
  }

  const base = getFrontendBase();
  const link = (response) => {
    const token = generateRsvpToken({ rsvpId: rsvp.id, eventId: event.id, response });
    return `${base}/rsvp?token=${encodeURIComponent(token)}`;
  };

  const links = {
    accept: link('accepted'),
    decline: link('declined'),
    maybe: link('maybe'),
    manage: link(undefined),
  };

  const html = getInvitationTemplate(rsvp, event, links);
  const success = await sendEmailViaBrevo(rsvp.email, `You're Invited: ${event.title}`, html);

  if (!success) return { sent: false, reason: 'DELIVERY_FAILED' };

  await supabase
    .from('rsvps')
    .update({ invitation_sent: true, invitation_sent_at: new Date() })
    .eq('id', rsvp.id);

  await supabase.from('activity_logs').insert({
    event_id: event.id,
    action: 'invitation_email_sent',
    entity_type: 'rsvp',
    entity_id: rsvp.id,
    metadata: { guest_name: rsvp.guest_name, email: rsvp.email }
  }).then(() => {}).catch(() => {});

  return { sent: true };
};

module.exports = {
  sendEmailViaBrevo,
  sendConfirmationEmail,
  sendQRTicketEmail,
  sendInvitationEmail
};
