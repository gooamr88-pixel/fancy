const express = require('express');
const { body, param, query } = require('express-validator');
const validate = require('../middleware/validate');
const { getPublicEventBySlug } = require('../controllers/eventController');
const { submitPublicRSVP, searchPublicGuests } = require('../controllers/rsvpController');
const checkinController = require('../controllers/checkinController');

const router = express.Router();

// Public landing page configuration fetch
router.get('/events/:slug', getPublicEventBySlug);

// Public guest RSVP name validation search
router.get('/events/:slug/rsvp/search', [
  query('query').optional().trim().isLength({ max: 200 }).withMessage('Search query too long'),
  validate
], searchPublicGuests);

// Public guest RSVP form submit
router.post('/events/:slug/rsvp', [
  body('guestName').trim().notEmpty().isLength({ max: 200 }).withMessage('Guest name is required (max 200 chars)'),
  body('email').optional({ values: 'falsy' }).isEmail().normalizeEmail().withMessage('Invalid email format'),
  body('phone').optional({ values: 'falsy' }).trim().isLength({ max: 30 }).withMessage('Phone number too long'),
  body('response').isIn(['yes', 'no', 'pending']).withMessage('Response must be yes, no, or pending'),
  body('partySize').optional().isInt({ min: 1, max: 20 }).withMessage('Party size must be between 1 and 20'),
  validate
], submitPublicRSVP);

// Public self-service check-in
router.post('/events/:slug/self-checkin', [
  body('rsvpId').isUUID().withMessage('Valid RSVP ID is required'),
  body('guestName').optional().trim().isLength({ max: 200 }).withMessage('Guest name too long'),
  validate
], checkinController.selfCheckIn);

module.exports = router;
