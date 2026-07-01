const express = require('express');
const checkinController = require('../controllers/checkinController');
const { requireFeature } = require('../middleware/featureGate');

const router = express.Router({ mergeParams: true });

// Route to check-in guest via QR ticket scan — paid feature
router.post('/scan', requireFeature('qr_checkin'), checkinController.scanCheckIn);

// Route to manually check-in guest by RSVP ID — paid feature
router.post('/manual', requireFeature('manual_checkin'), checkinController.manualCheckIn);

// Route to query guests (autocomplete list) for manual check-in search (ungated helper)
router.get('/search', checkinController.searchGuests);

// Route to undo/reverse a guest check-in (ungated helper — relies on the check-in itself being gated)
router.post('/undo', checkinController.undoCheckIn);

module.exports = router;
