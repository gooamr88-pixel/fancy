const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { sendInvitations } = require('../controllers/invitationController');

const router = express.Router({ mergeParams: true });

// Unified invitation dispatch (email / sms / qr) — one endpoint, one response shape.
router.post('/send', [
  body('channel').isIn(['email', 'sms', 'qr']).withMessage('channel must be one of: email, sms, qr.'),
  validate,
], sendInvitations);

module.exports = router;
