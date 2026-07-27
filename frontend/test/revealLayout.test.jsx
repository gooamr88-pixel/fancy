import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import InvitationReveal from '../src/app/components/guest/InvitationReveal';

/* ═══════════════════════════════════════════════════════════════════════════
   The pixel layout, guarded.

   The envelope is a transcribed artboard: ~40 hand-copied coordinates across
   five breakpoints, and NOTHING about it is self-checking. Move one number
   and the composition is wrong on one screen size only — the failure mode is
   silent, and nobody is looking at a 640px window.

   These tests can't see pixels (jsdom has no layout engine), so they guard
   the layer underneath: the generated stylesheet is fully determined by the
   LAYERS table and the builders, so a snapshot of it fails loudly on any
   change to any coordinate, at any breakpoint, whatever caused it. A diff
   that is intentional is one snapshot update; one that isn't is a caught bug.

   WHAT THIS IS NOT: a rendering check. It proves the CSS says what it is
   meant to say, not that a browser draws it correctly. Browser-level
   snapshots are still worth adding — see the note at the end of this file.
   ═══════════════════════════════════════════════════════════════════════════ */

/* The reveal injects its whole stylesheet as one <style> child, so rendering
   it is the way to read the generated CSS without exporting internals purely
   for the test's benefit. */
function revealCSS() {
  const { container } = render(
    <InvitationReveal event={{ slug: 'demo', title: 'Aria & Julian', template_data: {} }} onComplete={() => {}} />
  );
  const style = container.querySelector('style');
  return style?.textContent || '';
}

const BREAKPOINTS = [1199, 959, 639, 479];
const LAYER_CLASSES = ['ir3-fr', 'ir3-fl', 'ir3-fb', 'ir3-ft', 'ir3-fw', 'ir3-sl', 'ir3-tx'];

describe('reveal artboard — structure', () => {
  it('positions every layer at every breakpoint', () => {
    const css = revealCSS();

    // One line per @container block, so a layer can only satisfy this by
    // restating `left` in the block being checked — not by inheriting a
    // match from a neighbouring one.
    const blockFor = (bp) => {
      const line = css.split('\n').find((l) => l.startsWith(`@container ir3 (max-width:${bp}px)`));
      expect(line, `no @container block for ${bp}px`).toBeTruthy();
      return line;
    };

    for (const bp of BREAKPOINTS) {
      const block = blockFor(bp);
      for (const cls of LAYER_CLASSES) {
        // Every layer must restate `left` at every breakpoint: x is measured
        // from a grid whose half-width CHANGES per breakpoint, so a layer that
        // inherits `left` from the block above inherits it paired with the
        // wrong grid — hundreds of pixels out, silently, on one screen size.
        expect(block, `${cls} has no left at ${bp}px`).toMatch(new RegExp(`\\.${cls}\\{[^}]*left:`));
      }
    }
  });

  it('measures its breakpoints against the container, never the viewport', () => {
    const css = revealCSS();
    // A @media here would lay a phone-sized preview box out on the 1200px
    // desktop grid — see the comment on buildArtboardCSS.
    expect(css).not.toMatch(/@media screen and \(max-width:(1199|959|639|479)px\)/);
    expect(css.match(/@container ir3 \(max-width:/g)).toHaveLength(4);
  });

  it('keeps the artboard a fixed 850px coordinate space', () => {
    expect(revealCSS()).toMatch(/height:850px;\s*margin-top:-425px/);
  });
});

describe('reveal artboard — coordinates', () => {
  it('matches the transcribed artboard exactly', () => {
    const css = revealCSS();
    const artboard = css
      .split('\n')
      .filter((l) => l.includes('left:calc(') || l.startsWith('@container'))
      .join('\n');
    // Update this snapshot ONLY together with a deliberate change to LAYERS,
    // and check the new numbers against opening-envelope-section.html.
    expect(artboard).toMatchSnapshot();
  });

  it('matches the open choreography exactly', () => {
    const css = revealCSS();
    const motion = css.split('\n').filter((l) => l.includes('transition:') || l.includes('--fly') || l.includes('animation:')).join('\n');
    expect(motion).toMatchSnapshot();
  });
});

/* ───────────────────────────────────────────────────────────────────────────
   STILL MISSING: real browser snapshots.

   What the above cannot catch is a browser DRAWING it wrong — a container
   query unsupported on an older engine, a filter that renders differently in
   Safari, an overlap that only appears once the images have real dimensions.
   That needs Playwright against a running app at 1440/1024/768/640/390, and
   it needs a fixture route to point at, because the reveal's real home is a
   guest page that requires a backend and a seeded event.

   Deliberately not stubbed out here: an empty or skipped spec file reads like
   coverage while providing none.
   ─────────────────────────────────────────────────────────────────────────── */
