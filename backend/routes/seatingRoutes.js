const express = require('express');
const { assignSeat, reassignSeat } = require('../controllers/seatingController');

const router = express.Router({ mergeParams: true });

// Route to assign a guest party to a table
router.post('/assign', assignSeat);

// Route to reassign a guest party to a different table
router.post('/reassign', reassignSeat);

module.exports = router;
