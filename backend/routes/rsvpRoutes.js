const express = require('express');
const rsvpController = require('../controllers/rsvpController');
const { requireFeature } = require('../middleware/featureGate');

const router = express.Router({ mergeParams: true });

// UUID format validation for :partyId param
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
router.param('partyId', (req, res, next, value) => {
  if (!UUID_REGEX.test(value)) {
    return res.status(400).json({ success: false, error: 'INVALID_PARAM', message: 'partyId must be a valid UUID.' });
  }
  next();
});

// Route to fetch the party list for an event (free — read-only, always allowed)
router.get('/', rsvpController.getRSVPs);

// Route to manually add a guest (organizer) — paid feature
router.post('/', requireFeature('add_guest_manual'), rsvpController.addGuestManually);

// Route to import guests via CSV upload — paid feature
router.post('/import', requireFeature('import_guests_csv'), rsvpController.importGuestsCSV);

// Route to fetch aggregated RSVP statistics for the dashboard cards (free)
router.get('/stats', rsvpController.getRsvpStats);

// Route to export guests to downloadable CSV stream — paid feature
router.get('/export', requireFeature('guest_export_csv'), rsvpController.exportGuestsCSV);

// Route to export guests to downloadable Excel stream — paid feature
router.get('/export-excel', requireFeature('guest_export_excel'), rsvpController.exportGuestsExcel);

// Route to update a single party (organizer edit — free, basic RSVP management)
router.patch('/:partyId', rsvpController.updateRSVP);

// Route to delete a single party (free — basic management)
router.delete('/:partyId', rsvpController.deleteRSVP);

module.exports = router;
