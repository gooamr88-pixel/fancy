const express = require('express');
const { requirePermission } = require('../../middleware/permissions');
const {
  listPermissions,
  listRoles,
  createRole,
  setRolePermissions,
  listAdminUsers,
  setAdminRoles,
} = require('../../controllers/admin/rbacController');

// requireAuth is applied by the parent admin router (routes/admin/index.js).
const router = express.Router();

// Viewing the role/permission matrix
router.get('/permissions', requirePermission('rbac.view'), listPermissions);
router.get('/roles', requirePermission('rbac.view'), listRoles);
router.get('/admins', requirePermission('rbac.view'), listAdminUsers);

// Mutations require rbac.manage
router.post('/roles', requirePermission('rbac.manage'), createRole);
router.put('/roles/:roleId/permissions', requirePermission('rbac.manage'), setRolePermissions);
router.put('/admins/:userId/roles', requirePermission('rbac.manage'), setAdminRoles);

module.exports = router;
