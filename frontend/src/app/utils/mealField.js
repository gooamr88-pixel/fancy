/* Meal field detection — shared between the organizer's Form Builder (which offers a
   dedicated "Add Meal Options" shortcut) and the guest RSVP wizard (which renders
   whichever field is flagged as the dedicated meal picker, instead of asking it again
   as a generic custom question).

   is_meal_field (set by the "Add Meal Options" shortcut, see fieldController.saveField)
   is the source of truth — it's also what submit_rsvp_v2 reads server-side (migration
   20260714000000_guest_side_tagging.sql), so the frontend and backend can never
   disagree about which field is "the" meal field. The key/type heuristic below is kept
   only as a fallback for rows created before is_meal_field existed and that the
   migration's backfill didn't catch (e.g. a duplicate/renamed field). */
export const MEAL_FIELD_KEYS = ['meal_selection', 'meal', 'meal_choice', 'meal_preference', 'meal_option'];
export const MEAL_FIELD_KEY = MEAL_FIELD_KEYS[0];

export function findMealField(customFormFields) {
  const fields = customFormFields || [];
  return (
    fields.find((f) => f.is_meal_field === true) ||
    fields.find((f) => MEAL_FIELD_KEYS.includes((f.field_key || '').toLowerCase()) && ['select', 'radio'].includes(f.field_type))
  );
}
