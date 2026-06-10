const express = require('express');
const { requireAuth, verifyEventOwner } = require('../middleware/auth');
const { createEvent, getEvents, getEvent, updateEvent, getEventStats, deleteEvent } = require('../controllers/eventController');

const router = express.Router();

// Fetch events list for organizer
router.get('/', getEvents);

// Create a new event (starts as draft)
router.post('/', createEvent);

// Fetch event details
router.get('/:eventId', verifyEventOwner, getEvent);

// Update event settings
router.patch('/:eventId', verifyEventOwner, updateEvent);

// Fetch event dashboard metrics
router.get('/:eventId/stats', verifyEventOwner, getEventStats);

// Delete an event and all related data
router.delete('/:eventId', requireAuth, verifyEventOwner, deleteEvent);

module.exports = router;
