const express = require('express');
const checkinController = require('../controllers/checkinController');

const router = express.Router({ mergeParams: true });

// Route to check-in guest via QR ticket scan
router.post('/scan', checkinController.scanCheckIn);

// Route to manually check-in guest by RSVP ID
router.post('/manual', checkinController.manualCheckIn);

// Route to query guests (autocomplete list) for manual check-in search
router.get('/search', checkinController.searchGuests);

// Route to undo/reverse a guest check-in
router.post('/undo', checkinController.undoCheckIn);

module.exports = router;
