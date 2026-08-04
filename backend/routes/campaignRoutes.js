const express = require('express');
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const { sendBulkSMSCampaign, getCampaignStatus, getCampaignHistory, getSmsSettings, updateSmsSettings, getSmsLog, getTopUpQuote, resendSmsMessage } = require('../controllers/campaignController');
const { requireSmsAddon, requireSendLimit } = require('../middleware/smsAddonGate');

const router = express.Router({ mergeParams: true });

// Launch a bulk SMS campaign (sync for small lists, async-enqueued for large ones).
// Gated on the purchased SMS add-on rather than the pricing tier: SMS is sold per
// event to any plan. The identical gate guards the invitations route's sms channel,
// which forwards here — see middleware/smsAddonGate.js.
// requireSendLimit is the anti-abuse ramp-up. It runs AFTER the add-on gate (which
// loads the event) and only bounds an EXPLICIT recipient list — an audience has no
// knowable size until it is resolved, so the same cap is applied inside the
// controller once the recipient count exists.
router.post('/send-sms', requireSmsAddon, requireSendLimit, [
  body('messageTemplate').isString().trim().notEmpty().withMessage('messageTemplate is required.')
    .isLength({ max: 1600 }).withMessage('messageTemplate exceeds the 1600-character limit.'),
  body('audience').optional().isIn(['pending', 'attending', 'maybe', 'declined', 'all'])
    .withMessage('Invalid audience.'),
  body('audiences').optional().isArray({ max: 5 }).withMessage('audiences must be an array.'),
  body('audiences.*').optional().isIn(['pending', 'attending', 'maybe', 'declined', 'all'])
    .withMessage('Invalid audience segment.'),
  body('guestIds').optional().isArray({ max: 20000 }).withMessage('guestIds must be an array.'),
  body('guestIds.*').optional().isUUID().withMessage('Each guestId must be a valid UUID.'),
  body('clientToken').optional().isString().isLength({ max: 80 }).withMessage('clientToken too long.'),
  body('async').optional().isBoolean().withMessage('async must be a boolean.'),
  // Terms §5 consent attestation — must be boolean true; enforced in the controller.
  body('consentAttested').optional().isBoolean().withMessage('consentAttested must be a boolean.'),
  validate,
], sendBulkSMSCampaign);

// Poll an async campaign's live status/progress.
router.get('/status/:campaignId', [
  param('campaignId').isUUID().withMessage('Valid campaignId is required.'),
  validate,
], getCampaignStatus);

// Wallet + recent campaigns + transaction ledger.
router.get('/history', getCampaignHistory);

// Add-on status, per-message-type switches, allowance, and skip totals.
// Ungated on purpose: an event WITHOUT the add-on is precisely the one that needs
// to read this screen and be offered the purchase.
router.get('/settings', getSmsSettings);
router.patch('/settings', [
  body('settings').isObject().withMessage('settings must be an object.'),
  validate,
], updateSmsSettings);

// Per-message send log, including skips and their reasons in plain language.
router.get('/log', getSmsLog);

// Price a top-up before the organizer commits — never let them meet the price
// for the first time on Stripe's page.
router.get('/topup-quote', getTopUpQuote);

// Retry ONE failed message. Gated on the add-on (it spends balance) but not on
// the ramp-up: a single retry is not a bulk send.
router.post('/resend/:logId', requireSmsAddon, [
  param('logId').isUUID().withMessage('A valid message id is required.'),
  validate,
], resendSmsMessage);

module.exports = router;
