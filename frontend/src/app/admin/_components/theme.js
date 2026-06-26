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
  bg: '#090a0f',
  surface: '#12141a',
  surfaceAlt: '#181b22',
  border: '#202530',
  borderStrong: '#2d3545',

  // Text (high → low emphasis)
  text900: '#f3f4f6',
  text700: '#d1d5db',
  text500: '#9ca3af',
  text400: '#6b7280',

  // Brand / accents (Luxury Champagne Gold and semantic alerts)
  primary: '#C5A86B',
  primarySoft: 'rgba(197, 168, 107, 0.12)',
  success: '#10B981',
  successSoft: 'rgba(16, 185, 129, 0.12)',
  warning: '#F59E0B',
  warningSoft: 'rgba(245, 158, 11, 0.12)',
  danger: '#EF4444',
  dangerSoft: 'rgba(239, 68, 68, 0.12)',

  // Shape
  radius: '16px',
  radiusSm: '10px',
  shadow: '0 4px 20px rgba(0,0,0,0.4)',
  shadowMd: '0 12px 40px rgba(0,0,0,0.6)',
};

export const card = {
  background: T.surface,
  border: `1px solid ${T.border}`,
  borderRadius: T.radius,
  boxShadow: T.shadow,
  transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
};

export default T;
