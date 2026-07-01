const express = require('express');
const { getFields, saveField, updateField, deleteField } = require('../controllers/fieldController');
const { requireFeature } = require('../middleware/featureGate');

const router = express.Router({ mergeParams: true });

// UUID format validation for :fieldId param
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
router.param('fieldId', (req, res, next, value) => {
  if (!UUID_REGEX.test(value)) {
    return res.status(400).json({ success: false, error: 'INVALID_PARAM', message: 'fieldId must be a valid UUID.' });
  }
  next();
});

// Reading existing fields is always allowed (the RSVP form needs them to render).
router.get('/', getFields);

// Creating, editing, and deleting custom fields is a paid feature.
// The One-Page Form itself sits behind the pay-first wizard step, but the
// feature gate enforces the Custom RSVP Form Builder at the API level too.
router.post('/', requireFeature('rsvp_custom_fields'), saveField);
router.patch('/:fieldId', requireFeature('rsvp_custom_fields'), updateField);
router.delete('/:fieldId', requireFeature('rsvp_custom_fields'), deleteField);

module.exports = router;
