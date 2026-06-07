const twilio = require('twilio');
const { supabase } = require('../config/supabase');
const { generateTicketToken, generateQRCodeDataURL } = require('../utils/qrHelper');
const { getRSVPConfirmationTemplate, getQRTicketTemplate } = require('../utils/emailTemplates');

// Initialize Twilio client (lazy loader to prevent crash if env vars are missing)
let twilioClient;
const getTwilioClient = () => {
  if (!twilioClient) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (sid && token) {
      twilioClient = twilio(sid, token);
    }
  }
  return twilioClient;
};

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
 * Reusable helper to send a QR ticket email.
 */
const sendQRTicketEmailHelper = async (eventId, rsvpId) => {
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
    party_size: assignment.rsvps.party_size
  });

  // 3. Convert token to QR base64 image
  const qrDataURL = await generateQRCodeDataURL(token);

  // 4. Send email containing QR
  const emailHtml = getQRTicketTemplate(assignment.rsvps, assignment.events, assignment.tables.table_name, qrDataURL);

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

/**
 * Sends/resends RSVP confirmation email.
 * POST /api/v1/events/:eventId/notifications/send-confirmation
 */
const sendConfirmationEmail = async (req, res, next) => {
  const { eventId } = req.params;
  const { rsvpId } = req.body;

  if (!rsvpId) {
    return res.status(400).json({ success: false, error: 'rsvpId is required.' });
  }

  try {
    // Fetch RSVP details and event title
    const { data: rsvp, error: rsvpError } = await supabase
      .from('rsvps')
      .select('*, events(title, event_date)')
      .eq('id', rsvpId)
      .eq('event_id', eventId)
      .single();

    if (rsvpError || !rsvp) {
      return res.status(404).json({ success: false, error: 'RSVP_NOT_FOUND', message: 'RSVP not found.' });
    }

    const emailHtml = getRSVPConfirmationTemplate(rsvp, rsvp.events);

    const success = await sendEmailViaBrevo(rsvp.email, `RSVP Confirmed: ${rsvp.events.title}`, emailHtml);

    if (success) {
      await supabase.from('rsvps').update({ confirmation_email_sent: true }).eq('id', rsvpId);
    }

    return res.json({ success, message: success ? 'Confirmation email sent.' : 'Failed to send email.' });
  } catch (err) {
    next(err);
  }
};

/**
 * Generates and sends QR code ticket ONLY after seating assignment.
 * POST /api/v1/events/:eventId/notifications/send-qr-ticket
 */
const sendQRTicketEmail = async (req, res, next) => {
  const { eventId } = req.params;
  const { rsvpId } = req.body;

  if (!rsvpId) {
    return res.status(400).json({ success: false, error: 'rsvpId is required.' });
  }

  try {
    const success = await sendQRTicketEmailHelper(eventId, rsvpId);
    return res.json({ success, message: success ? 'QR ticket email sent.' : 'Failed to send QR ticket email.' });
  } catch (err) {
    if (err.message === 'NO_SEATING_ASSIGNMENT') {
      return res.status(400).json({
        success: false,
        error: 'NO_SEATING_ASSIGNMENT',
        message: 'QR tickets cannot be generated until the organizer assigns a seat/table.'
      });
    }
    next(err);
  }
};

/**
 * Sends prepaid SMS invitations, checking credit wallets atomically (deduct first, send second).
 * POST /api/v1/events/:eventId/notifications/send-sms
 */
const sendSMSInvitation = async (req, res, next) => {
  const { eventId } = req.params;
  const { rsvpId, phoneNumber, messageTemplate } = req.body;

  if (!rsvpId || !phoneNumber || !messageTemplate) {
    return res.status(400).json({ success: false, error: 'rsvpId, phoneNumber, and messageTemplate are required.' });
  }

  // 1. Prepare message body (Append platform branding)
  let brandedBody = messageTemplate;
  const branding = " — Fancy RSVP";
  if (!brandedBody.endsWith(branding)) {
    brandedBody = `${brandedBody}${branding}`;
  }

  const twilio = getTwilioClient();

  try {
    // 2. Deduct credit atomically first
    const { data: deductResult, error: deductError } = await supabase.rpc('deduct_sms_credit_atomic', {
      p_event_id: eventId,
      p_phone: phoneNumber
    });

    if (deductError || !deductResult || !deductResult.success) {
      return res.status(402).json({
        success: false,
        error: deductResult?.error || 'INSUFFICIENT_CREDITS',
        message: 'Insufficient SMS credits or no credit wallet found.'
      });
    }

    const { wallet_id, ledger_id } = deductResult;

    if (!twilio) {
      // Mock mode: update ledger to denote simulated send success
      console.log(`[MOCK SMS] To: ${phoneNumber} | Content: ${brandedBody}`);
      
      const mockSid = `mock-sid-${Date.now()}-${rsvpId}`;
      await supabase
        .from('sms_credit_ledger')
        .update({ sms_sid: mockSid })
        .eq('id', ledger_id);

      return res.json({
        success: true,
        messageSid: mockSid,
        mocked: true,
        message: 'Twilio not configured. Mocked SMS delivery.'
      });
    }

    // 3. Dispatch SMS via Twilio
    try {
      const twilioMessage = await twilio.messages.create({
        body: brandedBody,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber
      });

      // 4. Update ledger record with twilio message sid
      await supabase
        .from('sms_credit_ledger')
        .update({ sms_sid: twilioMessage.sid })
        .eq('id', ledger_id);

      return res.json({
        success: true,
        messageSid: twilioMessage.sid
      });
    } catch (sendErr) {
      // 5. Refund credits on transmission failure
      console.error(`SMS send transmission failure, initiating refund: ${sendErr.message}`);
      await supabase.rpc('refund_sms_credit_atomic', {
        p_wallet_id: wallet_id,
        p_event_id: eventId,
        p_ledger_id: ledger_id
      });

      return res.status(500).json({
        success: false,
        error: 'SMS_TRANSMISSION_FAILED',
        message: `Failed to deliver SMS: ${sendErr.message}`
      });
    }
  } catch (err) {
    next(err);
  }
};

module.exports = {
  sendConfirmationEmail,
  sendQRTicketEmail,
  sendSMSInvitation,
  sendEmailViaBrevo,
  sendQRTicketEmailHelper
};
