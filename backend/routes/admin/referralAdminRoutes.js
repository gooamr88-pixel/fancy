const express = require('express');
const { requirePermission } = require('../../middleware/permissions');
const { listReferrals, updateReferralConfig, adjustCredit } = require('../../controllers/admin/referralAdminController');

// requireAuth is applied by the parent admin router.
const router = express.Router();

router.get('/', requirePermission('marketing.view'), listReferrals);
router.patch('/config', requirePermission('marketing.manage'), updateReferralConfig);
router.post('/adjust', requirePermission('marketing.manage'), adjustCredit);

module.exports = router;
