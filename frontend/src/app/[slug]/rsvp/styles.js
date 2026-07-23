/* Shared inline-style helpers for the RSVP wizard steps. */
export const S = {
  inputBase: {
    width: '100%', boxSizing: 'border-box', padding: '14px 16px',
    background: '#FFFFFF', border: '1px solid #E8E2D6', borderRadius: '12px',
    // 16px, not 14px — anything smaller on a focusable field makes iOS Safari
    // auto-zoom the whole page in when the guest taps it (every input/select
    // in the RSVP form uses this one style object), which is exactly the kind
    // of "terrible on iPhone" this was.
    fontSize: '16px', color: '#191B1E', outline: 'none',
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
  // Uppercase-tracked micro-label — the badge/kicker treatment repeated
  // across the host card, companion cards, and section headings. Color is
  // supplied by the caller (usually the event's theme color).
  eyebrow: {
    fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.14em',
    fontWeight: 700, fontFamily: 'var(--font-sans)',
  },
};

export { MEAL_FIELD_KEYS, findMealField } from '../../utils/mealField';
