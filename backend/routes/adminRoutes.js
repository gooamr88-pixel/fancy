const express = require('express');
const { requireAuth, requireSuperAdmin } = require('../middleware/auth');
const { manualCashApproval, updatePricingConfig, getPricingConfig, getPendingPayments } = require('../controllers/paymentController');
const { getAdminEvents, deleteEvent } = require('../controllers/eventController');
const {
  listPlatformUsers,
  setUserRole,
  getPlatformOverview,
  listOrganizations,
  listAllPayments,
  refundPayment,
  declineManualPayment,
  updateEventAdmin,
  grantSmsCredits,
  listSmsWallets,
  getGlobalActivity,
} = require('../controllers/adminController');

const router = express.Router();

// Apply super admin validation to all routes in this file
router.use(requireAuth);
router.use(requireSuperAdmin);

// ── Platform overview / analytics ──
// GET /api/v1/admin/overview
router.get('/overview', getPlatformOverview);

// ── Events ──
// GET /api/v1/admin/events
router.get('/events', getAdminEvents);
// PATCH /api/v1/admin/events/:eventId  (status / paid flag)
router.patch('/events/:eventId', updateEventAdmin);
// DELETE /api/v1/admin/events/:eventId
router.delete('/events/:eventId', deleteEvent);
// POST /api/v1/admin/events/:eventId/grant-sms
router.post('/events/:eventId/grant-sms', grantSmsCredits);

// ── Organizations ──
// GET /api/v1/admin/organizations
router.get('/organizations', listOrganizations);

// ── Payments / revenue ──
// GET /api/v1/admin/pending-payments
router.get('/pending-payments', getPendingPayments);
// GET /api/v1/admin/payments
router.get('/payments', listAllPayments);
// POST /api/v1/admin/manual-approve
router.post('/manual-approve', manualCashApproval);
// POST /api/v1/admin/payments/:paymentId/refund
router.post('/payments/:paymentId/refund', refundPayment);
// POST /api/v1/admin/payments/:paymentId/decline  (money not received)
router.post('/payments/:paymentId/decline', declineManualPayment);

// ── SMS credit wallets ──
// GET /api/v1/admin/sms-wallets
router.get('/sms-wallets', listSmsWallets);

// ── Pricing configuration ──
// GET /api/v1/admin/pricing
router.get('/pricing', getPricingConfig);
// PATCH /api/v1/admin/pricing
router.patch('/pricing', updatePricingConfig);

// ── Users & roles ──
// GET /api/v1/admin/users
router.get('/users', listPlatformUsers);
// PATCH /api/v1/admin/users/role
router.patch('/users/role', setUserRole);

// ── Audit / activity ──
// GET /api/v1/admin/activity
router.get('/activity', getGlobalActivity);

module.exports = router;
