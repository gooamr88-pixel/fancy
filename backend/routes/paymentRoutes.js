const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { createCheckoutSession, purchaseSMSCredits, stripeWebhook } = require('../controllers/paymentController');

const router = express.Router();

// Route for Stripe Webhooks (must remain public, verified with Stripe signature)
router.post('/webhook', stripeWebhook);

// Protected routes to create a Stripe checkout session or purchase credits
router.post('/create-checkout', requireAuth, createCheckoutSession);
router.post('/sms-credits', requireAuth, purchaseSMSCredits);

module.exports = router;
