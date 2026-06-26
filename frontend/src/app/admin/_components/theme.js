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
  bg: 'var(--admin-bg, #FAFAF8)',
  surface: 'var(--admin-surface, #FFFFFF)',
  surfaceAlt: 'var(--admin-surface-alt, #FDFCF9)',
  border: 'var(--admin-border, #E8E2D6)',
  borderStrong: 'var(--admin-border-strong, #D7BE80)',

  // Text (high → low emphasis)
  text900: 'var(--admin-text-900, #191B1E)',
  text700: 'var(--admin-text-700, #4A4D53)',
  text500: 'var(--admin-text-500, #77736A)',
  text400: 'var(--admin-text-400, #A19E95)',

  // Brand / accents (Luxury Champagne Gold and semantic alerts)
  primary: 'var(--admin-primary, #B8944F)',
  primarySoft: 'var(--admin-primary-soft, rgba(184, 148, 79, 0.08))',
  success: 'var(--admin-success, #10B981)',
  successSoft: 'var(--admin-success-soft, rgba(16, 185, 129, 0.08))',
  warning: 'var(--admin-warning, #F59E0B)',
  warningSoft: 'var(--admin-warning-soft, rgba(245, 158, 11, 0.08))',
  danger: 'var(--admin-danger, #EF4444)',
  dangerSoft: 'var(--admin-danger-soft, rgba(239, 68, 68, 0.08))',

  // Shape
  radius: '16px',
  radiusSm: '10px',
  shadow: '0 4px 20px rgba(0,0,0,0.05)',
  shadowMd: '0 12px 40px rgba(0,0,0,0.1)',
};

export const card = {
  background: T.surface,
  border: `1px solid ${T.border}`,
  borderRadius: T.radius,
  boxShadow: T.shadow,
  transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
};

export default T;
