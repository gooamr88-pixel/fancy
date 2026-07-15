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

// A malformed :promoCodeId would otherwise reach Postgres as an invalid uuid
// literal and surface as a generic 500 instead of a clean client error.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
router.param('promoCodeId', (req, res, next, value) => {
  if (!UUID_REGEX.test(value)) {
    return res.status(400).json({ success: false, error: 'INVALID_PARAM', message: 'promoCodeId must be a valid UUID.' });
  }
  next();
});

router.get('/', requirePermission('marketing.view'), listPromoCodes);
router.get('/stats', requirePermission('marketing.view'), getPromoCodeStats);
router.post('/', requirePermission('marketing.manage'), createPromoCode);
router.patch('/:promoCodeId', requirePermission('marketing.manage'), updatePromoCode);
router.delete('/:promoCodeId', requirePermission('marketing.manage'), deletePromoCode);
router.get('/:promoCodeId/redemptions', requirePermission('marketing.view'), listPromoCodeRedemptions);

module.exports = router;
