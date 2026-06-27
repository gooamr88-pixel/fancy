const { supabase } = require('../config/supabase');
const logger = require('./logger');
const { getRSVPConfirmationTemplate } = require('./emailTemplates');

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
 * Sends/resends the post-RSVP confirmation email for a party. Invitation
 * delivery (3-button email, QR ticket) lives in services/invitationService.js
 * and is tracked in the `invitations` ledger; this is a one-off transactional
 * acknowledgement of the guest's own response, not an outbound invitation, so
 * it isn't tracked there.
 */
const sendConfirmationEmail = async (eventId, partyId) => {
  if (!partyId) {
    throw new Error('partyId is required.');
  }

  const { data: party, error } = await supabase
    .from('rsvp_parties')
    .select('id, label, guests(is_primary_contact, email), events(title, event_date)')
    .eq('id', partyId)
    .eq('event_id', eventId)
    .single();

  if (error || !party) {
    throw new Error('RSVP_NOT_FOUND');
  }

  const primaryEmail = (party.guests || []).find((g) => g.is_primary_contact)?.email || null;
  if (!primaryEmail) {
    logger.info(`[Notification Service] Party ${party.label} has no email configured. Skipping confirmation email.`);
    return false;
  }

  const partySize = (party.guests || []).length || 1;
  const shimParty = { id: party.id, guest_name: party.label, email: primaryEmail, party_size: partySize };
  const emailHtml = getRSVPConfirmationTemplate(shimParty, party.events);

  return sendEmailViaBrevo(primaryEmail, `RSVP Confirmed: ${party.events.title}`, emailHtml);
};

module.exports = {
  sendEmailViaBrevo,
  sendConfirmationEmail,
};
