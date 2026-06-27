const express = require('express');
const rsvpController = require('../controllers/rsvpController');
const { requirePaidEvent } = require('../middleware/featureGate');

const router = express.Router({ mergeParams: true });

// UUID format validation for :partyId param
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
router.param('partyId', (req, res, next, value) => {
  if (!UUID_REGEX.test(value)) {
    return res.status(400).json({ success: false, error: 'INVALID_PARAM', message: 'partyId must be a valid UUID.' });
  }
  next();
});

// Route to fetch the party list for an event
router.get('/', rsvpController.getRSVPs);

// Route to manually add a guest (organizer)
router.post('/', requirePaidEvent('add_guest'), rsvpController.addGuestManually);

// Route to import guests via CSV upload
router.post('/import', requirePaidEvent('import_guests'), rsvpController.importGuestsCSV);

// Route to fetch aggregated RSVP statistics for the dashboard cards
router.get('/stats', rsvpController.getRsvpStats);

// Route to export guests to downloadable CSV stream
router.get('/export', rsvpController.exportGuestsCSV);

// Route to export guests to downloadable Excel stream
router.get('/export-excel', rsvpController.exportGuestsExcel);

// Route to update a single party (organizer edit)
router.patch('/:partyId', rsvpController.updateRSVP);

// Route to delete a single party
router.delete('/:partyId', rsvpController.deleteRSVP);

module.exports = router;
