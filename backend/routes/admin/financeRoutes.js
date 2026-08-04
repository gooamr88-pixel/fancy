const express = require('express');
const { requirePermission } = require('../../middleware/permissions');
const { getFinancialSummary, getSmsFinancials } = require('../../controllers/admin/financeController');

// requireAuth is applied by the parent admin router.
const router = express.Router();

router.get('/summary', requirePermission('finance.view'), getFinancialSummary);

// SMS profit and loss: what organizers paid, what the carrier cost us, what is
// left. Same permission as the rest of finance — it exposes carrier cost, which
// is not something an organizer-facing surface may ever show.
router.get('/sms', requirePermission('finance.view'), getSmsFinancials);

module.exports = router;
