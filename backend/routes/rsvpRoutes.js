const express = require('express');
const rsvpController = require('../controllers/rsvpController');

const router = express.Router({ mergeParams: true });

// Route to fetch RSVP list for an event
router.get('/', rsvpController.getRSVPs);

// Route to manually add a guest (organizer)
router.post('/', rsvpController.addGuestManually);

// Route to import guests via CSV upload
router.post('/import', rsvpController.importGuestsCSV);

// Route to export guests to downloadable CSV stream
router.get('/export', rsvpController.exportGuestsCSV);

// Route to export guests to downloadable Excel stream
router.get('/export-excel', rsvpController.exportGuestsExcel);

// Route to update a single RSVP (organizer edit)
router.patch('/:rsvpId', rsvpController.updateRSVP);

// Route to delete a single RSVP
router.delete('/:rsvpId', rsvpController.deleteRSVP);

module.exports = router;
