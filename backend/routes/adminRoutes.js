const express = require('express');
const { requireAuth, requireSuperAdmin } = require('../middleware/auth');
const { manualCashApproval, updatePricingConfig, getPricingConfig, getPendingPayments } = require('../controllers/paymentController');
const { getAdminEvents } = require('../controllers/eventController');
const { listPlatformUsers, setUserRole } = require('../controllers/adminController');

const router = express.Router();

// Apply super admin validation to all routes in this file
router.use(requireAuth);
router.use(requireSuperAdmin);

// GET /api/v1/admin/events
router.get('/events', getAdminEvents);

// GET /api/v1/admin/pricing
router.get('/pricing', getPricingConfig);

// GET /api/v1/admin/pending-payments
router.get('/pending-payments', getPendingPayments);

// POST /api/v1/admin/manual-approve
router.post('/manual-approve', manualCashApproval);

// PATCH /api/v1/admin/pricing
router.patch('/pricing', updatePricingConfig);

// GET /api/v1/admin/users
router.get('/users', listPlatformUsers);

// PATCH /api/v1/admin/users/role
router.patch('/users/role', setUserRole);

module.exports = router;
