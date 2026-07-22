'use client';

import React, { createContext, useContext } from 'react';
import { lighten, darken, alpha, isDark, luminance } from '../../../utils/color';
import { HERITAGE_ARCH_COLORS } from './defaultContent';

/* ═══════════════════════════════════════════════════════════════
   Full-page experience theme.

   Every section used to import the fixed HERITAGE_ARCH_COLORS palette
   directly. To let ONE set of section components serve every template
   (recolored to that event's own custom_colors), the palette is now
   supplied via context and read with useFullPageTheme(). The palette
   object keeps the exact same keys the sections already reference
   (background/paper/ink/maroon/maroonDeep/gold/border/cream), so the
   section bodies didn't need to change beyond swapping the import for
   the hook. Rendered outside a provider, the hook falls back to the
   original Heritage Arch burgundy/cream palette.
   ═══════════════════════════════════════════════════════════════ */

const FullPageThemeContext = createContext(HERITAGE_ARCH_COLORS);

export function FullPageThemeProvider({ palette, children }) {
  return (
    <FullPageThemeContext.Provider value={palette || HERITAGE_ARCH_COLORS}>
      {children}
    </FullPageThemeContext.Provider>
  );
}

export function useFullPageTheme() {
  return useContext(FullPageThemeContext);
}

/* Derive the full section palette from an event's custom_colors. Heritage
   Arch itself is returned verbatim (its hand-tuned constants can't be
   reproduced exactly by generic tint math, and it must stay pixel-identical);
   every other template's palette is derived so the page feels bespoke to its
   own color story. Luminance-aware because several presets ship DARK
   backgrounds (marrakesh #1B2A4A, saffron #1F1B3A, orchid #1B1023). */
export function buildPalette(customColors = {}, templateType) {
  if (templateType === 'heritageArch') return HERITAGE_ARCH_COLORS;

  const primary = customColors.primary || HERITAGE_ARCH_COLORS.maroon;
  const secondary = customColors.secondary || customColors.accent || HERITAGE_ARCH_COLORS.gold;
  const background = customColors.background || HERITAGE_ARCH_COLORS.background;
  const dark = isDark(background);
  const paper = dark ? lighten(background, 0.08) : darken(background, 0.05);

  // On dark themes the primary accent (headings, labels, icons, dividers) is
  // used against dark surfaces, so a dark primary reads poorly. Lift it toward
  // a legible mid-tone — enough to stand off the dark background while staying
  // saturated enough that white button text on it still reads.
  //
  // On LIGHT themes, a primary picked too pale (blush, ivory, pale gold — a
  // common combination for "off-white"/neutral wedding palettes, where BOTH
  // the background and the chosen primary sit in the same pale-cream family)
  // is just as poor a heading/icon color against the light paper surface,
  // AND can't hold white button text either. An earlier version checked the
  // primary's own luminance against a flat cutoff, which could still leave
  // too small a gap when the pale primary and the pale paper it sits on were
  // close in the same family — reading as barely-there text rather than a
  // heading. This checks the ACTUAL gap against this event's own paper
  // surface instead, so it's correct regardless of the specific tones
  // involved. Clamped through this ONE value (not a separately-toned variant
  // just for buttons): an earlier version only darkened a button-specific
  // `solidFill` copy, which for a pale primary made the RSVP submit button
  // visibly a different (darker) shade than the headings/icons/dividers
  // right next to it still using the raw pale color — the exact "colors
  // don't match each other" problem this is meant to prevent, not just an
  // isolated contrast bug.
  const paperLum = luminance(paper);
  const tooLight = !dark && (paperLum - luminance(primary)) < 0.32;
  const accent = dark ? lighten(primary, 0.32) : (tooLight ? darken(primary, 0.55) : primary);

  return {
    background,
    paper,
    cream: dark ? lighten(background, 0.14) : lighten(background, 0.55),
    // Body text — same paleness problem as accent above (a pale primary
    // produced a washed-out mid-gray here too, since this darkens the raw
    // primary by a fixed amount regardless of how light it started).
    // Darkened further when needed so paragraph/label text stays legible
    // regardless of what the organizer picked as their primary color.
    ink: dark ? lighten(background, 0.85) : darken(primary, tooLight ? 0.7 : 0.55),
    maroon: accent,
    maroonDeep: dark ? lighten(primary, 0.15) : darken(accent, 0.28),
    gold: secondary,
    border: dark ? alpha(accent, 0.35) : alpha(accent, 0.18),
    // For CTAs that paint accent as a full solid background (RSVP submit,
    // registry link) rather than using it as a text/heading color — now just
    // `accent` itself, since accent is already clamped dark enough to hold
    // white/cream text above. No separate tone, so buttons and headings/
    // icons always match exactly.
    solidFill: accent,
    solidFillDeep: darken(accent, 0.22),
  };
}
