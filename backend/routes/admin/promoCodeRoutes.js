const express = require('express');
const { requirePermission } = require('../../middleware/permissions');
const {
  listPromoCodes,
  getPromoCodeStats,
  listPromoCodeRedemptions,
  createPromoCode,
  updatePromoCode,
  deletePromoCode,
} = require('../../controllers/admin/promoCodeController');

// requireAuth is applied by the parent admin router. Reuses the existing
// 'marketing' RBAC permission (its seed description is literally "Manage
// coupons / campaigns / referrals") rather than minting a new permission key.
const router = express.Router();

router.get('/', requirePermission('marketing.view'), listPromoCodes);
router.get('/stats', requirePermission('marketing.view'), getPromoCodeStats);
router.post('/', requirePermission('marketing.manage'), createPromoCode);
router.patch('/:promoCodeId', requirePermission('marketing.manage'), updatePromoCode);
router.delete('/:promoCodeId', requirePermission('marketing.manage'), deletePromoCode);
router.get('/:promoCodeId/redemptions', requirePermission('marketing.view'), listPromoCodeRedemptions);

module.exports = router;
