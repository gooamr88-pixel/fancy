const express = require('express');
const { requirePermission } = require('../../middleware/permissions');
const {
  listProducts, createProduct, updateProduct, deleteProduct, reorderProducts,
  addProductImage, updateProductImage, deleteProductImage,
  listCategories, createCategory, updateCategory, deleteCategory,
  listBadges, createBadge, updateBadge, deleteBadge,
  getSettings, updateSettings, listInquiries,
} = require('../../controllers/admin/shopController');

/**
 * PRINTED INVITATIONS — admin surface, mounted at /api/v1/admin/shop.
 *
 * requireAuth is applied by the parent admin router. Reads need `cms.view` and
 * writes need `cms.manage` — the same pair the blog and testimonials use, both
 * already seeded by 20260619000000_rbac_foundation.sql. A new permission would
 * have to be granted to every existing role by hand before anyone could open
 * the page, which is exactly the kind of silent lockout worth avoiding.
 */
const router = express.Router();

// A malformed id would otherwise reach Postgres as an invalid uuid literal and
// surface as a generic 500 instead of a clean client error.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
['productId', 'imageId', 'categoryId', 'badgeId'].forEach((name) => {
  router.param(name, (req, res, next, value) => {
    if (!UUID_REGEX.test(value)) {
      return res.status(400).json({ success: false, error: 'INVALID_PARAM', message: `${name} must be a valid UUID.` });
    }
    next();
  });
});

// ── Settings ──
// Declared before /products/:productId-style routes for clarity only; Express
// matches on the full path, so there is no shadowing either way.
router.get('/settings', requirePermission('cms.view'), getSettings);
router.patch('/settings', requirePermission('cms.manage'), updateSettings);

// ── Interest report ──
router.get('/inquiries', requirePermission('cms.view'), listInquiries);

// ── Collections ──
router.get('/categories', requirePermission('cms.view'), listCategories);
router.post('/categories', requirePermission('cms.manage'), createCategory);
router.patch('/categories/:categoryId', requirePermission('cms.manage'), updateCategory);
router.delete('/categories/:categoryId', requirePermission('cms.manage'), deleteCategory);

// ── Labels ──
router.get('/badges', requirePermission('cms.view'), listBadges);
router.post('/badges', requirePermission('cms.manage'), createBadge);
router.patch('/badges/:badgeId', requirePermission('cms.manage'), updateBadge);
router.delete('/badges/:badgeId', requirePermission('cms.manage'), deleteBadge);

// ── Products ──
// `/products/reorder` must be declared before `/products/:productId` or the
// literal would be swallowed by the param route and "reorder" would be parsed
// as a product id (and then rejected by the UUID guard above).
router.get('/products', requirePermission('cms.view'), listProducts);
router.post('/products', requirePermission('cms.manage'), createProduct);
router.post('/products/reorder', requirePermission('cms.manage'), reorderProducts);
router.patch('/products/:productId', requirePermission('cms.manage'), updateProduct);
router.delete('/products/:productId', requirePermission('cms.manage'), deleteProduct);

// ── Gallery ──
router.post('/products/:productId/images', requirePermission('cms.manage'), addProductImage);
router.patch('/images/:imageId', requirePermission('cms.manage'), updateProductImage);
router.delete('/images/:imageId', requirePermission('cms.manage'), deleteProductImage);

module.exports = router;
