const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { sendInvitations } = require('../controllers/invitationController');
const { requireSmsAddon } = require('../middleware/smsAddonGate');

const router = express.Router({ mergeParams: true });

/**
 * The SMS add-on gate, applied ONLY to `channel: 'sms'`.
 *
 * This endpoint serves three channels through one route, and email/qr must stay
 * reachable without the add-on — so the gate cannot be mounted on the route
 * wholesale. It is applied per-request instead.
 *
 * Without it, the sms branch forwarded straight to campaignController's dispatcher
 * while the equivalent /campaigns route was gated, giving any authenticated event
 * owner a way around the paywall entirely. Same middleware, same answer, both doors.
 */
const gateSmsChannel = (req, res, next) =>
  (req.body?.channel === 'sms' ? requireSmsAddon(req, res, next) : next());

// Unified invitation dispatch (email / sms / qr) — one endpoint, one response shape.
router.post('/send', [
  body('channel').isIn(['email', 'sms', 'qr']).withMessage('channel must be one of: email, sms, qr.'),
  validate,
], gateSmsChannel, sendInvitations);

module.exports = router;
