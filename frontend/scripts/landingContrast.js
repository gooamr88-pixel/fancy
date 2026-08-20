#!/usr/bin/env node
/**
 * WCAG contrast for the landing palette's actual pairings.
 *
 * The page moved from a dark ground to paper on 2026-08-20, which inverts
 * every contrast relationship at once. Gold in particular is the trap: the
 * same #A98A4E that reads clearly ON dark is marginal ON paper, and the
 * failure is invisible to whoever picked it.
 *
 *   node scripts/landingContrast.js
 */
const path = require('path');

// Read the palette from the source of truth rather than restating it.
const tokensPath = path.join(__dirname, '..', 'src', 'app', 'components', 'landing', 'landingTokens.js');
const src = require('fs').readFileSync(tokensPath, 'utf8');
const C = {};
for (const m of src.matchAll(/^\s*(\w+):\s*'(#[0-9A-Fa-f]{6})',/gm)) C[m[1]] = m[2];

const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/* Every pairing the page actually renders, with the size it renders at.
   `large` is WCAG's 18.66px+bold or 24px+ — those pass at 3.0 instead of 4.5.
   `decorative` still has to clear 3.0 as a non-text contrast (WCAG 1.4.11)
   because these are glyphs a reader is meant to perceive, not pure ornament. */
const PAIRS = [
  ['body copy on paper', C.inkSoft, C.paper, 4.5],
  ['body copy on paper2', C.inkSoft, C.paper2, 4.5],
  ['body copy on paper3', C.inkSoft, C.paper3, 4.5],
  ['headings on paper', C.ink, C.paper, 4.5],
  ['headings on paper2', C.ink, C.paper2, 4.5],
  ['kicker label on paper', C.goldInk, C.paper, 4.5],
  ['kicker label on paper2', C.goldInk, C.paper2, 4.5],
  ['kicker label on paper3', C.goldInk, C.paper3, 4.5],
  ['step numerals (13-15px) on paper2', C.goldInk, C.paper2, 4.5],
  ['step numerals (13-15px) on paper', C.goldInk, C.paper, 4.5],
  ['italic accent word (47-78px)', C.gold, C.paper, 3.0],
  ['hairline on paper', C.border, C.paper, 1.0],
  ['ink button label', C.paper, C.ink, 4.5],
  ['ivory on the ink block', C.ivory, C.ink, 4.5],
  ['gold ornament on the ink block', C.gold, C.ink, 3.0],
];

let failed = 0;
console.log('pairing                                   ratio   need   ');
console.log('─'.repeat(62));
for (const [label, fg, bg, need] of PAIRS) {
  if (!fg || !bg) { console.log(`${label.padEnd(41)} — token missing`); failed++; continue; }
  const r = ratio(fg, bg);
  const ok = r >= need;
  if (!ok) failed++;
  console.log(`${label.padEnd(41)} ${r.toFixed(2).padStart(5)}  ${need.toFixed(1).padStart(4)}   ${ok ? 'ok' : 'FAILS'}`);
}

console.log('');
if (failed) {
  console.log(`${failed} pairing(s) below their threshold.`);
  process.exit(1);
}
console.log('all pairings clear their threshold');
