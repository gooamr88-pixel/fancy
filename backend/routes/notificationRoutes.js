const express = require('express');
const { sendConfirmationEmail, sendQRTicketEmail } = require('../controllers/notificationController');

const router = express.Router({ mergeParams: true });

// Route to send/resend RSVP confirmation email
router.post('/send-confirmation', sendConfirmationEmail);

// Route to send QR ticket email (Only after seating assignment)
router.post('/send-qr-ticket', sendQRTicketEmail);

module.exports = router;
