const express = require('express');
const { getPublicEventBySlug } = require('../controllers/eventController');
const { submitPublicRSVP, searchPublicGuests } = require('../controllers/rsvpController');
const checkinController = require('../controllers/checkinController');

const router = express.Router();

// Public landing page configuration fetch
router.get('/events/:slug', getPublicEventBySlug);

// Public guest RSVP name validation search
router.get('/events/:slug/rsvp/search', searchPublicGuests);

// Public guest RSVP form submit
router.post('/events/:slug/rsvp', submitPublicRSVP);

// Public self-service check-in
router.post('/events/:slug/self-checkin', checkinController.selfCheckIn);

module.exports = router;
