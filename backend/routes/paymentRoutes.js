const express = require('express');
const { requireAuth, verifyEventOwner } = require('../middleware/auth');
const { createCheckoutSession, purchaseSMSCredits, stripeWebhook, initiateManualPayment } = require('../controllers/paymentController');

const router = express.Router({ mergeParams: true });

// Route for Stripe Webhooks (must remain public, verified with Stripe signature)
router.post('/webhook', stripeWebhook);

// Protected routes to create a Stripe checkout session or purchase credits
// verifyEventOwner reads eventId from req.params, so these routes include :eventId in the path
router.post('/events/:eventId/create-checkout', requireAuth, verifyEventOwner, createCheckoutSession);
router.post('/events/:eventId/sms-credits', requireAuth, verifyEventOwner, purchaseSMSCredits);
router.post('/events/:eventId/manual-payment', requireAuth, verifyEventOwner, initiateManualPayment);

module.exports = router;
