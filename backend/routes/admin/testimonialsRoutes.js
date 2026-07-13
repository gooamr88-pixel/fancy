const express = require('express');
const { requirePermission } = require('../../middleware/permissions');
const { listTestimonials, createTestimonial, updateTestimonial, deleteTestimonial } = require('../../controllers/admin/testimonialsController');

// requireAuth is applied by the parent admin router.
const router = express.Router();

router.get('/', requirePermission('cms.view'), listTestimonials);
router.post('/', requirePermission('cms.manage'), createTestimonial);
router.patch('/:testimonialId', requirePermission('cms.manage'), updateTestimonial);
router.delete('/:testimonialId', requirePermission('cms.manage'), deleteTestimonial);

module.exports = router;
