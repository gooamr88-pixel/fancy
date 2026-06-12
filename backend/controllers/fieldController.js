const { supabase } = require('../config/supabase');

/**
 * Fetch all custom RSVP form fields for an event.
 * GET /api/v1/events/:eventId/fields
 */
const getFields = async (req, res, next) => {
  const { eventId } = req.params;

  try {
    const { data: fields, error } = await supabase
      .from('rsvp_form_fields')
      .select('*')
      .eq('event_id', eventId)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    return res.json({
      success: true,
      fields: fields || []
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Creates custom RSVP form fields for an event.
 * POST /api/v1/events/:eventId/fields
 */
const saveField = async (req, res, next) => {
  const { eventId } = req.params;
  const { fieldKey, fieldLabel, fieldType, options, isRequired, sortOrder } = req.body;

  if (!fieldKey || !fieldLabel || !fieldType) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'fieldKey, fieldLabel, and fieldType are required.'
    });
  }

  const ALLOWED_FIELD_TYPES = ['text', 'select', 'checkbox', 'radio', 'textarea', 'date', 'number', 'email', 'phone', 'url'];
  if (!ALLOWED_FIELD_TYPES.includes(fieldType)) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_FIELD_TYPE',
      message: `fieldType must be one of: ${ALLOWED_FIELD_TYPES.join(', ')}`
    });
  }

  try {
    const { data: field, error } = await supabase
      .from('rsvp_form_fields')
      .insert({
        event_id: eventId,
        field_key: fieldKey,
        field_label: fieldLabel,
        field_type: fieldType,
        options: options || [],
        is_required: !!isRequired,
        sort_order: parseInt(sortOrder) || 0
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({
      success: true,
      message: 'Field created successfully.',
      field
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Updates an existing custom RSVP form field.
 * PATCH /api/v1/events/:eventId/fields/:fieldId
 */
const updateField = async (req, res, next) => {
  const { eventId, fieldId } = req.params;
  const { fieldLabel, fieldType, options, isRequired, sortOrder } = req.body;

  const updates = {};
  if (fieldLabel !== undefined) updates.field_label = fieldLabel;
  if (fieldType !== undefined) updates.field_type = fieldType;
  if (options !== undefined) updates.options = options;
  if (isRequired !== undefined) updates.is_required = !!isRequired;
  if (sortOrder !== undefined) updates.sort_order = parseInt(sortOrder) || 0;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ success: false, error: 'NO_UPDATES', message: 'No fields to update.' });
  }

  try {
    const { data: field, error } = await supabase
      .from('rsvp_form_fields')
      .update(updates)
      .eq('id', fieldId)
      .eq('event_id', eventId)
      .select()
      .single();

    if (error) throw error;
    if (!field) return res.status(404).json({ success: false, error: 'FIELD_NOT_FOUND' });

    return res.json({ success: true, message: 'Field updated successfully.', field });
  } catch (err) {
    next(err);
  }
};

/**
 * Deletes a custom RSVP form field.
 * DELETE /api/v1/events/:eventId/fields/:fieldId
 */
const deleteField = async (req, res, next) => {
  const { eventId, fieldId } = req.params;

  try {
    const { error } = await supabase
      .from('rsvp_form_fields')
      .delete()
      .eq('id', fieldId)
      .eq('event_id', eventId);

    if (error) throw error;

    return res.json({
      success: true,
      message: 'Field deleted successfully.'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getFields,
  saveField,
  updateField,
  deleteField
};
