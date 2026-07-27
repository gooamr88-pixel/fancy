/**
 * THE breakpoint scale.
 *
 * These are Tailwind v4's active defaults, mirrored here for JavaScript.
 * There are three consumers and three separate reasons this file exists:
 *
 *   1. src/app/hooks/useMediaQuery.js builds its matchMedia strings from
 *      it, so every JS-side viewport check in the app agrees.
 *   2. <style jsx> blocks CANNOT read it. styled-jsx is compiled by SWC,
 *      never by PostCSS, so neither Tailwind's theme() function nor a
 *      var() in a media condition works inside one — a media condition
 *      cannot contain a custom property at all, and an invalid one is
 *      dropped silently rather than erroring. Those blocks must write the
 *      pixel literal out, and this file is what those literals get
 *      checked against by the grep in AGENTS.md.
 *   3. globals.css declares the same four values in its @theme block.
 *
 * Changing a value here means changing it in globals.css's @theme too.
 * No mechanism in this toolchain can make that automatic — the AGENTS.md
 * grep is the safety net.
 */
export const BREAKPOINTS = Object.freeze({
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
});

/**
 * `>= bp` — mobile-first, identical in meaning to Tailwind's `sm:`/`md:`
 * variants.
 *
 * Deliberately emits the classic `(min-width: 768px)` form and NOT the
 * modern range syntax `(width >= 48rem)`: matchMedia given a query it
 * cannot parse returns `matches: false` with no error and no warning. A
 * range-syntax query on an engine that doesn't support it would therefore
 * report "not desktop" forever, silently, on every device. The range form
 * is fine inside globals.css because it's resolved at build time.
 */
export const up = (bp) => `(min-width: ${BREAKPOINTS[bp]}px)`;

/**
 * `< bp` — the exact complement of up(bp).
 *
 * 0.02px, not 1px: at fractional CSS-pixel widths — browser zoom, Windows
 * display scaling, iOS pinch — a 1px gap leaves a band where NEITHER
 * up(bp) nor down(bp) matches, so both the desktop and the mobile branch
 * are simultaneously off. 0.02 sits below the smallest fraction any
 * engine reports, which closes the band without overlapping.
 */
export const down = (bp) => `(max-width: ${BREAKPOINTS[bp] - 0.02}px)`;

/** `>= a and < b` */
export const between = (a, b) => `${up(a)} and ${down(b)}`;

/**
 * Touch-primary regardless of width. Width alone no longer means "not a
 * touch device" — a large phone in landscape is ~900px+ — which is why
 * the touch-target rules in globals.css match on this as well as on
 * max-width. True for any touch-primary screen, false for mouse/trackpad.
 */
export const COARSE_POINTER = '(pointer: coarse)';

export const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
