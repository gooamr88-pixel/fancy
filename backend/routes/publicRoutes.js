const express = require('express');
const { getPublicEventBySlug } = require('../controllers/eventController');
// We will import rsvp controller when implementing RSVPs
const { submitPublicRSVP } = require('../controllers/rsvpController');

const router = express.Router();

// Public landing page configuration fetch
router.get('/events/:slug', getPublicEventBySlug);

// Public guest RSVP form submit
router.post('/events/:slug/rsvp', submitPublicRSVP);

module.exports = router;
