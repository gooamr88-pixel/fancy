const express = require('express');
const { requirePermission } = require('../../middleware/permissions');
const { listPosts, createPost, updatePost, deletePost } = require('../../controllers/admin/blogController');

// requireAuth is applied by the parent admin router.
const router = express.Router();

// A malformed :postId would otherwise reach Postgres as an invalid uuid literal
// and surface as a generic 500 instead of a clean client error.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
router.param('postId', (req, res, next, value) => {
  if (!UUID_REGEX.test(value)) {
    return res.status(400).json({ success: false, error: 'INVALID_PARAM', message: 'postId must be a valid UUID.' });
  }
  next();
});

router.get('/', requirePermission('cms.view'), listPosts);
router.post('/', requirePermission('cms.manage'), createPost);
router.patch('/:postId', requirePermission('cms.manage'), updatePost);
router.delete('/:postId', requirePermission('cms.manage'), deletePost);

module.exports = router;
