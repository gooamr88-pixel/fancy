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
    next(err);
  }
};

/**
 * Sends/resends a single party's QR check-in ticket email (requires an
 * existing seating assignment).
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

module.exports = {
  sendConfirmationEmail,
  sendQRTicketEmail,
};
