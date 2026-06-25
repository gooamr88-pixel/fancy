const express = require('express');
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const { sendBulkSMSCampaign, getCampaignStatus, getCampaignHistory } = require('../controllers/campaignController');
const { requirePaidEvent } = require('../middleware/featureGate');

const router = express.Router({ mergeParams: true });

// Launch a bulk SMS campaign (sync for small lists, async-enqueued for large ones).
router.post('/send-sms', requirePaidEvent('sms_campaigns'), [
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
  validate,
], sendBulkSMSCampaign);

// Poll an async campaign's live status/progress.
router.get('/status/:campaignId', [
  param('campaignId').isUUID().withMessage('Valid campaignId is required.'),
  validate,
], getCampaignStatus);

// Wallet + recent campaigns + transaction ledger.
router.get('/history', getCampaignHistory);

module.exports = router;
