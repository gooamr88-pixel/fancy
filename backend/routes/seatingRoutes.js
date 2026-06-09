const express = require('express');
const { assignSeat, reassignSeat, unassignSeat } = require('../controllers/seatingController');

const router = express.Router({ mergeParams: true });

// Route to assign a guest party to a table
router.post('/assign', assignSeat);

// Route to reassign a guest party to a different table
router.post('/reassign', reassignSeat);

// Route to unassign a guest from their table
router.post('/unassign', unassignSeat);

module.exports = router;
