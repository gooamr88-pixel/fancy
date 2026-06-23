const express = require('express');
const { requireAuth, verifyEventOwner } = require('../middleware/auth');
const { createCheckoutSession, purchaseSMSCredits, stripeWebhook, getPricingConfig, getPublicPricing, initiateManualPayment } = require('../controllers/paymentController');

const router = express.Router({ mergeParams: true });

// Route for Stripe Webhooks (must remain public, verified with Stripe signature)
router.post('/webhook', stripeWebhook);

// Public pricing for the marketing/landing page (no auth — customer-safe fields only)
router.get('/public-pricing', getPublicPricing);

// Protected routes to create a Stripe checkout session or purchase credits
router.post('/events/:eventId/create-checkout', requireAuth, verifyEventOwner, createCheckoutSession);
router.post('/events/:eventId/sms-credits', requireAuth, verifyEventOwner, purchaseSMSCredits);
router.post('/events/:eventId/manual-payment', requireAuth, verifyEventOwner, initiateManualPayment);

// Allow organizers to fetch platform licensing and SMS config
router.get('/pricing-config', requireAuth, getPricingConfig);

module.exports = router;
