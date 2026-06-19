const express = require('express');
const { requirePermission } = require('../../middleware/permissions');
const { listPackages, createPackage, updatePackage, deletePackage } = require('../../controllers/admin/creditController');

// requireAuth is applied by the parent admin router.
const router = express.Router();

router.get('/packages', requirePermission('credits.view'), listPackages);
router.post('/packages', requirePermission('credits.manage'), createPackage);
router.patch('/packages/:packageId', requirePermission('credits.manage'), updatePackage);
router.delete('/packages/:packageId', requirePermission('credits.manage'), deletePackage);

module.exports = router;
