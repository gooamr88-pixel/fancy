const express = require('express');
const { getFields, saveField, updateField, deleteField } = require('../controllers/fieldController');

const router = express.Router({ mergeParams: true });

router.get('/', getFields);
router.post('/', saveField);
router.patch('/:fieldId', updateField);
router.delete('/:fieldId', deleteField);

module.exports = router;
