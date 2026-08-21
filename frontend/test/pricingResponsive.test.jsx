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
import { planColumns } from '../src/app/pricing/planColumns';

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

describe('the plan row is stated, not inferred, at every width', () => {
  /* THE DEFECT, IN THE ORGANIZER'S WORDS: "this mode of pricing page is very
     terrible", with a photo of fancyrsvp.com on a phone.

     Measured by staging the page at SIX tiers (what production runs) rather
     than the four this harness was written with. The grid carried an
     .fx-grid--N preset picked from plans.length, and each preset sets a
     different --fx-col — 260px at four plans, 160px at six. In a 390px
     phone's 346px of content that is one card per row at four and TWO at six,
     about 155px each: "Get Started Free" took three lines and the plan name
     ENTERPRISE broke across two as "ENTERPRI / SE".

     The same count also broke the desktop. The 1024 rule that stops the last
     plan being orphaned was gated on `plans.length <= 4`, so six tiers laid
     out five across at 1280 and put Bespoke alone on a second row — the exact
     bug that rule was added to fix, still live one tier count over. */

  it('gives a phone one card per row, whatever the tier count is', () => {
    expect(PAGE).toMatch(/\.pricing-plan-grid \{\s*grid-template-columns: minmax\(0, 1fr\);/);
  });

  it('does not let the plan count decide the phone layout', () => {
    // An .fx-grid--N modifier here means the phone is once again reading a
    // column width off however many tiers pricing has this month.
    const grid = PAGE.slice(PAGE.indexOf('className="fx-grid') - 60, PAGE.indexOf('className="fx-grid') + 200);
    expect(grid).not.toMatch(/fx-grid--/);
  });

  it('states the column count from 1024 up instead of leaving it to auto-fit', () => {
    /* MEASURED at 1280: the grid box is 1104px and --fx-col is 260px, so
       auto-fit needs 4x260 + 3x32 = 1136px and misses by 32px — it laid out
       THREE columns and dropped the fourth plan onto a second row, below the
       fold, on the widest screen we support. */
    expect(PAGE).toMatch(/pricing-plan-grid/);
    expect(PAGE).toMatch(/"--plan-cols": planColumns\(plans\.length\)/);
    expect(PAGE).toMatch(/@media \(min-width: 1024px\)[\s\S]{0,120}grid-template-columns: repeat\(var\(--plan-cols\), minmax\(0, 1fr\)\)/);
  });

  it('never orphans one plan on a row of its own, at any tier count', () => {
    /* 1104px of grid at 1280. Six across would be 157px a card — the width
       that broke ENTERPRISE in half on the phone — so six wraps to 3+3 rather
       than running 5+1, which is what shipped. */
    for (let n = 1; n <= 8; n += 1) {
      const cols = planColumns(n);
      const lastRow = n % cols;
      expect(cols, `${n} tiers`).toBeGreaterThan(0);
      expect(lastRow === 0 || lastRow > 1 || n === 1, `${n} tiers leaves ${lastRow} card alone in a row of ${cols}`).toBe(true);
    }
  });

  it('keeps a four-tier list on one desktop row', () => {
    // The layout the previous pass measured and fixed; six tiers must not
    // have been paid for by regressing four.
    expect(planColumns(4)).toBe(4);
    expect(planColumns(3)).toBe(3);
  });

  it('closes every card with its button, so spare height is padding not a hole', () => {
    /* MEASURED at 1280 with the six tiers production runs. The card list is a
       DELTA over the tier below, and the deltas are wildly uneven: Premium
       adds nine over Classic, Enterprise+ adds exactly ONE over Enterprise.
       Equal-height cards (deliberate — a ragged bottom under a price ladder
       reads as a rendering fault) turned that into ~350px of white under a
       single line of text in the Enterprise+ card.

       The fix is order, not height: the feature list carries flex:1 and the
       call to action follows it, so the spare space lands ABOVE a button
       sitting on the card's floor instead of below the last feature with
       nothing under it. If the Link ever moves back above the <ul>, the hole
       comes back. */
    const card = PAGE.slice(PAGE.indexOf('function PricingCard'), PAGE.indexOf('export default function PricingPage'));
    const list = card.indexOf('<ul style={{ listStyle: "none"');
    const cta = card.indexOf('href={plan.href');
    expect(list, 'the feature list is gone').toBeGreaterThan(-1);
    expect(cta, 'the call to action is gone').toBeGreaterThan(-1);
    expect(cta, 'the CTA is above the feature list again — the spare height goes back to the bottom')
      .toBeGreaterThan(list);
    expect(card).toMatch(/<ul style=\{\{ listStyle: "none", padding: 0, margin: 0, flex: 1 \}\}/);
  });

  it('caps the card list so the tallest card cannot set an unreachable height', () => {
    expect(PAGE).toMatch(/const CARD_FEATURE_CAP = \d/);
    expect(PAGE).toMatch(/slice\(0, CARD_FEATURE_CAP\)/);
    // Capping without saying so would quietly under-sell a tier.
    expect(PAGE).toMatch(/more — see the full comparison below/);
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

describe('the plan finder does not say the same thing twice', () => {
  it('prints a free tier once, not as a name above an identical price', () => {
    /* A free tier is usually NAMED "Free" and PRICED "Free". The panel
       printed both — 24px serif above 30px serif, two near-identical lines,
       which reads as a rendering fault rather than a name above a price. */
    /* Asserted on the whole file rather than a byte window after the heading:
       a window is measured in characters, so adding the comment that explains
       the guard moved the guard out of it. */
    expect(RECOMMENDER).toMatch(
      /String\(formatTierPrice\(recommended\)\.price[^)]*\)[\s\S]{0,80}!==[\s\S]{0,80}String\(recommended\.name/,
    );
  });

  it('still prints the price when it is a number', () => {
    // The guard must be an equality check, not a blanket removal.
    expect(RECOMMENDER).toMatch(/\{formatTierPrice\(recommended\)\.price\}/);
    expect(RECOMMENDER).toMatch(/\{formatTierPrice\(recommended\)\.period\}/);
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
    // The port also carries .cmp-wide since the phone list replaced it below
    // 768 — match the class it starts with rather than the whole attribute.
    const port = PAGE.indexOf('className="fx-scroll-x cmp-wide"');
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

  it('does not show the table, or its swipe hint, on a phone', () => {
    /* THE HINT USED TO POINT AT THE PROBLEM RATHER THAN FIXING IT.

       Measured at 390 the port was 346px of a 600px table — 1.8 of 5 columns,
       the third plan's name cut mid-word — so reading one row meant swiping
       out and back, per row, for twenty-five rows. Telling somebody to swipe
       is not the same as giving them a comparison they can make.

       Below 768 the table and the hint are both hidden and a per-feature list
       renders instead; at 768 and up the table returns, and so does the hint,
       because with four plans it still overflows until roughly 1100. */
    expect(PAGE).toMatch(/\.cmp-swipe,\s*\n\s*\.cmp-wide \{\s*\n\s*display: none/);
    expect(PAGE).toMatch(/@media \(min-width: 768px\)[\s\S]{0,400}\.cmp-wide \{[\s\S]{0,40}display: block/);
    expect(PAGE).toMatch(/@media \(min-width: 768px\)[\s\S]{0,600}\.cmp-swipe \{[\s\S]{0,60}display: block/);
    // And it goes away again once the table genuinely fits.
    expect(PAGE).toMatch(/@media \(min-width: 1280px\)[\s\S]{0,120}\.cmp-swipe \{[\s\S]{0,60}display: none/);
  });

  it('replaces the table with a readable list on a phone', () => {
    const list = dom.querySelector('.cmp-mobile');
    expect(list, 'no phone comparison rendered').toBeTruthy();
    expect(PAGE).toMatch(/@media \(min-width: 768px\)[\s\S]{0,200}\.cmp-mobile \{[\s\S]{0,40}display: none/);

    // Every row names its feature, so the list needs no header row to decode —
    // which is what made the scrolling table unreadable one column at a time.
    const rows = [...list.querySelectorAll('.cmp-m-row')];
    expect(rows.length, 'the phone comparison has no rows').toBeGreaterThan(1);
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
