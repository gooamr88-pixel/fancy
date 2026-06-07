const express = require('express');
const { getRSVPs, importGuestsCSV, exportGuestsCSV } = require('../controllers/rsvpController');

const router = express.Router({ mergeParams: true });

// Route to fetch RSVP list for an event
router.get('/', getRSVPs);

// Route to import guests via CSV upload
router.post('/import', importGuestsCSV);

// Route to export guests to downloadable CSV stream
router.get('/export', exportGuestsCSV);

module.exports = router;
