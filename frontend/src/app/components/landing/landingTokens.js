/* ═══════════════════════════════════════════════════════════════════════════
   The landing page's shared vocabulary.

   WHY THIS FILE EXISTS

   Before this, every marketing section re-declared the SAME six hex values at
   the top of its own file — `const GOLD = "#B8944F"` appeared in six separate
   components, `IVORY`/`CHARCOAL`/`STONE` in five, and RSVPFlowSection kept a
   private seventh copy under different names. Nudging the brand meant a
   find-and-replace across ~5,700 lines and a real chance of missing one, which
   is exactly how a section ends up half a shade off.

   Two things live here and nothing else:

   1. `C` — the palette, as plain JS, because these values are interpolated
      into `<style jsx>` template literals where a CSS custom property read
      from :root would work too but reads worse at the call site.

   2. `BAND` — the page's background rhythm, as an ordered list. The old page
      alternated white/ivory/dark by accident (white, ivory, dark, ivory,
      white, ivory, white, dark) with two consecutive ivory bands and no rule
      anyone could state. Now the rhythm is declared once, here, and page.js
      is the only place that reads it — so "does this page alternate properly"
      is a question you answer by reading nine lines, not by scrolling.

   NOT here: spacing, radii, containers and type scale. Those are already
   `--fx-*` in globals.css and duplicating them would create the second source
   of truth this file exists to remove.
   ═══════════════════════════════════════════════════════════════════════════ */

/** The brand palette. Matches the values already baked into globals.css's
 *  `--admin-*` tokens and the btn-gold gradient; these are the marketing-side
 *  names for the same colours. */
export const C = {
  /** Near-black. Page text, and the two dark bands. */
  charcoal: '#191B1E',
  /** The lighter charcoal the dark gradients resolve to. */
  charcoalSoft: '#2A2D32',
  /** Warm off-white. The alternating band background. */
  ivory: '#F8F4EC',
  /** Barely-there ivory, for cards sitting ON ivory. */
  ivoryLift: '#FDFCF9',
  white: '#FFFFFF',
  /** The brand gold. Buttons, eyebrows, ornament. */
  gold: '#B8944F',
  /** Lighter gold — gradients, and gold text on DARK backgrounds, where
   *  `gold` itself measures ~3.4:1 against #191B1E and fails AA for body. */
  goldSoft: '#D7BE80',
  goldLight: '#E4CE9B',
  /** Darkened gold that clears 4.5:1 as text on white/ivory. Use this for
   *  any gold that a person actually has to READ on a light band; `gold` is
   *  for fills, borders and ornament. */
  goldInk: '#8A6D34',
  /** Warm grey. Secondary copy on light bands. */
  stone: '#5E5A52',
  /** The lighter stone the old sections used. Only safe at 14px+. */
  stoneSoft: '#77736A',
  /** Hairlines on light bands. */
  border: '#E8E2D6',
};

/** Text colours for copy sitting on a DARK band, pre-mixed so no section has
 *  to invent its own rgba(248,244,236,0.6X) and land on a different one. */
export const ON_DARK = {
  title: C.ivory,
  body: 'rgba(248, 244, 236, 0.66)',
  muted: 'rgba(248, 244, 236, 0.45)',
  hairline: 'rgba(248, 244, 236, 0.12)',
  lift: 'rgba(248, 244, 236, 0.06)',
};

/** The three band backgrounds, so a section never hand-writes a gradient that
 *  is one stop different from the section two screens above it. */
export const BAND = {
  light: C.white,
  warm: C.ivory,
  dark: `linear-gradient(178deg, #14171a 0%, ${C.charcoal} 45%, #211e1a 100%)`,
};

/** The page's declared rhythm, top to bottom. page.js asserts against this so
 *  a section cannot be reordered into two consecutive bands of one colour
 *  without the arrangement being visible in one place.
 *
 *  light → warm → DARK → light → warm → light → warm → DARK → footer(dark) */
export const BAND_ORDER = [
  'hero:light',
  'how-it-works:warm',
  'invitations:dark',
  'capabilities:light',
  'dashboard:warm',
  'printed:light',
  'proof:warm',
  'faq-cta:dark',
  'footer:dark',
];

/** Shared shadow ramp. Three steps, not eleven improvised ones. */
export const SHADOW = {
  card: '0 1px 2px rgba(25, 27, 30, 0.04), 0 8px 24px -12px rgba(25, 27, 30, 0.10)',
  lift: '0 2px 6px rgba(25, 27, 30, 0.05), 0 20px 44px -20px rgba(25, 27, 30, 0.18)',
  device: '0 36px 70px -26px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(25, 27, 30, 0.06)',
  deviceDark: '0 36px 70px -26px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(248, 244, 236, 0.07)',
};
