/* Shared inline-style helpers for the RSVP wizard steps. */
export const S = {
  inputBase: {
    width: '100%', boxSizing: 'border-box', padding: '14px 16px',
    background: '#FFFFFF', border: '1px solid #E8E2D6', borderRadius: '12px',
    fontSize: '14px', color: '#191B1E', outline: 'none',
    fontFamily: 'var(--font-sans)',
    transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
  },
  labelBase: {
    fontSize: '12px', fontWeight: 600, color: '#77736A',
    display: 'block', marginBottom: '6px', fontFamily: 'var(--font-sans)',
  },
  backBtn: {
    background: 'none', border: 'none', fontSize: '13px', color: '#77736A',
    cursor: 'pointer', fontFamily: 'var(--font-sans)', padding: '4px 0',
    fontWeight: 600, transition: 'color 0.2s ease',
  },
};

/* Step slide animation variants (used by RsvpWizard's AnimatePresence wrapper).
   A touch of scale + blur alongside the slide gives each step transition a
   soft depth-of-field feel rather than a flat sideways swap. */
export const stepVariants = {
  enter: (direction) => ({ x: direction > 0 ? 56 : -56, opacity: 0, scale: 0.98, filter: 'blur(4px)' }),
  center: { x: 0, opacity: 1, scale: 1, filter: 'blur(0px)' },
  exit: (direction) => ({ x: direction > 0 ? -56 : 56, opacity: 0, scale: 0.98, filter: 'blur(4px)' }),
};

export const stepTransition = { duration: 0.45, ease: [0.16, 1, 0.3, 1] };

/* Meal field detection — the canonical example of a 'guest'-scoped custom question.
   Step 3 renders it as the dedicated "what would you like to eat" picker (driven by
   the organizer's configured options) instead of asking it again as a generic
   question in step 4. */
export const MEAL_FIELD_KEYS = ['meal_selection', 'meal', 'meal_choice', 'meal_preference', 'meal_option'];

export function findMealField(customFormFields) {
  return (customFormFields || []).find(
    (f) => MEAL_FIELD_KEYS.includes((f.field_key || '').toLowerCase()) && ['select', 'radio'].includes(f.field_type)
  );
}
