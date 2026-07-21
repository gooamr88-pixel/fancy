'use client';

import React, { createContext, useContext } from 'react';
import { lighten, darken, alpha, isDark } from '../../../utils/color';

/* ═══════════════════════════════════════════════════════════════
   Custom Canvas "literal port" theme.

   A small, self-contained sibling to heritageArch/theme.js — deliberately
   NOT shared with it, so nothing here can ever affect wedding/engagement/
   legacy-variant rendering. Tuned for the reference file's specific look
   (warm gold-on-cream, translucent glass panels) rather than heritageArch's
   burgundy stationery aesthetic, but still fully derived from the event's
   own custom_colors so every organizer's page reads as their own.
   ═══════════════════════════════════════════════════════════════ */

export const DEFAULT_LITERAL_PALETTE = {
  background: '#F9E6D4',
  gold: '#866739',
  goldSoft: '#AC9778',
  ink: '#2A2A2A',
  paper: '#FFFAF8',
  border: 'rgba(134, 103, 57, 0.22)',
  glassBg: 'rgba(255, 255, 255, 0.32)',
  glassBorder: 'rgba(255, 255, 255, 0.5)',
};

export function buildLiteralPalette(customColors = {}) {
  const gold = customColors.primary || DEFAULT_LITERAL_PALETTE.gold;
  const goldSoft = customColors.secondary || customColors.accent || DEFAULT_LITERAL_PALETTE.goldSoft;
  const background = customColors.background || DEFAULT_LITERAL_PALETTE.background;
  const dark = isDark(background);

  return {
    background,
    gold: dark ? lighten(gold, 0.3) : gold,
    goldSoft,
    ink: dark ? lighten(background, 0.85) : DEFAULT_LITERAL_PALETTE.ink,
    paper: dark ? lighten(background, 0.1) : lighten(background, 0.55),
    border: dark ? alpha(goldSoft, 0.35) : alpha(gold, 0.22),
    glassBg: dark ? 'rgba(20, 16, 10, 0.38)' : 'rgba(255, 255, 255, 0.32)',
    glassBorder: dark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.5)',
  };
}

const LiteralThemeContext = createContext(DEFAULT_LITERAL_PALETTE);

export function LiteralThemeProvider({ palette, children }) {
  return (
    <LiteralThemeContext.Provider value={palette || DEFAULT_LITERAL_PALETTE}>
      {children}
    </LiteralThemeContext.Provider>
  );
}

export function useLiteralTheme() {
  return useContext(LiteralThemeContext);
}

export { lighten, darken, alpha, isDark };
