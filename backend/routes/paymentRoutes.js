const express = require('express');
const { requireAuth, verifyEventOwner } = require('../middleware/auth');
const { createCheckoutSession, purchaseSMSCredits, stripeWebhook, verifyCheckoutSession, getPricingConfig, initiateManualPayment } = require('../controllers/paymentController');

const router = express.Router({ mergeParams: true });

// Route for Stripe Webhooks (must remain public, verified with Stripe signature)
router.post('/webhook', stripeWebhook);

// Synchronous confirmation on the browser redirect (ownership enforced inside via
// the session's authenticated org; requires a logged-in organizer).
router.get('/verify', requireAuth, verifyCheckoutSession);

// Protected routes to create a Stripe checkout session or purchase credits
router.post('/events/:eventId/create-checkout', requireAuth, verifyEventOwner, createCheckoutSession);
router.post('/events/:eventId/sms-credits', requireAuth, verifyEventOwner, purchaseSMSCredits);
router.post('/events/:eventId/manual-payment', requireAuth, verifyEventOwner, initiateManualPayment);

// Allow organizers to fetch platform licensing and SMS config
router.get('/pricing-config', requireAuth, getPricingConfig);

module.exports = router;
