const notificationService = require('../utils/notificationService');
const invitationService = require('../services/invitationService');

/**
 * Sends/resends a single party's RSVP confirmation email (the organizer's
 * per-row "resend confirmation" action — bulk invitation sending lives in
 * invitationController.js).
 * POST /api/v1/events/:eventId/notifications/send-confirmation
 */
const sendConfirmationEmail = async (req, res, next) => {
  const { eventId } = req.params;
  const { rsvpId: partyId } = req.body;

  if (!partyId) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'rsvpId is required.' });
  }

  try {
    const success = await notificationService.sendConfirmationEmail(eventId, partyId);
    return res.json({ success, message: success ? 'Confirmation email sent.' : 'This party has no email on file.' });
  } catch (err) {
    if (err.message === 'RSVP_NOT_FOUND') {
      return res.status(404).json({ success: false, error: 'RSVP_NOT_FOUND', message: 'RSVP not found.' });
    }
    // Same refusal, same wording shape as the entry-pass route below: a declined
    // guest is not a failure to retry, it is a guest who should not be sent this.
    if (err.message === 'NOT_ATTENDING') {
      return res.status(400).json({
        success: false,
        error: 'NOT_ATTENDING',
        message: 'This guest has not accepted — a confirmation would tell them their place is booked. Change their response to attending first.',
      });
    }
    next(err);
  }
};

/**
 * Sends/resends a single party's QR check-in pass. No seating assignment
 * required — see invitationService.sendQrTicketEmail for why the old
 * NO_SEATING_ASSIGNMENT gate was wrong.
 * POST /api/v1/events/:eventId/notifications/send-qr-ticket
 */
const sendQRTicketEmail = async (req, res, next) => {
  const { eventId } = req.params;
  const { rsvpId: partyId } = req.body;

  if (!partyId) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'rsvpId is required.' });
  }

  try {
    const result = await invitationService.sendQrTicketEmail(eventId, partyId);
    return res.json({ success: result.sent, message: result.sent ? 'QR ticket email sent.' : 'This party has no email on file.' });
  } catch (err) {
    if (err.message === 'PARTY_NOT_FOUND') {
      return res.status(404).json({ success: false, error: 'RSVP_NOT_FOUND', message: 'RSVP not found.' });
    }
    if (err.message === 'NOT_ATTENDING') {
      return res.status(400).json({
        success: false,
        error: 'NOT_ATTENDING',
        message: 'This guest declined — an entry pass would let them through the door. Change their response to attending first.',
      });
    }
    next(err);
  }
};

module.exports = {
  sendConfirmationEmail,
  sendQRTicketEmail,
};
