const express = require('express');
const { requireAuth, requireSuperAdmin } = require('../middleware/auth');
const { manualCashApproval, updatePricingConfig } = require('../controllers/paymentController');

const router = express.Router();

// Apply super admin validation to all routes in this file
router.use(requireAuth);
router.use(requireSuperAdmin);

// POST /api/v1/admin/manual-approve
router.post('/manual-approve', manualCashApproval);

// PATCH /api/v1/admin/pricing
router.patch('/pricing', updatePricingConfig);

module.exports = router;
