/**
 * Light "premium SaaS" design tokens for the new Super Admin Control Center
 * shell (Master Plan — Design Requirements: clean white, minimal, enterprise).
 * Kept as a plain token object to match the codebase's inline-style convention.
 */
export const T = {
  // Surfaces
  bg: '#f7f8fa',
  surface: '#ffffff',
  surfaceAlt: '#f9fafb',
  border: '#e5e7eb',
  borderStrong: '#d1d5db',

  // Text
  text900: '#0f172a',
  text700: '#334155',
  text500: '#64748b',
  text400: '#94a3b8',

  // Brand / accents
  primary: '#4f46e5',
  primarySoft: '#eef2ff',
  success: '#16a34a',
  successSoft: '#f0fdf4',
  warning: '#d97706',
  warningSoft: '#fffbeb',
  danger: '#dc2626',
  dangerSoft: '#fef2f2',

  // Shape
  radius: '12px',
  radiusSm: '8px',
  shadow: '0 1px 2px rgba(16,24,40,0.05)',
  shadowMd: '0 4px 12px rgba(16,24,40,0.08)',
};

export const card = {
  background: T.surface,
  border: `1px solid ${T.border}`,
  borderRadius: T.radius,
  boxShadow: T.shadow,
};

export default T;
