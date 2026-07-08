'use client';

import React, { createContext, useContext } from 'react';
import { lighten, darken, alpha, isDark } from '../../../utils/color';
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

  return {
    background,
    paper: dark ? lighten(background, 0.08) : darken(background, 0.05),
    cream: dark ? lighten(background, 0.14) : lighten(background, 0.55),
    ink: dark ? lighten(background, 0.85) : darken(primary, 0.55),
    maroon: primary,
    maroonDeep: darken(primary, 0.28),
    gold: secondary,
    border: alpha(primary, 0.18),
  };
}
