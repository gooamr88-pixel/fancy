const express = require('express');
const { sendBulkSMSCampaign, getCampaignHistory } = require('../controllers/campaignController');

const router = express.Router({ mergeParams: true });

// Route to trigger bulk SMS campaign dispatch
router.post('/send-sms', sendBulkSMSCampaign);

// Route to fetch SMS credit wallet and ledger logs history
router.get('/history', getCampaignHistory);

module.exports = router;
