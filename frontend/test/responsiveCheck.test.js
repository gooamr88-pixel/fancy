// @vitest-environment node
//
// This file renders nothing and never touches document/window — it walks the
// source tree and reads files. The suite-wide default is jsdom, whose setup
// measured ~19s here against ~0.9s of actual work, and under full-suite
// parallel load that pushed individual tests past the 15s ceiling: the file
// passed alone and failed at random inside `vitest run`, on a different test
// each time.
//
// A test that only fails when other tests are running is the kind everybody
// learns to re-run instead of read, which is where a real finding goes to die
// (the same argument vitest.config.mjs makes for its testTimeout). Dropping
// the DOM it never used removes the cause rather than raising the ceiling.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { scanResponsive } from '../scripts/responsiveCheck.js';

/* ═══════════════════════════════════════════════════════════════════════════
   The two responsive checks AGENTS.md documents, enforced.

   They were four shell greps nobody could run. On this tree they reported 9
   inert `fx-` classes and 21 fixed-column grids — all 30 false positives (five
   were the text "repeat(3, 1fr)" inside a comment saying the grid had been
   REMOVED) — while silently skipping every `[slug]` route, because both
   PowerShell's -Include and bash globs read `[slug]` as a character class.

   A check with a 100% false-positive rate and a blind spot over the guest page
   is not a weak check, it is a harmful one: it teaches you that the output is
   noise, which is where a real finding then goes to die.
   ═══════════════════════════════════════════════════════════════════════════ */

const SRC = path.join(process.cwd(), 'src');

describe('responsive primitives', () => {
  it('no fx- class is inert against an inline style on its own element', () => {
    expect(scanResponsive(SRC).inertClasses).toEqual([]);
  });

  it('no fixed-column grid is left without a narrow-width override', () => {
    expect(scanResponsive(SRC).fixedGrids).toEqual([]);
  });

  it('reads the dynamic routes the shell globs skipped', () => {
    // EventPageClient.js — the guest page, ~2,500 lines, and the single file
    // most worth checking — lives at src/app/[slug]/. It had never once been
    // scanned. If this stops finding it, the walker has regressed to globbing.
    const seen = [];
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
      if (e.name === 'node_modules' || e.name === '.next') return;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.jsx?$/.test(e.name)) seen.push(full.replace(/\\/g, '/'));
    });
    walk(SRC);
    expect(seen.some((f) => f.includes('/[slug]/EventPageClient.js'))).toBe(true);
    expect(seen.some((f) => f.includes('/[slug]/rsvp/RsvpWizard.js'))).toBe(true);
  });
});

describe('the checker actually detects things', () => {
  /* Without this the two assertions above pass just as happily if scanResponsive
     returns [] because it is broken — which is precisely how the greps it
     replaces went unnoticed. */
  const FIXTURE = `
    export default function A() {
      return (
        <>
          <div className="fx-section" style={{ padding: "100px 48px", background: "#fff" }} />
          <div className="fx-container" style={{ maxWidth: 900, margin: '0 auto' }} />
          <div className="fx-grid fx-grid--3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }} />

          {/* Legitimate, and each must stay quiet: */}
          <section className="fx-section" style={{ paddingBottom: 'var(--fx-pad-y-lg)' }} />
          <div className="fx-section" style={{ background: '#fff' }}>
            <p style={{ padding: 12 }}>a CHILD's padding is not the section's</p>
          </div>
          <div style={{ width: '72px', display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }} />
          <div style={{ display: 'grid', gridTemplateRows: 'repeat(7, 1fr)' }} />
          <div className="guarded" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }} />
          <style jsx>{\`
            @media (max-width: 639.98px) { .guarded { grid-template-columns: 1fr; } }
          \`}</style>
        </>
      );
    }
  `;
  /* The text below is a COMMENT. The old grep counted it as a fixed grid — it
     is the opposite, a note that one was removed. */
  const COMMENTED = `
    export default function B() {
      // Was repeat(4, 1fr) plus three media queries stepping 4->2->2->1.
      return <div className="fx-grid fx-grid--4" />;
    }
  `;

  let dir;
  const scan = () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rc-'));
    fs.writeFileSync(path.join(dir, 'Fixture.js'), FIXTURE, 'utf8');
    fs.writeFileSync(path.join(dir, 'Commented.js'), COMMENTED, 'utf8');
    return scanResponsive(dir);
  };

  it('catches every inert class', () => {
    const { inertClasses } = scan();
    expect(inertClasses.map((l) => l.split('  ')[1])).toEqual([
      '.fx-section is inert — inline padding still set',
      '.fx-container is inert — inline maxWidth / margin:0 auto still set',
      '.fx-grid is inert — inline gridTemplateColumns still set',
    ]);
  });

  it('catches an unguarded fixed grid and nothing else', () => {
    const { fixedGrids } = scan();
    // The fx-grid one (already reported as inert), plus the bare 4-column.
    // NOT: the 72px mosaic, the rows, the @media-guarded one, the comment.
    expect(fixedGrids).toHaveLength(2);
    expect(fixedGrids.join('\n')).toContain('repeat(3, 1fr)');
    expect(fixedGrids.join('\n')).toContain('repeat(4, 1fr)');
    expect(fixedGrids.join('\n')).not.toContain('Commented.js');
  });
});
