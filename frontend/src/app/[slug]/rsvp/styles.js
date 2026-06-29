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

export { MEAL_FIELD_KEYS, findMealField } from '../../utils/mealField';
