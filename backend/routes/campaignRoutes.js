const express = require('express');
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const { getCampaignHistory, getSmsSettings, updateSmsSettings, getSmsLog, getTopUpQuote, resendSmsMessage, updateOrganizerSmsConsent } = require('../controllers/campaignController');
const { requireSmsAddon } = require('../middleware/smsAddonGate');

const router = express.Router({ mergeParams: true });

/**
 * POST /send-sms — the free-text campaign blaster — was removed here in the
 * four-type rebuild, and NOT replaced with an equivalent under this prefix.
 *
 * Texting the invitation lives on the unified invitation endpoint instead:
 *   POST /api/v1/events/:eventId/invitations/send  { channel: 'sms', partyIds }
 *
 * One door, three channels, one response shape. Adding a second SMS route here
 * would recreate exactly the split the unified endpoint exists to close — two
 * places to enforce consent, and one of them eventually falling behind.
 */

// Wallet + transaction ledger.
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

// The ORGANIZER's own opt-in to text alerts about their events. Ungated on the
// add-on: they may reasonably set their number before buying, and a consent
// record is never something to gate behind a purchase.
router.patch('/organizer-sms', [
  body('consent').isBoolean().withMessage('consent must be a boolean.'),
  body('phone').optional({ values: 'falsy' }).isString().isLength({ max: 30 }).withMessage('phone is too long.'),
  validate,
], updateOrganizerSmsConsent);

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
