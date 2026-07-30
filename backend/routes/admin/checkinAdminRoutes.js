const express = require('express');
const { requirePermission } = require('../../middleware/permissions');
const {
  listAllDevices,
  revokeDeviceGlobal,
  requestWipeGlobal,
  getOperationalSummary,
} = require('../../controllers/admin/checkinAdminController');

const router = express.Router();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidParam = (name) => (req, res, next, value) => {
  if (!UUID_REGEX.test(value)) {
    return res.status(400).json({
      success: false, error: 'INVALID_PARAM', message: `${name} must be a valid UUID.`,
    });
  }
  next();
};

router.param('deviceId', uuidParam('deviceId'));
router.param('eventId', uuidParam('eventId'));

/**
 * Cross-organization check-in administration (amendment A-16, super admin).
 *
 * Permissions reuse the pre-seeded RBAC keys — see the controller for why an
 * invented key would be one nobody can grant.
 *
 * Reading the registry is `events.view`; revoking and wiping are
 * `security.manage`, because a device token is a session and revoking one is
 * session revocation. Splitting them means a support role can investigate
 * "which tablets still hold guest data" without also being able to remotely
 * destroy it.
 */
router.get('/devices', requirePermission('events.view'), listAllDevices);
router.delete('/devices/:deviceId', requirePermission('security.manage'), revokeDeviceGlobal);
router.post('/devices/:deviceId/wipe', requirePermission('security.manage'), requestWipeGlobal);

router.get('/events/:eventId/summary', requirePermission('events.view'), getOperationalSummary);

module.exports = router;
