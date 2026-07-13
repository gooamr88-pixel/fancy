const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, param, query } = require('express-validator');
const validate = require('../middleware/validate');
const { getPublicEventBySlug } = require('../controllers/eventController');
const { submitPublicRSVP, searchPublicGuests, verifyPublicSeating, getGuestById, getGuestSeatingMap, getTicketSeatingView, getRsvpInvite, respondViaToken } = require('../controllers/rsvpController');
const checkinController = require('../controllers/checkinController');
const { trackGuestEvent } = require('../controllers/analyticsController');
const { handleSmsStatusCallback } = require('../controllers/campaignController');
const { subscribeNewsletter, submitContactForm, getPublicTestimonials, getPublicPressMentions, getPublicBlogPosts, getPublicBlogPostBySlug } = require('../controllers/marketingController');
const { verifyTurnstile } = require('../middleware/captcha');
const { generateQRCodeBuffer } = require('../utils/qrHelper');
const { getPlatformConfig } = require('../utils/configCache');
const { getPublicBaseUrl } = require('../utils/publicUrl');

const router = express.Router();

// Anonymous marketing forms — capped generously above normal human use, just
// enough to stop scripted spam without penalizing a legitimate visitor.
const marketingFormLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'TOO_MANY_REQUESTS', message: 'Too many submissions. Please try again later.' },
});

// Twilio SMS delivery-status webhook (signature-verified inside the handler).
// Public + unauthenticated by design; reconciles + auto-refunds failed deliveries.
router.post('/sms/status', handleSmsStatusCallback);

// Public landing-page stat counters (admin-editable via super_admin_config.landing_stats).
// Reads the cached config and exposes ONLY this column — never the rest of the row
// (pricing, payment methods, etc.) to anonymous clients.
router.get('/landing-stats', async (req, res) => {
  try {
    const config = await getPlatformConfig();
    res.set('Cache-Control', 'public, max-age=30');
    return res.json({ success: true, stats: config.landing_stats || [] });
  } catch (err) {
    return res.status(200).json({ success: false, stats: [] });
  }
});

// Real, admin-managed customer testimonials (published only) — see
// controllers/admin/testimonialsController.js for the full CRUD surface.
router.get('/testimonials', getPublicTestimonials);

// Real, admin-managed "As Seen In" press mentions / trust badges (published
// only) — see controllers/admin/pressMentionsController.js for full CRUD.
router.get('/press-mentions', getPublicPressMentions);

// Real, admin-managed blog (published only) — see
// controllers/admin/blogController.js for the full CRUD surface.
router.get('/blog', getPublicBlogPosts);
router.get('/blog/:slug', getPublicBlogPostBySlug);

// Footer + blog newsletter signup
router.post('/newsletter-subscribe', [
  marketingFormLimiter,
  body('email').isEmail().normalizeEmail().withMessage('A valid email is required'),
  body('source').optional().isIn(['footer', 'blog']).withMessage('Invalid source'),
  validate
], subscribeNewsletter);

// Contact page form — also the target for the /solutions/* (Planners / Venues /
// Corporate) inquiry forms, which pass the extra optional fields below plus a
// `segment` so a qualified sales lead is distinguishable from a routine
// support question (see marketingController.submitContactForm).
router.post('/contact', [
  marketingFormLimiter,
  body('name').trim().notEmpty().isLength({ max: 200 }).withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('A valid email is required'),
  body('subject').trim().notEmpty().isLength({ max: 200 }).withMessage('Subject is required'),
  body('message').trim().notEmpty().isLength({ max: 5000 }).withMessage('Message is required'),
  body('segment').optional({ values: 'falsy' }).isIn(['general', 'planners', 'venues', 'corporate']).withMessage('Invalid segment'),
  body('company').optional({ values: 'falsy' }).trim().isLength({ max: 200 }).withMessage('Company name too long'),
  body('phone').optional({ values: 'falsy' }).trim().isLength({ max: 30 }).withMessage('Phone number too long'),
  body('expectedGuests').optional({ values: 'falsy' }).trim().isLength({ max: 50 }).withMessage('Invalid guest volume'),
  validate
], submitContactForm);

// Public event-by-slug fetch
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

// Verify a guest by exact name + last 4 phone digits, returning ONLY their own
// seating map. Replaces the old name-search (which enumerated every match).
// POST + the strict /public/events limiter (30/15m per IP) throttle guessing.
router.post('/events/:slug/seating/verify', [
  body('name').trim().notEmpty().isLength({ max: 200 }).withMessage('Name is required'),
  body('phoneLast4').trim().matches(/^\d{4}$/).withMessage('Enter the last 4 digits of your phone number'),
  validate
], verifyPublicSeating);

// Personal seating map for one guest (their table + own party, never other guests)
router.get('/events/:slug/seating/guest/:guestId', [
  param('guestId').isUUID().withMessage('Valid guest ID is required'),
  validate
], getGuestSeatingMap);

// Self-scan: resolves a guest's own QR check-in ticket into their seating view
// (table + own party only). The ticket's signature IS the authentication —
// no slug/guestId needed, everything is decoded from the signed token.
router.get('/ticket/:token', getTicketSeatingView);

// Public guest RSVP form submit
router.post('/events/:slug/rsvp', [
  body('guestName').trim().notEmpty().isLength({ max: 200 }).withMessage('Guest name is required (max 200 chars)'),
  // RF-6: normalize case/whitespace but PRESERVE gmail dots and +subaddressing so a
  // guest who RSVPs as "jane+wedding@gmail.com" gets their confirmation there and the
  // address they typed is the address we store.
  body('email').optional({ values: 'falsy' }).isEmail().normalizeEmail({ gmail_remove_dots: false, gmail_remove_subaddress: false, outlookdotcom_remove_subaddress: false, icloud_remove_subaddress: false, yahoo_remove_subaddress: false }).withMessage('Invalid email format'),
  body('phone').optional({ values: 'falsy' }).trim().isLength({ max: 30 }).withMessage('Phone number too long'),
  body('response').isIn(['yes', 'no', 'maybe', 'pending']).withMessage('Response must be yes, no, maybe, or pending'),
  body('partySize').optional().isInt({ min: 1, max: 20 }).withMessage('Party size must be between 1 and 20'),
  body('decline_reason').optional({ values: 'falsy' }).trim().isLength({ max: 100 }).withMessage('Decline reason too long'),
  body('maybe_confirm_by').optional({ values: 'falsy' }).trim().isIn(['24h', '3d', '1w', '']).withMessage('Invalid follow-up duration'),
  body('side').optional({ values: 'falsy' }).isIn(['partner1', 'partner2']).withMessage('Invalid side'),
  validate
], verifyTurnstile, submitPublicRSVP);

// Public self-service check-in
router.post('/events/:slug/self-checkin', [
  body('partyId').isUUID().withMessage('Valid party ID is required'),
  body('guestName').optional().trim().isLength({ max: 200 }).withMessage('Guest name too long'),
  validate
], checkinController.selfCheckIn);

// Public analytics tracking (fire-and-forget)
router.post('/events/:slug/analytics', [
  body('eventType').trim().notEmpty().withMessage('Event type is required'),
  body('sessionId').optional().trim().isLength({ max: 100 }),
  body('partyId').optional().isUUID(),
  validate
], trackGuestEvent);

// Serve QR code as a real PNG image (email-safe — no data URIs).
// The :token param is the signed JWT ticket; the QR itself encodes a link to
// the guest's own ticket page (not the bare token) so scanning it with an
// ordinary phone camera — not just the organizer's check-in kiosk — opens
// the guest's seating view directly. Aggressive cache headers (immutable, 30
// days) because the same token always produces the same image.
router.get('/qr/:token.png', async (req, res) => {
  try {
    const ticketUrl = `${getPublicBaseUrl()}/ticket/${encodeURIComponent(req.params.token)}`;
    const buffer = await generateQRCodeBuffer(ticketUrl);
    res.set({
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=2592000, immutable',
    });
    res.send(buffer);
  } catch (err) {
    res.status(500).send('QR generation error');
  }
});

module.exports = router;
