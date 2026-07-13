const express = require('express');
const { getMyReferralOverview } = require('../controllers/referralController');
const router = express.Router();

// requireAuth is applied where this router is mounted (app.js).
router.get('/me', getMyReferralOverview);

module.exports = router;
