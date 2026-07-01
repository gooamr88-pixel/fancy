const express = require('express');
const { assignSeat, reassignSeat, unassignSeat, saveSeatingBatch, getSeatingGuests, getSeatingSummary } = require('../controllers/seatingController');
const { requireFeature } = require('../middleware/featureGate');

const router = express.Router({ mergeParams: true });

// Paginated + searchable attending-guest list for the seating panel
router.get('/guests', getSeatingGuests);

// Aggregate seating summary counts
router.get('/summary', getSeatingSummary);

// Route to assign a guest party to a table
router.post('/assign', requireFeature('seating_map'), assignSeat);

// Route to reassign a guest party to a different table
router.post('/reassign', requireFeature('seating_map'), reassignSeat);

// Route to unassign a guest from their table
router.post('/unassign', requireFeature('seating_map'), unassignSeat);

// Route to batch save seating assignments
router.post('/save-batch', requireFeature('seating_map'), saveSeatingBatch);

module.exports = router;
