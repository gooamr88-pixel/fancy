const express = require('express');
const { getFields, saveField, deleteField } = require('../controllers/fieldController');

const router = express.Router({ mergeParams: true });

router.get('/', getFields);
router.post('/', saveField);
router.delete('/:fieldId', deleteField);

module.exports = router;
