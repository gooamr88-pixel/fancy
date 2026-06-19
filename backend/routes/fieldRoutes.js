const express = require('express');
const { getFields, saveField, updateField, deleteField } = require('../controllers/fieldController');

const router = express.Router({ mergeParams: true });

// UUID format validation for :fieldId param
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
router.param('fieldId', (req, res, next, value) => {
  if (!UUID_REGEX.test(value)) {
    return res.status(400).json({ success: false, error: 'INVALID_PARAM', message: 'fieldId must be a valid UUID.' });
  }
  next();
});
router.get('/', getFields);
router.post('/', saveField);
router.patch('/:fieldId', updateField);
router.delete('/:fieldId', deleteField);

module.exports = router;
