const express = require('express');
const { requirePermission } = require('../../middleware/permissions');
const { getFinancialSummary } = require('../../controllers/admin/financeController');

// requireAuth is applied by the parent admin router.
const router = express.Router();

router.get('/summary', requirePermission('finance.view'), getFinancialSummary);

module.exports = router;
