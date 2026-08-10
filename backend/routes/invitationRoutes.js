const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { sendInvitations } = require('../controllers/invitationController');
const { requireSmsAddon, requireSendLimit } = require('../middleware/smsAddonGate');

const router = express.Router({ mergeParams: true });

/**
 * The SMS gates, applied ONLY to `channel: 'sms'`.
 *
 * This endpoint serves three channels through one route, and email/qr must stay
 * reachable without the add-on — so the gates cannot be mounted on the route
 * wholesale. They are applied per-request instead.
 *
 * This used to be the add-on gate alone, because the sms branch forwarded to the
 * campaign route, which carried the ramp-up cap of its own. That route is gone in
 * the four-type rebuild, so THIS is now the only bulk SMS door in the platform and
 * it has to carry both gates itself. Missing the second one would not fail — it
 * would just quietly stop capping how many messages a brand-new account can fire
 * in one request, which is the whole thing the ramp-up exists to prevent.
 *
 * Order matters: requireSmsAddon loads the event, and requireSendLimit reads it.
 */
/**
 * Every channel that costs money, in one place.
 *
 * `detail-sms` had to be added here as well as to the validator below, and
 * forgetting it would not have failed loudly: the send would simply have bypassed
 * the add-on entitlement check AND the new-account ramp-up cap, on a path that
 * bills per segment. A list rather than an equality test, so the next paid channel
 * cannot be added to the validator alone.
 */
const BILLED_CHANNELS = ['sms', 'detail-sms'];

const gateSmsChannel = (req, res, next) => {
  if (!BILLED_CHANNELS.includes(req.body?.channel)) return next();
  return requireSmsAddon(req, res, (err) => (err ? next(err) : requireSendLimit(req, res, next)));
};

// Unified dispatch (email / sms / qr / detail-sms) — one endpoint, one response shape.
router.post('/send', [
  body('channel').isIn(['email', 'sms', 'qr', 'detail-sms'])
    .withMessage('channel must be one of: email, sms, qr, detail-sms.'),
  body('partyIds').optional().isArray({ max: 5000 }).withMessage('partyIds must be an array of at most 5000 guests.'),
  body('partyIds.*').optional().isUUID().withMessage('Each guest id must be a valid UUID.'),
  body('resend').optional().isBoolean().withMessage('resend must be a boolean.'),
  validate,
], gateSmsChannel, sendInvitations);

module.exports = router;
