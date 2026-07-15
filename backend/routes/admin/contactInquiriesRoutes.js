const express = require('express');
const { requirePermission } = require('../../middleware/permissions');
const { listContactInquiries, respondToInquiry, updateInquiryStatus } = require('../../controllers/admin/contactInquiriesController');

// requireAuth is applied by the parent admin router.
const router = express.Router();

router.get('/', requirePermission('marketing.view'), listContactInquiries);
router.post('/:inquiryId/respond', requirePermission('marketing.manage'), respondToInquiry);
router.patch('/:inquiryId/status', requirePermission('marketing.manage'), updateInquiryStatus);

module.exports = router;
