const express = require('express');
const router = express.Router();
const { getEventAnalytics, getMaybeGuests } = require('../controllers/analyticsController');

/**
 * Organizer analytics routes — mounted at /api/v1/events/:eventId/analytics
 * Protected by requireAuth + verifyEventOwner in app.js
 */

// Full analytics dashboard data
router.get('/', getEventAnalytics);

// Maybe-response guests (for follow-up reminders)
router.get('/maybe-guests', getMaybeGuests);

module.exports = router;
