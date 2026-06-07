const express = require('express');
const { scanCheckIn, manualCheckIn, searchGuests } = require('../controllers/checkinController');

const router = express.Router({ mergeParams: true });

// Route to check-in guest via QR ticket scan
router.post('/scan', scanCheckIn);

// Route to manually check-in guest by RSVP ID
router.post('/manual', manualCheckIn);

// Route to query guests (autocomplete list) for manual check-in search
router.get('/search', searchGuests);

module.exports = router;
