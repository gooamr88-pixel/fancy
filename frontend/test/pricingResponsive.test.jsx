import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(''), usePathname: () => '/pricing' }));
vi.mock('../src/app/components/landing/Navbar', () => ({ default: () => null }));
vi.mock('../src/app/components/landing/FooterSection', () => ({ default: () => null }));

/* CUMULATIVE, with real registry labels — the shape getPublicPricing actually
   returns. A tier's `features` are keys an admin ticks per tier in
   /admin/config, mapped through backend/config/featureRegistry.js on the way
   out, so higher tiers are SUPERSETS rather than incremental lists.

   This mock used to say "Everything in Essential" — a prose roll-up that does
   not exist in the registry and cannot come out of that endpoint. It made the
   comparison table render as a diagonal of ticks in a field of dashes, which
   looks exactly like a broken table and is not one. */
const F_ESSENTIAL = ['Basic RSVP forms', 'Email notifications'];
const F_SIGNATURE = [...F_ESSENTIAL, 'Seating chart designer', 'Text messaging'];
const F_ENTERPRISE = [...F_SIGNATURE, 'Fancy Check-in app (offline door scanner)', 'Priority email & chat support'];
const F_BESPOKE = [...F_ENTERPRISE, 'White-label solution', 'Dedicated account manager'];

const TIERS = [
  { name: 'Essential', price_cents: 9900, currency: 'USD', max_guests: 100, is_custom: false, description: 'For an intimate celebration', features: F_ESSENTIAL },
  { name: 'Signature', price_cents: 24900, currency: 'USD', max_guests: 300, is_custom: false, recommended: true, description: 'The one most couples choose', features: F_SIGNATURE },
  { name: 'Enterprise', price_cents: 59900, currency: 'USD', max_guests: 1000, is_custom: false, description: 'For a large or multi-day event', features: F_ENTERPRISE },
  { name: 'Bespoke', price_cents: null, currency: 'USD', max_guests: null, is_custom: true, description: 'Built around your event', features: F_BESPOKE },
];

vi.mock('../src/app/utils/usePublicPricing', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, usePublicPricing: () => ({ tiers: TIERS, error: null }) };
});

import PricingPage from '../src/app/pricing/page';

const ROOT = process.cwd();
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const PAGE = read('src/app/pricing/page.js');
const RECOMMENDER = read('src/app/pricing/PlanRecommender.js');

/* Mounted ONCE for the whole file. The page is the plan finder, four cards
   and a ~20-row comparison table; mounting it per test took ~1.7s alone and
   timed out at 15s when this file ran alongside others on this machine.
   CLONED because testing-library's automatic afterEach cleanup unmounts the
   tree — a container captured in beforeAll is empty by the second test. A
   detached clone keeps every inline style, which is all these read. */
let dom;
beforeAll(() => { dom = render(<PricingPage />).container.cloneNode(true); });

/* ═══════════════════════════════════════════════════════════════════════════
   THE PRICING PAGE ON A PHONE — AND ON A DESKTOP.

   Each case here corresponds to something that was measured broken in a
   headless browser, not to a style preference. The measurements are quoted in
   the comments so a future change can tell what the number is protecting.
   ═══════════════════════════════════════════════════════════════════════════ */

describe('the plan cards form one row of equal cards', () => {
  it('states the column count from 1024 up instead of leaving it to auto-fit', () => {
    /* MEASURED at 1280: the grid box is 1104px and --fx-col is 260px, so
       auto-fit needs 4x260 + 3x32 = 1136px and misses by 32px — it laid out
       THREE columns and dropped the fourth plan onto a second row, below the
       fold, on the widest screen we support. */
    expect(PAGE).toMatch(/pricing-plan-grid/);
    expect(PAGE).toMatch(/"--plan-count": plans\.length/);
    expect(PAGE).toMatch(/@media \(min-width: 1024px\)[\s\S]{0,120}grid-template-columns: repeat\(var\(--plan-count\), minmax\(0, 1fr\)\)/);
  });

  it('does not pin the cards to the top of their row', () => {
    /* align-items:start let every card end at its own feature-list length —
       measured 542 / 587 / 563 / 505 side by side, a ragged bottom edge under
       four cards that are meant to read as a set. Stretch (the default) makes
       them equal; the card is already a flex column with flex:1 on the list,
       so nothing else has to change. */
    const grid = PAGE.slice(PAGE.indexOf('pricing-plan-grid') - 400, PAGE.indexOf('pricing-plan-grid') + 400);
    expect(grid).not.toMatch(/alignItems: *["']start["']/);
  });
});

describe('the comparison table stays readable while it scrolls', () => {
  it('pins the feature column', () => {
    expect(PAGE).toMatch(/\.cmp-feature \{[\s\S]{0,120}position: sticky/);
    expect(PAGE).toMatch(/\.cmp-feature \{[\s\S]{0,160}inset-inline-start: 0/);
  });

  it('leaves no clipping ancestor between that column and the scroll port', () => {
    /* THE bug this file exists for. `position: sticky` resolves against its
       nearest SCROLLPORT, and any ancestor with a non-visible overflow becomes
       one — even though it never scrolls. The table card used overflow:hidden
       to clip its rounded corners, and that alone made the sticky column
       completely inert: measured at 390px the cell went 33 -> -87 -> -207 as
       the port scrolled, i.e. straight off the screen, exactly like a static
       cell. After the fix it measures 0 at every offset.

       So: between `.fx-scroll-x` and the cells there must be no overflow at
       all, and the corners must be rounded by the header and last row. */
    const port = PAGE.indexOf('className="fx-scroll-x"');
    expect(port, 'the scroll port moved').toBeGreaterThan(-1);
    const table = PAGE.slice(port, PAGE.indexOf('{/* Table Rows */}'));
    expect(table).not.toMatch(/overflow: *["']hidden["']/);
    expect(table).toMatch(/borderRadius: *["']16px 16px 0 0["']/);
    expect(PAGE).toMatch(/borderRadius: *["']0 0 16px 16px["']/);
  });

  it('gives every pinned cell an opaque background and its own start padding', () => {
    /* Two ways a working sticky column still looks broken: a transparent cell
       lets the scrolling ticks slide visibly under the feature names, and a
       cell without its own inline-start padding prints flush against the
       table border once it is stuck (the row's padding scrolls away with the
       row). */
    const cells = [...dom.querySelectorAll('.cmp-feature')];
    expect(cells.length, 'no pinned cells rendered').toBeGreaterThan(1);
    cells.forEach((c) => {
      expect(c.style.background, 'a pinned cell is transparent').toBeTruthy();
      expect(c.style.background).not.toMatch(/transparent|rgba\([^)]*, *0\)/);
      expect(c.style.paddingInlineStart, 'a pinned cell has no start padding').toBe('32px');
    });
  });

  it('tells the visitor it scrolls, at the widths where it does', () => {
    /* MEASURED: the port is 280px of a 600px table at 320, and 346 of 600 at
       390 — it OVERFLOWS. At 768 it is 702 of 702 and at 1280 860 of 860 — it
       FITS. So the hint has to disappear at exactly 768, or it starts
       promising a swipe that does nothing. Without it, a header cut off
       mid-word ("SIGNA…") reads as a broken page. */
    expect(dom.querySelector('.cmp-swipe')).toBeTruthy();
    expect(PAGE).toMatch(/@media \(min-width: 768px\)[\s\S]{0,120}\.cmp-swipe \{[\s\S]{0,60}display: none/);
  });
});

describe('the plan finder stacks before it gets cramped', () => {
  it('collapses its two columns at 1024, not at 768', () => {
    /* At 768 the two columns are about 330px each: the feature chips wrap to
       one per line into a tall ragged stack while the recommendation panel
       beside them — which is short — sits half empty. Stacked, the chips take
       the full width and flow three to a row. */
    expect(RECOMMENDER).toMatch(/@media \(max-width: 1023\.98px\)[\s\S]{0,160}\.pr-grid \{[^}]*grid-template-columns: 1fr/);
    expect(RECOMMENDER).not.toMatch(/@media \(max-width: 767\.98px\)[\s\S]{0,160}\.pr-grid/);
  });

  it('centres the recommendation against the taller input column', () => {
    expect(RECOMMENDER).toMatch(/justifyContent: *["']center["']/);
  });
});

describe('the page keeps the house rules', () => {
  it('uses only breakpoints on the four-value scale', () => {
    [PAGE, RECOMMENDER].forEach((src) => {
      const widths = [...src.matchAll(/\((?:max|min)-width: *([\d.]+)px\)/g)].map((m) => m[1]);
      const ALLOWED = new Set(['639.98', '640', '767.98', '768', '1023.98', '1024', '1279.98', '1280', '44']);
      widths.forEach((w) => expect(ALLOWED.has(w), `${w}px is off the scale`).toBe(true));
    });
  });

  it('has no backtick inside a style block', () => {
    // One backtick in a CSS comment ends the template literal and the file
    // stops parsing. It has cost several build failures across this codebase.
    [['page.js', PAGE], ['PlanRecommender.js', RECOMMENDER]].forEach(([name, src]) => {
      [...src.matchAll(/<style jsx(?: global)?>\{`([\s\S]*?)`\}<\/style>/g)]
        .forEach(([, css], i) => {
          expect(css.includes('`'), `a backtick is inside style block ${i} of ${name}`).toBe(false);
        });
    });
  });

  it('never gives a text input type under 16px', () => {
    /* iOS Safari zooms the page in on focus below 16px and does not zoom back
       out. Range inputs are exempt — they have no text to zoom to. */
    const inputs = [...RECOMMENDER.matchAll(/<input([\s\S]{0,700}?)\/>/g)].map((m) => m[1]);
    expect(inputs.length, 'the recommender lost its inputs').toBeGreaterThan(0);
    inputs.forEach((attrs) => {
      if (/type="range"/.test(attrs)) return;
      const size = attrs.match(/fontSize: *["'](\d+(?:\.\d+)?)px["']/);
      expect(size, 'a text input declares no font size — it will inherit one').toBeTruthy();
      expect(Number(size[1]), 'iOS will zoom on focus').toBeGreaterThanOrEqual(16);
    });
  });
});
