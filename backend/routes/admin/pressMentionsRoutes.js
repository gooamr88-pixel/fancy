const express = require('express');
const { requirePermission } = require('../../middleware/permissions');
const { listPressMentions, createPressMention, updatePressMention, deletePressMention } = require('../../controllers/admin/pressMentionsController');

// requireAuth is applied by the parent admin router.
const router = express.Router();

router.get('/', requirePermission('cms.view'), listPressMentions);
router.post('/', requirePermission('cms.manage'), createPressMention);
router.patch('/:pressMentionId', requirePermission('cms.manage'), updatePressMention);
router.delete('/:pressMentionId', requirePermission('cms.manage'), deletePressMention);

module.exports = router;
