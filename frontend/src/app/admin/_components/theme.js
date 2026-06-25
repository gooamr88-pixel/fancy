/**
 * Professional dark design tokens for the Super Admin Control Center shell.
 * Every admin section/component reads these tokens (no hardcoded colors), so the
 * whole dashboard re-themes from this single file. Kept as a plain token object
 * to match the codebase's inline-style convention.
 *
 * Palette: deep slate surfaces, soft de-saturated text, vivid accents tuned for
 * legibility on dark backgrounds, and translucent "soft" accents for badges/active
 * states so they sit correctly on any dark surface.
 */
export const T = {
  // Surfaces (app bg → cards → raised/hover)
  bg: '#0b0e14',
  surface: '#141a24',
  surfaceAlt: '#1b2330',
  border: '#26303f',
  borderStrong: '#374152',

  // Text (high → low emphasis)
  text900: '#e7edf5',
  text700: '#aeb9c9',
  text500: '#7e8a9c',
  text400: '#5d6878',

  // Brand / accents (brighter than light-mode equivalents for dark contrast)
  primary: '#6d82ff',
  primarySoft: 'rgba(109,130,255,0.15)',
  success: '#34d399',
  successSoft: 'rgba(52,211,153,0.14)',
  warning: '#fbbf24',
  warningSoft: 'rgba(251,191,36,0.14)',
  danger: '#f87171',
  dangerSoft: 'rgba(248,113,113,0.14)',

  // Shape
  radius: '12px',
  radiusSm: '8px',
  shadow: '0 1px 2px rgba(0,0,0,0.45)',
  shadowMd: '0 10px 30px rgba(0,0,0,0.55)',
};

export const card = {
  background: T.surface,
  border: `1px solid ${T.border}`,
  borderRadius: T.radius,
  boxShadow: T.shadow,
};

export default T;
