const express = require('express');
const { verifyEventOwner } = require('../middleware/auth');
const { createEvent, getEvent, updateEvent, getEventStats } = require('../controllers/eventController');

const router = express.Router();

// Create a new event (starts as draft)
router.post('/', createEvent);

// Fetch event details
router.get('/:eventId', verifyEventOwner, getEvent);

// Update event settings
router.patch('/:eventId', verifyEventOwner, updateEvent);

// Fetch event dashboard metrics
router.get('/:eventId/stats', verifyEventOwner, getEventStats);

module.exports = router;
