const { supabase } = require('../config/supabase');
const { generateTicketToken, generateQRCodeDataURL } = require('./qrHelper');
const { getRSVPConfirmationTemplate, getQRTicketTemplate } = require('./emailTemplates');

/**
 * Sends a transactional email using Brevo's HTTP SMTP API.
 */
const sendEmailViaBrevo = async (to, subject, htmlContent) => {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.BREVO_FROM_EMAIL || 'noreply@fancyrsvp.com';
  const fromName = process.env.BREVO_FROM_NAME || 'Fancy RSVP';

  if (!apiKey) {
    console.log(`[MOCK BREVO EMAIL] To: ${to} | Subject: ${subject}`);
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
    console.error('Brevo email delivery failure:', err);
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
    console.log(`[Notification Service] Guest ${rsvp.guest_name} has no email configured. Skipping confirmation email.`);
    return false;
  }

  const emailHtml = getRSVPConfirmationTemplate(rsvp, rsvp.events);
  const success = await sendEmailViaBrevo(rsvp.email, `RSVP Confirmed: ${rsvp.events.title}`, emailHtml);

  if (success) {
    await supabase.from('rsvps').update({ confirmation_email_sent: true }).eq('id', rsvpId);
  }

  return success;
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
    .select('*, tables(table_name), rsvps(*), events(title, event_date)')
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

  // 3. Convert token to QR base64 image
  const qrDataURL = await generateQRCodeDataURL(token);

  // 4. Send email containing QR
  const emailHtml = getQRTicketTemplate(assignment.rsvps, assignment.events, assignment.tables.table_name, qrDataURL);

  if (!assignment.rsvps.email) {
    console.log(`[Notification Service] Guest ${assignment.rsvps.guest_name} has no email configured. Skipping QR Ticket email.`);
    return false;
  }

  const success = await sendEmailViaBrevo(
    assignment.rsvps.email,
    `Your Ticket & Table Assignment: ${assignment.events.title}`,
    emailHtml
  );

  if (success) {
    await supabase.from('rsvps').update({ qr_email_sent: true }).eq('id', rsvpId);
  }

  return success;
};

module.exports = {
  sendEmailViaBrevo,
  sendConfirmationEmail,
  sendQRTicketEmail
};
