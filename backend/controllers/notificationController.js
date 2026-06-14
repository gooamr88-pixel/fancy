const { getTwilioClient, getTwilioFromNumber } = require('../utils/twilioClient');
const { supabase } = require('../config/supabase');
const notificationService = require('../utils/notificationService');

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
    const success = await notificationService.sendConfirmationEmail(eventId, rsvpId);
    return res.json({ success, message: success ? 'Confirmation email sent.' : 'Failed to send email.' });
  } catch (err) {
    if (err.message === 'RSVP_NOT_FOUND') {
      return res.status(404).json({ success: false, error: 'RSVP_NOT_FOUND', message: 'RSVP not found.' });
    }
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
    const success = await notificationService.sendQRTicketEmail(eventId, rsvpId);
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
        from: getTwilioFromNumber(),
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
  sendEmailViaBrevo: notificationService.sendEmailViaBrevo,
  sendQRTicketEmailHelper: notificationService.sendQRTicketEmail
};
