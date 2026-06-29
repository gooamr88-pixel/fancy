/* Meal field detection — shared between the organizer's Form Builder (which offers a
   dedicated "Add Meal Options" shortcut) and the guest RSVP wizard (which renders
   whichever field matches one of these keys as the dedicated meal picker, instead of
   asking it again as a generic custom question). Keep both sides reading from here so
   the key list never drifts out of sync. */
export const MEAL_FIELD_KEYS = ['meal_selection', 'meal', 'meal_choice', 'meal_preference', 'meal_option'];
export const MEAL_FIELD_KEY = MEAL_FIELD_KEYS[0];

export function findMealField(customFormFields) {
  return (customFormFields || []).find(
    (f) => MEAL_FIELD_KEYS.includes((f.field_key || '').toLowerCase()) && ['select', 'radio'].includes(f.field_type)
  );
}
