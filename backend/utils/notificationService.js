const { supabase } = require('../config/supabase');
const logger = require('./logger');
const { getRSVPConfirmationTemplate, buildTicketLinks } = require('./emailTemplates');
const tokenService = require('../services/tokenService');

/**
 * Sends a transactional email using Brevo's HTTP SMTP API.
 */
const sendEmailViaBrevo = async (to, subject, htmlContent) => {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.BREVO_FROM_EMAIL || 'info@fancyrsvp.com';
  const fromName = process.env.BREVO_FROM_NAME || 'Fancy RSVP';

  if (!apiKey) {
    // Silently mocking every email is right for local dev and catastrophic in
    // production (guests get nothing, nothing looks broken) — warn, not info,
    // so it survives a production log level and is greppable.
    logger.warn(`[MOCK BREVO EMAIL — BREVO_API_KEY not set, nothing was delivered] To: ${to} | Subject: ${subject}`);
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
const sendConfirmationEmail = async (eventId, partyId, lang = 'en') => {
  if (!partyId) {
    throw new Error('partyId is required.');
  }

  // `response` is read from the party row (not passed in) so the resend
  // endpoint and the live submit path always describe the SAME response —
  // omitting it made every confirmation render "Response: Pending", since
  // responseMeta() falls back to Pending for an undefined value.
  const { data: party, error } = await supabase
    .from('rsvp_parties')
    .select('id, label, response, guests(is_primary_contact, email), events(title, event_date)')
    .eq('id', partyId)
    .eq('event_id', eventId)
    .single();

  if (error || !party) {
    throw new Error('RSVP_NOT_FOUND');
  }

  const primaryEmail = (party.guests || []).find((g) => g.is_primary_contact)?.email || null;
  if (!primaryEmail) {
    // warn, not info: a guest who answered and got nothing back is a defect to
    // investigate, and this is the only trace of it.
    logger.warn({ partyId, eventId, label: party.label }, 'Confirmation email skipped — party has no primary-contact email on file');
    return false;
  }

  const partySize = (party.guests || []).length || 1;
  const shimParty = { id: party.id, guest_name: party.label, email: primaryEmail, party_size: partySize, response: party.response };

  // The check-in pass rides along with the confirmation for a confirmed "yes".
  // Previously this email only PROMISED a pass "once seating is finalized", so
  // an organizer who never built a seating chart left every guest with nothing
  // to show at the door. signQrTicketForResponse returns null for maybe/no and
  // swallows its own errors, so a signing hiccup degrades this back to the old
  // wording rather than failing the confirmation.
  const qrToken = tokenService.signQrTicketForResponse({
    response: party.response,
    partyId,
    eventId,
    tableName: null,
    partySize,
    eventDate: party.events.event_date,
  });
  const emailHtml = getRSVPConfirmationTemplate(shimParty, party.events, lang, qrToken ? buildTicketLinks(qrToken) : null);
  // Subject line follows the guest's language too — a mail whose subject and
  // body disagree reads like a phishing attempt.
  const isMaybe = party.response === 'maybe';
  const isAr = String(lang || '').toLowerCase().startsWith('ar');
  const subject = isAr
    ? `${isMaybe ? 'تم استلام ردّك' : 'تم تأكيد حضورك'}: ${party.events.title}`
    : `${isMaybe ? 'RSVP Received' : 'RSVP Confirmed'}: ${party.events.title}`;

  return sendEmailViaBrevo(primaryEmail, subject, emailHtml);
};

const sendCompanionConfirmationEmail = async ({
  companionName,
  mainGuestName,
  eventTitle,
  eventDate,
  eventSlug,
  companionEmail,
  lang = 'en',
}) => {
  const { getCompanionRSVPConfirmationTemplate, buildGuestEventUrl } = require('./emailTemplates');
  const eventUrl = buildGuestEventUrl(eventSlug);
  const emailHtml = getCompanionRSVPConfirmationTemplate(
    companionName,
    mainGuestName,
    { title: eventTitle, event_date: eventDate, slug: eventSlug },
    eventUrl,
    lang,
  );
  const subject = String(lang || '').toLowerCase().startsWith('ar')
    ? `تم تسجيلك في ${eventTitle}`
    : `You're registered for ${eventTitle}`;
  return sendEmailViaBrevo(companionEmail, subject, emailHtml);
};

module.exports = {
  sendEmailViaBrevo,
  sendConfirmationEmail,
  sendCompanionConfirmationEmail,
};
