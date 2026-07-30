const express = require('express');
const checkinController = require('../controllers/checkinController');
const { requireFeature, requireAnyFeature } = require('../middleware/featureGate');

const router = express.Router({ mergeParams: true });

// Route to check-in guest via QR ticket scan — paid feature
router.post('/scan', requireFeature('qr_checkin'), checkinController.scanCheckIn);

// Route to manually check-in guest by RSVP ID — paid feature
router.post('/manual', requireFeature('manual_checkin'), checkinController.manualCheckIn);

// Route to query guests (autocomplete list) for manual check-in search (ungated helper)
router.get('/search', checkinController.searchGuests);

// Route to undo/reverse a guest check-in.
// Gated: reversing an arrival is a privileged correction, not a read helper. It
// was previously ungated AND hard-deleting, so anyone holding an organizer
// session could erase arrival evidence without trace (finding R-1). It now
// soft-deletes with a mandatory reason and an audit row, and requires the same
// entitlement as performing a check-in in the first place.
router.post('/undo', requireAnyFeature('qr_checkin', 'manual_checkin'), checkinController.undoCheckIn);

module.exports = router;
