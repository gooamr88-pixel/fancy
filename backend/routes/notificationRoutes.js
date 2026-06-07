const express = require('express');
const { sendConfirmationEmail, sendQRTicketEmail, sendSMSInvitation } = require('../controllers/notificationController');

const router = express.Router({ mergeParams: true });

// Route to send/resend RSVP confirmation email
router.post('/send-confirmation', sendConfirmationEmail);

// Route to send QR ticket email (Only after seating assignment)
router.post('/send-qr-ticket', sendQRTicketEmail);

// Route to send prepaid SMS invitation
router.post('/send-sms', sendSMSInvitation);

module.exports = router;
