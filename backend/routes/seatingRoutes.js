const express = require('express');
const { assignSeat, reassignSeat, unassignSeat, saveSeatingBatch, getSeatingGuests, getSeatingSummary } = require('../controllers/seatingController');

const router = express.Router({ mergeParams: true });

// Paginated + searchable attending-guest list for the seating panel
router.get('/guests', getSeatingGuests);

// Aggregate seating summary counts
router.get('/summary', getSeatingSummary);

// Route to assign a guest party to a table
router.post('/assign', assignSeat);

// Route to reassign a guest party to a different table
router.post('/reassign', reassignSeat);

// Route to unassign a guest from their table
router.post('/unassign', unassignSeat);

// Route to batch save seating assignments
router.post('/save-batch', saveSeatingBatch);

module.exports = router;
