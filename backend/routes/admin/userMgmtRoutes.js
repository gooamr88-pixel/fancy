const express = require('express');
const { requirePermission } = require('../../middleware/permissions');
const {
  getUserDetail,
  setUserStatus,
  listUserSessions,
  revokeUserSession,
  resetOrganizerPassword,
  impersonateOrganizer,
} = require('../../controllers/admin/userMgmtController');

// requireAuth is applied by the parent admin router.
const router = express.Router();

// ── Users (§4) ──
router.get('/users/:userId', requirePermission('users.view'), getUserDetail);
router.patch('/users/:userId/status', requirePermission('users.manage'), setUserStatus);
router.get('/users/:userId/sessions', requirePermission('users.sessions'), listUserSessions);
router.post('/users/:userId/sessions/:sessionId/revoke', requirePermission('users.sessions'), revokeUserSession);

// ── Organizers (§5) ──
router.get('/organizers/:userId', requirePermission('organizers.view'), getUserDetail);
router.patch('/organizers/:userId/status', requirePermission('organizers.manage'), setUserStatus);
router.post('/organizers/:userId/reset-password', requirePermission('organizers.manage'), resetOrganizerPassword);
router.post('/organizers/:userId/impersonate', requirePermission('organizers.impersonate'), impersonateOrganizer);

module.exports = router;
