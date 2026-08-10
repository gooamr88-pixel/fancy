const express = require('express');
const { requireAuth, verifyEventOwner } = require('../middleware/auth');
const { createEvent, getEvents, getEvent, updateEvent, getEventStats, deleteEvent, cancelEvent, notifyGuestsOfChange, getActivityLog } = require('../controllers/eventController');

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

// Fetch activity log for an event
router.get('/:eventId/activity', verifyEventOwner, getActivityLog);

// Tell guests about a date/venue change the organizer has already confirmed.
// Separate from the PATCH that made the change: the PATCH proposes, this sends.
router.post('/:eventId/notify-change', requireAuth, verifyEventOwner, notifyGuestsOfChange);

// Call the event off.
//
// A dedicated route rather than a status value on the PATCH above, because
// cancelling notifies every guest and cannot be undone from their side. It must
// not be reachable by adding a string to updateEvent's allowedFields.
router.post('/:eventId/cancel', requireAuth, verifyEventOwner, cancelEvent);

// Delete an event and all related data. Refuses a live event that has guests —
// see deleteEvent; cancelling is almost always what was meant.
router.delete('/:eventId', requireAuth, verifyEventOwner, deleteEvent);

module.exports = router;
