const express = require('express');
const { body, param, query } = require('express-validator');
const validate = require('../middleware/validate');
const { getPublicEventBySlug } = require('../controllers/eventController');
const { submitPublicRSVP, searchPublicGuests, searchPublicSeating, getGuestById, getGuestSeatingMap, getRsvpInvite, respondViaToken } = require('../controllers/rsvpController');
const checkinController = require('../controllers/checkinController');
const { trackGuestEvent } = require('../controllers/analyticsController');
const { handleSmsStatusCallback } = require('../controllers/campaignController');

const router = express.Router();

// Twilio SMS delivery-status webhook (signature-verified inside the handler).
// Public + unauthenticated by design; reconciles + auto-refunds failed deliveries.
router.post('/sms/status', handleSmsStatusCallback);

// Public landing page configuration fetch
router.get('/events/:slug', getPublicEventBySlug);

// Personalized invitation resolver (guest-specific link)
router.get('/rsvp/guest/:guestId', [
  param('guestId').isUUID().withMessage('Valid guest ID is required'),
  validate
], getGuestById);

// Resolve a signed email-invitation token into guest/event context (read-only)
router.get('/rsvp/invite', [
  query('token').notEmpty().withMessage('Token is required'),
  validate
], getRsvpInvite);

// Record a one-click RSVP response from a signed invitation token
router.post('/rsvp/respond', [
  body('token').notEmpty().withMessage('Token is required'),
  body('response').optional().isIn(['accepted', 'declined', 'maybe', 'yes', 'no']).withMessage('Invalid response'),
  body('partySize').optional().isInt({ min: 1, max: 20 }).withMessage('Party size must be between 1 and 20'),
  validate
], respondViaToken);

// Public guest RSVP name validation search
router.get('/events/:slug/rsvp/search', [
  query('query').optional().trim().isLength({ max: 200 }).withMessage('Search query too long'),
  validate
], searchPublicGuests);

// Public guest seating search
router.get('/events/:slug/seating/search', [
  query('query').optional().trim().isLength({ max: 200 }).withMessage('Search query too long'),
  validate
], searchPublicSeating);

// Personal seating map for one guest (their table + own party, never other guests)
router.get('/events/:slug/seating/guest/:guestId', [
  param('guestId').isUUID().withMessage('Valid guest ID is required'),
  validate
], getGuestSeatingMap);

// Public guest RSVP form submit
router.post('/events/:slug/rsvp', [
  body('guestName').trim().notEmpty().isLength({ max: 200 }).withMessage('Guest name is required (max 200 chars)'),
  body('email').optional({ values: 'falsy' }).isEmail().normalizeEmail().withMessage('Invalid email format'),
  body('phone').optional({ values: 'falsy' }).trim().isLength({ max: 30 }).withMessage('Phone number too long'),
  body('response').isIn(['yes', 'no', 'maybe', 'pending']).withMessage('Response must be yes, no, maybe, or pending'),
  body('partySize').optional().isInt({ min: 1, max: 20 }).withMessage('Party size must be between 1 and 20'),
  body('decline_reason').optional({ values: 'falsy' }).trim().isLength({ max: 100 }).withMessage('Decline reason too long'),
  body('maybe_confirm_by').optional({ values: 'falsy' }).trim().isIn(['24h', '3d', '1w', '']).withMessage('Invalid follow-up duration'),
  validate
], submitPublicRSVP);

// Public self-service check-in
router.post('/events/:slug/self-checkin', [
  body('rsvpId').isUUID().withMessage('Valid RSVP ID is required'),
  body('guestName').optional().trim().isLength({ max: 200 }).withMessage('Guest name too long'),
  validate
], checkinController.selfCheckIn);

// Public analytics tracking (fire-and-forget)
router.post('/events/:slug/analytics', [
  body('eventType').trim().notEmpty().withMessage('Event type is required'),
  body('sessionId').optional().trim().isLength({ max: 100 }),
  body('rsvpId').optional().isUUID(),
  validate
], trackGuestEvent);

module.exports = router;
