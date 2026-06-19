const express = require('express');
const rsvpController = require('../controllers/rsvpController');

const router = express.Router({ mergeParams: true });

// UUID format validation for :rsvpId param
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
router.param('rsvpId', (req, res, next, value) => {
  if (!UUID_REGEX.test(value)) {
    return res.status(400).json({ success: false, error: 'INVALID_PARAM', message: 'rsvpId must be a valid UUID.' });
  }
  next();
});

// Route to fetch RSVP list for an event
router.get('/', rsvpController.getRSVPs);

// Route to manually add a guest (organizer)
router.post('/', rsvpController.addGuestManually);

// Route to import guests via CSV upload
router.post('/import', rsvpController.importGuestsCSV);

// Route to bulk-send email invitations (Accept/Decline/Maybe buttons)
router.post('/send-invitations', rsvpController.sendEmailInvitations);

// Route to fetch aggregated RSVP statistics for the dashboard cards
router.get('/stats', rsvpController.getRsvpStats);

// Route to export guests to downloadable CSV stream
router.get('/export', rsvpController.exportGuestsCSV);

// Route to export guests to downloadable Excel stream
router.get('/export-excel', rsvpController.exportGuestsExcel);

// Route to update a single RSVP (organizer edit)
router.patch('/:rsvpId', rsvpController.updateRSVP);

// Route to delete a single RSVP
router.delete('/:rsvpId', rsvpController.deleteRSVP);

module.exports = router;
