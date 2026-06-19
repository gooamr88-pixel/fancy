const express = require('express');
const { requirePermission } = require('../../middleware/permissions');
const {
  listPlans,
  createPlan,
  updatePlan,
  setPlanActive,
  deletePlan,
  listSubscriptions,
} = require('../../controllers/admin/subscriptionController');

// requireAuth is applied by the parent admin router.
const router = express.Router();

// Plans
router.get('/plans', requirePermission('subscriptions.view'), listPlans);
router.post('/plans', requirePermission('subscriptions.manage'), createPlan);
router.patch('/plans/:planId', requirePermission('subscriptions.manage'), updatePlan);
router.patch('/plans/:planId/active', requirePermission('subscriptions.manage'), setPlanActive);
router.delete('/plans/:planId', requirePermission('subscriptions.manage'), deletePlan);

// Subscriptions
router.get('/', requirePermission('subscriptions.view'), listSubscriptions);

module.exports = router;
