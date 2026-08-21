import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(''), usePathname: () => '/pricing' }));

import PricingClient from '../src/app/pricing/PricingClient';
import { buildFaqs } from '../src/app/pricing/pricingData';

/* ═══════════════════════════════════════════════════════════════════════════
   THE PRICING PAGE ON A PHONE — AND ON A DESKTOP.

   Each case corresponds to something that was measured broken in a headless
   browser, not to a style preference. The measurement is quoted in the comment
   so a future change can tell what the number is protecting.

   The page is now a Server Component shell plus this client child, so these
   render the CHILD. The shell's own contract — metadata, structured data,
   fetching before render — is pinned in pricingTruth.test.jsx.
   ═══════════════════════════════════════════════════════════════════════════ */

const ROOT = process.cwd();

/* COMMENTS ARE NOT CODE. Several cases below assert that a construct is ABSENT
   from a file, and those files explain in their own comments exactly which
   construct was removed — so reading the prose as code makes the record of a
   fix indistinguishable from the bug. The styled-jsx case is the clearest:
   PricingClient's header says "PLAIN <style>, NOT <style jsx>", which would
   fail the test that keeps styled-jsx out of it. */
const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^[ 	]*\/\/.*$/gm, ' ');
const read = (rel) => stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const CLIENT = read('src/app/pricing/PricingClient.js');
const RECOMMENDER = read('src/app/pricing/PlanRecommender.js');
const DATA = read('src/app/pricing/pricingData.js');

/* SIX TIERS, WHICH IS WHAT THE LIVE SITE ACTUALLY HAS.

   `pricing_tiers` is a JSONB column an admin edits: the schema seeds three,
   the old screenshot probe was written with four, and production runs six.
   That difference was never cosmetic — the old plan grid derived its column
   count from plans.length, so four tiers laid out one card per phone row and
   six laid out TWO, at ~155px each, where the word ENTERPRISE broke as
   "ENTERPRI / SE". Every pricing screenshot ever taken here was of a page the
   organizer did not have.

   The layout no longer has a column count to get wrong, and this fixture is
   six so it never can again. */
const F1 = ['Basic RSVP forms', 'Email notifications'];
const F2 = [...F1, 'Manual guest entry'];
const F3 = [...F2, 'Seating chart designer', 'Table management', 'Text messaging'];
const F4 = [...F3, 'QR code check-in', 'Fancy Check-in app (offline door scanner)'];
const F5 = [...F4];
const F6 = [...F5, 'White-label solution', 'Dedicated account manager'];

const TIERS = [
  { key: 'free', name: 'Free', price_cents: 0, max_guests: 100, max_events: 1, is_custom: false, description: 'Try it on a small list', features: F1 },
  { key: 'classic', name: 'Classic', price_cents: 7500, max_guests: 150, max_events: 0, is_custom: false, description: 'For an intimate celebration', features: F2 },
  { key: 'premium', name: 'Premium', price_cents: 14900, max_guests: 300, max_events: 0, is_custom: false, recommended: true, description: 'The one most couples choose', features: F3 },
  { key: 'ent', name: 'Enterprise', price_cents: 29900, max_guests: 1000, max_events: 0, is_custom: false, description: 'For a large event', features: F4 },
  /* ENTERPRISE+ ADDS EXACTLY ONE THING OVER ENTERPRISE — here, nothing but
     capacity. This is the tier that broke the old card grid: equal-height
     cards must all be as tall as the tallest, so it rendered as a $599 price
     above a single line of text and ~250px of white, at every width. */
  { key: 'entplus', name: 'Enterprise+', price_cents: 59900, max_guests: 3000, max_events: 0, is_custom: false, description: 'Several thousand guests', features: F5 },
  { key: 'bespoke', name: 'Bespoke', price_cents: 0, max_guests: 0, max_events: 0, is_custom: true, description: 'Built around your event', features: F6 },
];

/* Mounted ONCE for the whole file. CLONED because testing-library's automatic
   afterEach cleanup unmounts the tree — a container captured in beforeAll is
   empty by the second test. A detached clone keeps every attribute, which is
   all these read. */
let dom;
beforeAll(() => {
  dom = render(
    <PricingClient tiers={TIERS} faqs={buildFaqs(TIERS, { stripeEnabled: true })} unavailable={false} />,
  ).container.cloneNode(true);
});

/** The rendered CSS, with its own comments removed.
 *
 *  Stripping matters: these rules are documented in place, and several cases
 *  below assert that a declaration is ABSENT. The lift rule is the example —
 *  the comment explaining why translateY(-8px) was removed necessarily
 *  contains the string translateY(-8px), so an unstripped read fails on the
 *  note about the fix rather than on the fix. */
const css = () => [...dom.querySelectorAll('style')]
  .map((s) => s.textContent)
  .join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, ' ');

/* ═══════════════════════════════════════════════════════════════════════════
   THE LADDER
   ═══════════════════════════════════════════════════════════════════════════ */

describe('the plan list has no column count to get wrong', () => {
  it('renders one row per plan, in configured order', () => {
    const rows = [...dom.querySelectorAll('.pp-row')];
    expect(rows).toHaveLength(TIERS.length);
    rows.forEach((row, i) => {
      expect(row.textContent).toContain(TIERS[i].name);
    });
  });

  it('derives no COLUMN COUNT from how many tiers there are', () => {
    /* Both previous layouts on this page were a function of plans.length, and
       both were wrong the next time an admin added a tier: auto-fit orphaned
       the fourth of four, then the rule that fixed that was gated on
       "length <= 4" and six tiers orphaned the sixth.

       Nothing derives from it now: the ladder is one row per plan and its
       tracks are named literally. What must never come back is a grid whose
       track count, or a preset class, is chosen from the data. */
    expect(CLIENT).not.toMatch(/--plan-cols|planColumns|fx-grid--/);
    expect(CLIENT).not.toMatch(/grid-template-columns:\s*repeat\(\$\{/);

    /* The ladder's own rules name their tracks literally. A custom property or
       a repeat() in here would mean the count is coming from the data again,
       which is the shape both broken layouts had. */
    const ladderRules = css().match(/\.pp-(?:row|ladder__head)\s*\{[^}]*\}/g) || [];
    expect(ladderRules.length).toBeGreaterThan(0);
    ladderRules.forEach((rule) => {
      expect(rule, 'a ladder track count came from a variable').not.toMatch(/repeat\(|var\(--pp|var\(--plan/);
    });
  });

  it('never lifts the recommended row out of the list', () => {
    /* The old highlight carried transform: translateY(-8px). On any stacked
       layout — which is every phone — that moved it INTO the plan above it.
       An overlap, not a raised card. */
    const ladder = css().slice(css().indexOf('.pp-row'), css().indexOf('.pp-btn'));
    expect(ladder).not.toMatch(/translateY\(-/);
    expect(css()).toMatch(/\.pp-row\.is-rec\s*\{[^}]*background/);
  });

  it('gives the guest number the weight of the thing people buy on', () => {
    /* Capacity used to be tick-bullet number one, identical in weight to
       "Email notifications", in a product whose plans differ mainly by it. */
    expect(dom.querySelector('.pp-row__capnum').textContent).toBe('100');
    expect(css()).toMatch(/\.pp-row__capnum\s*\{[^}]*font-size:\s*34px/);
  });

  it('closes every row with its own call to action', () => {
    const rows = [...dom.querySelectorAll('.pp-row')];
    rows.forEach((row) => {
      expect(row.querySelector('.pp-row__go a'), `${row.textContent.slice(0, 20)} has no button`).toBeTruthy();
    });
  });

  it('sends the quoted plan to sales and the rest to signup', () => {
    const hrefs = [...dom.querySelectorAll('.pp-row__go a')].map((a) => a.getAttribute('href'));
    expect(hrefs.slice(0, 5).every((h) => h === '/register')).toBe(true);
    expect(hrefs[5]).toMatch(/^\/contact/);
  });

  it('states the row shape at every width instead of inferring one', () => {
    const rules = css();
    expect(rules).toMatch(/@media \(min-width: 640px\)[\s\S]{0,600}grid-template-areas/);
    expect(rules).toMatch(/@media \(min-width: 1024px\)[\s\S]{0,1400}"id cap price adds go"/);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   THE COMPARISON IS GONE
   ═══════════════════════════════════════════════════════════════════════════ */

describe('the feature matrix does not come back by the back door', () => {
  /* Removed 2026-08-21 on the organizer's verdict that it was very bad on a
     phone — which it was: ~25 features of plan chips under two value rows,
     a wall you scroll past rather than read. Deleted rather than hidden at a
     breakpoint, because a branch nothing renders rots quietly.

     What these cases protect is not the removal, it is the two facts the
     matrix was the only place to state. Both had to move onto the ladder, and
     one of them is a limit that refuses a purchase. */
  it('renders no table at all', () => {
    expect(dom.querySelector('table')).toBeNull();
    expect(dom.querySelector('.fx-scroll-x')).toBeNull();
  });

  it('still prints every plan guest cap, as a number', () => {
    const caps = [...dom.querySelectorAll('.pp-row__capnum')].map((e) => e.textContent);
    expect(caps).toEqual(['100', '150', '300', '1,000', '3,000', 'Unlimited']);
  });

  it('still discloses an event allowance, on the plan that caps one', () => {
    /* max_events is re-checked in four places on the payment path and refuses
       to publish with "You've reached the maximum number of events (N)". Only
       the free tier sets one in this fixture. */
    const limits = [...dom.querySelectorAll('.pp-row__limit')].map((e) => e.textContent.trim());
    expect(limits).toEqual(['Covers 1 event']);
    const freeRow = dom.querySelector('.pp-row');
    expect(freeRow.textContent).toContain('Covers 1 event');
  });

  it('says "Unlimited" small, so it cannot run into the price', () => {
    // At the numeral size the word measured ~190px in a 150px track and
    // collided with "Custom" on the quoted tier's row.
    expect(dom.querySelector('.pp-row__cap.is-unl')).toBeTruthy();
    expect(css()).toMatch(/\.pp-row__cap\.is-unl \.pp-row__capnum \{[^}]*font-size:\s*19px/);
  });

  it('leaves no orphaned comparison styling behind', () => {
    ['pp-table', 'pp-narrow', 'pp-mrow', 'pp-group', 'pp-swipe', 'pp-wide', 'pp-sticky', 'pp-base']
      .forEach((cls) => {
        expect(css(), `${cls} styling outlived its markup`).not.toContain(`.${cls}`);
        expect(CLIENT, `${cls} markup is still emitted`).not.toContain(cls);
      });
  });

  it('no longer sends a reader to a table that is not there', () => {
    const answers = buildFaqs(TIERS, { stripeEnabled: true }).map((f) => f.a).join(' ');
    expect(answers).not.toMatch(/table above|comparison below|full comparison/i);
    expect(dom.textContent).not.toMatch(/comparison below|see the full comparison/i);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   ORDER
   ═══════════════════════════════════════════════════════════════════════════ */

describe('prices come before the form', () => {
  it('puts the plan list ahead of the plan finder', () => {
    /* The finder used to sit between the hero and the plans. On a phone that
       is roughly 1,300px — a screen and a half of slider, number field and a
       seven-row chip wall — before a single price. */
    const html = dom.innerHTML;
    expect(html.indexOf('pp-ladder')).toBeGreaterThan(-1);
    expect(html.indexOf('pp-ladder')).toBeLessThan(html.indexOf('pr-ask'));
  });

  it('opens the must-have chips closed', () => {
    /* A full ladder is ~25 features and every one became a chip: at 440px an
       824px wall inside a 1,671px card, for a control the heading itself calls
       optional. */
    expect(dom.querySelector('.pr-chips'), 'the chip wall is open by default').toBeNull();
    expect(dom.querySelector('.pr-disclose')).toBeTruthy();
  });

  it('paints exactly one dark surface, and it is not a band', () => {
    /* The landing system allows ONE ink block, used as punctuation rather than
       as a theme switch. This page had two full-dark surfaces: the comparison
       table's header and the closing call-to-action band. Buttons are excluded
       — an ink button is a control, not a surface. */
    const bands = [...css().matchAll(/\.pp-band--[a-z]+\s*\{([^}]*)\}/g)].map((m) => m[1]);
    expect(bands.length).toBeGreaterThan(0);
    bands.forEach((b) => expect(b, 'a band went dark').not.toMatch(/#191815/i));

    const surfaces = [...css().matchAll(/^\s*(\.pp-(?!btn)[a-z-]+[a-z0-9_-]*)\s*\{([^}]*background:\s*#191815[^}]*)\}/gim)];
    expect(surfaces.map((m) => m[1])).toEqual(['.pp-cta']);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   HOUSE RULES
   ═══════════════════════════════════════════════════════════════════════════ */

describe('the page keeps the house rules', () => {
  it('uses only breakpoints on the four-value scale', () => {
    [CLIENT, RECOMMENDER, DATA].forEach((src) => {
      const widths = [...src.matchAll(/\((?:max|min)-width: *([\d.]+)px\)/g)].map((m) => m[1]);
      const ALLOWED = new Set(['639.98', '640', '767.98', '768', '1023.98', '1024', '1279.98', '1280', '44']);
      widths.forEach((w) => expect(ALLOWED.has(w), `${w}px is off the scale`).toBe(true));
    });
  });

  it('has no backtick inside a style block', () => {
    // One backtick in a CSS comment ends the template literal and the file
    // stops parsing. It has cost several build failures across this codebase.
    [['PricingClient.js', CLIENT], ['PlanRecommender.js', RECOMMENDER]].forEach(([name, src]) => {
      [...src.matchAll(/<style(?: jsx)?(?: global)?>\{`([\s\S]*?)`\}<\/style>/g)]
        .forEach(([, block], i) => {
          expect(block.includes('`'), `a backtick is inside style block ${i} of ${name}`).toBe(false);
        });
    });
  });

  it('styles next/link from a plain style element, never styled-jsx', () => {
    /* styled-jsx stamps its hash class only onto lowercase intrinsic elements,
       so a scoped rule aimed at a class on a next/link compiles to
       .pp-btn.jsx-hash and matches NOTHING. That is the bug that made this
       platform's alerts invisible in production, and every call to action in
       the ladder is a Link. */
    [['PricingClient.js', CLIENT], ['PlanRecommender.js', RECOMMENDER]].forEach(([name, src]) => {
      expect(src.includes('<style jsx'), `${name} uses styled-jsx around Links`).toBe(false);
    });
  });

  it('never gives a text input a font size under 16px', () => {
    /* iOS Safari zooms the page in on focus below 16px and does not zoom back
       out. Range inputs are exempt — they have no text to zoom to. */
    const num = css().match(/\.pr-num\s*\{[\s\S]*?\}/);
    expect(num, 'the number field lost its rule').toBeTruthy();
    const size = num[0].match(/font-size:\s*(\d+(?:\.\d+)?)px/);
    expect(size, 'the number field declares no font size').toBeTruthy();
    expect(Number(size[1]), 'iOS will zoom on focus').toBeGreaterThanOrEqual(16);
  });

  it('gives every tappable control a real target', () => {
    // A control shorter than 44px is a control people miss.
    const controls = css().match(/min-height:\s*(\d+)px/g) || [];
    expect(controls.length).toBeGreaterThan(0);
    controls.forEach((c) => {
      expect(Number(c.match(/(\d+)/)[1]), `${c} is too small to tap`).toBeGreaterThanOrEqual(44);
    });
  });

  it('carries no inline padding that would beat the gutter class', () => {
    /* An inline --fx-pad-x or padding silently kills the mobile gutter on a
       container: a class can never beat an inline style. */
    [...dom.querySelectorAll('.fx-container, .fx-gutter')].forEach((el) => {
      const style = el.getAttribute('style') || '';
      expect(style, 'an inline padding overrides the gutter').not.toMatch(/padding|--fx-pad-x|max-width/);
    });
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   THE DEGRADED CASE
   ═══════════════════════════════════════════════════════════════════════════ */

describe('pricing being unreachable is not a broken page', () => {
  it('offers a way through when the fetch failed', () => {
    const { container } = render(
      <PricingClient tiers={[]} faqs={buildFaqs([])} unavailable />,
    );
    expect(container.textContent).toMatch(/not loading/i);
    expect(container.querySelector('a[href="/contact"]')).toBeTruthy();
    expect(container.querySelector('.pp-table'), 'an empty table was rendered').toBeNull();
  });

  it('still answers the questions that do not depend on a tier', () => {
    const qs = buildFaqs([]).map((f) => f.q);
    expect(qs.some((q) => /pay once/i.test(q))).toBe(true);
    expect(qs.some((q) => /refund/i.test(q))).toBe(true);
  });
});
