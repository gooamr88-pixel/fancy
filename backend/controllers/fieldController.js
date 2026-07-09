const { supabase } = require('../config/supabase');

// Keep in lockstep with the custom_form_fields.field_type CHECK constraint
// (migration 20260617000000_field_type_expansion) so a value accepted here is
// never rejected by the database with a 23514 violation.
const ALLOWED_FIELD_TYPES = ['text', 'email', 'phone', 'url', 'select', 'multiselect', 'radio', 'textarea', 'number', 'checkbox', 'date'];

// Mirrors frontend/src/app/utils/mealField.js's MEAL_FIELD_KEYS — that file's
// findMealField() checks is_meal_field first, but falls back to matching one
// of these key/type combos for rows predating that column. An organizer
// manually typing a label like "Meal Selection" (instead of using the "Add
// Meal Options" shortcut) auto-slugs to field_key='meal_selection' with
// is_meal_field left false — the frontend's fallback heuristic would then
// treat it as the meal picker while submit_rsvp_v2 server-side (which only
// trusts is_meal_field) would not, so a guest's meal answer could silently
// never reach guests.meal_selection. Reject the collision at creation time
// instead of letting client and server quietly disagree about it.
const RESERVED_MEAL_FIELD_KEYS = ['meal_selection', 'meal', 'meal_choice', 'meal_preference', 'meal_option'];

// select/radio/multiselect fields are meaningless with zero choices — the
// Form Builder UI already blocks saving one without options, but that check
// only ever existed client-side. A direct API call, or a PATCH that changes
// field_type to one of these without supplying options, could persist a
// required choice field a guest can never satisfy.
const TYPES_WITH_OPTIONS = ['select', 'radio', 'multiselect'];

const MAX_LABEL_LENGTH = 200;
const MAX_OPTION_LENGTH = 100;

// Both Form Builder UIs define options via a single comma-separated text
// input, so an organizer can never create a comma-containing option through
// the UI — the comma IS the delimiter. That guarantee only holds client-side
// though; a direct API call could still pass an option string containing a
// comma, which would corrupt a guest's multiselect answer later (the guest
// wizard stores/reads selections as a comma-joined string). Reject it here
// instead, along with duplicate options and unreasonably long label/options,
// none of which were validated anywhere before.
function validateOptionsList(options) {
  if (!Array.isArray(options)) return null;
  const seen = new Set();
  for (const raw of options) {
    const opt = String(raw).trim();
    if (!opt) continue;
    if (opt.length > MAX_OPTION_LENGTH) {
      return `Each option must be ${MAX_OPTION_LENGTH} characters or fewer.`;
    }
    if (opt.includes(',')) {
      return 'Options cannot contain a comma.';
    }
    const key = opt.toLowerCase();
    if (seen.has(key)) {
      return `Duplicate option: "${opt}".`;
    }
    seen.add(key);
  }
  return null;
}

/**
 * Fetch all custom RSVP form fields for an event.
 * GET /api/v1/events/:eventId/fields
 */
const getFields = async (req, res, next) => {
  const { eventId } = req.params;

  try {
    const { data: fields, error } = await supabase
      .from('custom_form_fields')
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
  const { fieldKey, fieldLabel, fieldType, options, isRequired, sortOrder, scope, isMealField, condition } = req.body;

  if (!fieldKey || !fieldLabel || !fieldType) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'fieldKey, fieldLabel, and fieldType are required.'
    });
  }

  if (String(fieldLabel).length > MAX_LABEL_LENGTH) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: `fieldLabel must be ${MAX_LABEL_LENGTH} characters or fewer.`
    });
  }

  const optionsError = validateOptionsList(options);
  if (optionsError) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: optionsError });
  }

  // Keep in lockstep with the custom_form_fields.field_type CHECK constraint
  // (migration 20260617000000_field_type_expansion) so a value accepted here is
  // never rejected by the database with a 23514 violation.
  if (!ALLOWED_FIELD_TYPES.includes(fieldType)) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_FIELD_TYPE',
      message: `fieldType must be one of: ${ALLOWED_FIELD_TYPES.join(', ')}`
    });
  }

  // scope distinguishes per-party questions (e.g. hotel block) from per-guest
  // questions (e.g. meal) — see custom_form_fields.scope (Phase 1 migration).
  const fieldScope = ['party', 'guest'].includes(scope) ? scope : 'party';

  // condition controls when the guest is asked: 'always' (every response) vs
  // 'attending' (only when they RSVP yes). Default 'attending' preserves the
  // historical behavior for any client that doesn't send it.
  const fieldCondition = ['always', 'attending'].includes(condition) ? condition : 'attending';

  // is_meal_field is the single source of truth submit_rsvp_v2 reads to find
  // "the" meal picker (see 20260714000000_guest_side_tagging.sql) — force the
  // key/type the guest wizard's dedicated meal UI expects rather than trusting
  // whatever the client sent, so this can never drift from what the "Add Meal
  // Options" shortcut is supposed to guarantee.
  const fieldIsMeal = !!isMealField;

  if (!fieldIsMeal && RESERVED_MEAL_FIELD_KEYS.includes(String(fieldKey).toLowerCase()) && ['select', 'radio'].includes(fieldType)) {
    return res.status(400).json({
      success: false,
      error: 'RESERVED_FIELD_KEY',
      message: `"${fieldKey}" is reserved for the dedicated meal picker. Use the "Add Meal Options" shortcut instead, or choose a different question label.`
    });
  }

  const effectiveFieldType = fieldIsMeal ? 'select' : fieldType;
  if (TYPES_WITH_OPTIONS.includes(effectiveFieldType) && (!Array.isArray(options) || options.filter((o) => String(o).trim()).length === 0)) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'At least one option is required for this field type.'
    });
  }

  try {
    const { data: field, error } = await supabase
      .from('custom_form_fields')
      .insert({
        event_id: eventId,
        field_key: fieldIsMeal ? 'meal_selection' : fieldKey,
        field_label: fieldLabel,
        field_type: fieldIsMeal ? 'select' : fieldType,
        options: options || [],
        is_required: !!isRequired,
        sort_order: parseInt(sortOrder) || 0,
        scope: fieldScope,
        condition: fieldCondition,
        is_meal_field: fieldIsMeal
      })
      .select()
      .single();

    if (error) {
      // idx_custom_form_fields_one_meal_per_event — this event already has a
      // flagged meal field (the "Add Meal Options" button is hidden once one
      // exists, but guard the race/direct-API-call case with a clear error).
      if (fieldIsMeal && (error.code === '23505' || (error.message || '').includes('duplicate key'))) {
        return res.status(409).json({
          success: false,
          error: 'MEAL_FIELD_EXISTS',
          message: 'This event already has a meal options field.'
        });
      }
      throw error;
    }

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
  const { fieldLabel, fieldType, options, isRequired, sortOrder, scope, condition } = req.body;

  if (fieldLabel !== undefined && String(fieldLabel).length > MAX_LABEL_LENGTH) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: `fieldLabel must be ${MAX_LABEL_LENGTH} characters or fewer.`
    });
  }
  const optionsError = validateOptionsList(options);
  if (optionsError) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: optionsError });
  }

  const updates = {};
  if (fieldLabel !== undefined) updates.field_label = fieldLabel;
  if (scope !== undefined) {
    if (!['party', 'guest'].includes(scope)) {
      return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: "scope must be 'party' or 'guest'." });
    }
    updates.scope = scope;
  }
  if (condition !== undefined) {
    if (!['always', 'attending'].includes(condition)) {
      return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: "condition must be 'always' or 'attending'." });
    }
    updates.condition = condition;
  }
  if (fieldType !== undefined) {
    if (!ALLOWED_FIELD_TYPES.includes(fieldType)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_FIELD_TYPE',
        message: `fieldType must be one of: ${ALLOWED_FIELD_TYPES.join(', ')}`
      });
    }
    updates.field_type = fieldType;
  }
  if (options !== undefined) updates.options = options;
  if (isRequired !== undefined) updates.is_required = !!isRequired;
  if (sortOrder !== undefined) updates.sort_order = parseInt(sortOrder) || 0;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ success: false, error: 'NO_UPDATES', message: 'No fields to update.' });
  }

  try {
    // Only needed when field_type or options might end up in an invalid
    // combination — fetch the current row so a PATCH that changes just one of
    // the two (e.g. field_type -> 'select' without also sending options)
    // is validated against what the field will actually look like afterward,
    // not just the fields present in this particular request.
    if (updates.field_type !== undefined || updates.options !== undefined) {
      const { data: current } = await supabase
        .from('custom_form_fields')
        .select('field_type, options')
        .eq('id', fieldId)
        .eq('event_id', eventId)
        .single();
      const effectiveType = updates.field_type !== undefined ? updates.field_type : current?.field_type;
      const effectiveOptions = updates.options !== undefined ? updates.options : current?.options;
      if (TYPES_WITH_OPTIONS.includes(effectiveType) && (!Array.isArray(effectiveOptions) || effectiveOptions.filter((o) => String(o).trim()).length === 0)) {
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'At least one option is required for this field type.'
        });
      }
    }

    const { data: field, error } = await supabase
      .from('custom_form_fields')
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
      .from('custom_form_fields')
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
