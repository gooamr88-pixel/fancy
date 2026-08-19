/* ═══════════════════════════════════════════════════════════════════════════
   The PRODUCT screenshots on the homepage, staged from the real components.

   WHY THIS EXISTS

   templateShots.dump.jsx did this for the three invitations. This does it for
   the other half of the story — the organizer's dashboard and the seating
   plan — which the homepage used to draw by hand in 1,029 lines of invented
   JSX (a fake donut, invented stat cards, a seating chart at hardcoded
   coordinates). Every frame produced here is the component that actually
   ships, rendering real-shaped data.

   The data below is SAMPLE data, not invented UI. That distinction is the
   whole point: the numbers are made up the way any demo's numbers are, but
   every pixel around them is drawn by OrganizerOverview / OverviewStatCards /
   RsvpProgressDonut / RsvpTrendChart / SeatingMiniMap themselves. Change the
   dashboard and re-run this, and the homepage follows. Change it and do NOT
   re-run this, and the homepage is out of date rather than fictional — which
   is the failure mode you want, because it is the one somebody notices.

   ── Running it ───────────────────────────────────────────────────────────
   0. The app's real CSS is required and comes from a BUILD:
        npx next build

   1. Stage the HTML (writes .visual/landing/stage/*.html):
        npx vitest run --config vitest.shots.config.mjs

   2. Photograph each one. The iframe is a TRUE width; density comes from
      --force-device-scale-factor. Do NOT scale the iframe with a CSS
      transform — a scaled iframe paints only its own unscaled surface and the
      bottom half of the capture comes out solid black.

        chrome --headless=new --disable-gpu --hide-scrollbars \
          --allow-file-access-from-files --force-device-scale-factor=2 \
          --window-size=1160,740 --virtual-time-budget=9000 \
          --screenshot=raw-dash-overview.png frame-dash-overview.html

   3. Crop the window surplus and size for the page:

        ffmpeg -i raw-dash-overview.png -vf "crop=2240:1400:0:0,scale=1120:-1" \
          -quality 72 public/images/landing/dash-overview.webp

   BUDGET: test/templatesShowcase.test.jsx caps public/images/landing at a
   fixed KB total. Check it after converting, and do not raise the cap to fit
   a lazily-compressed file.
   ═══════════════════════════════════════════════════════════════════════════ */
import React from 'react';
import { describe, it, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';

/* OrganizerOverview reads the whole dashboard from one call. Mocked at the
   module boundary the ticket page already mocks `publicApiFetch` at, so the
   component under the camera is untouched.

   `/public/shop` is answered separately and emptily on purpose:
   PrintedInvitationsCard renders nothing without a published catalogue, and a
   printed-cards promo inside a screenshot of the DASHBOARD would be a second
   product intruding on the one this frame is about. */
const DASHBOARD = {
  totalEvents: 4,
  activeEvents: 2,
  totalGuests: 312,
  totalGuestsAccepted: 214,
  checkedIn: 0,
  notArrived: 214,
  rsvpOverview: { acceptedCount: 214, declinedCount: 38, pendingCount: 60 },
  rsvpTrend: [
    { date: '2026-07-06', accepted: 12, declined: 2, pending: 96 },
    { date: '2026-07-13', accepted: 47, declined: 8, pending: 78 },
    { date: '2026-07-20', accepted: 96, declined: 15, pending: 71 },
    { date: '2026-07-27', accepted: 138, declined: 23, pending: 68 },
    { date: '2026-08-03', accepted: 171, declined: 29, pending: 65 },
    { date: '2026-08-10', accepted: 195, declined: 34, pending: 62 },
    { date: '2026-08-17', accepted: 214, declined: 38, pending: 60 },
  ],
  upcomingEvents: [
    {
      id: 'e1', title: 'Aria & Julian', status: 'published',
      event_date: '2026-09-12T17:00:00.000Z', guest_count: 186,
      location_name: 'Rosewood Hall',
    },
    {
      id: 'e2', title: 'Layla & Karim — Engagement', status: 'published',
      event_date: '2026-10-03T18:30:00.000Z', guest_count: 94,
      location_name: 'The Orangery',
    },
    {
      id: 'e3', title: 'Hartley Annual Dinner', status: 'draft',
      event_date: '2026-11-21T19:00:00.000Z', guest_count: 32,
      location_name: 'Wickham House',
    },
  ],
  recentActivity: [
    { id: 'a1', action: 'rsvp_accepted', guest_name: 'Noor Haddad', created_at: '2026-08-18T14:22:00.000Z' },
    { id: 'a2', action: 'rsvp_accepted', guest_name: 'Daniel Roy', created_at: '2026-08-18T13:05:00.000Z' },
    { id: 'a3', action: 'rsvp_declined', guest_name: 'Marta Silva', created_at: '2026-08-18T11:47:00.000Z' },
    { id: 'a4', action: 'guest_added', guest_name: 'Yara Mansour', created_at: '2026-08-18T09:31:00.000Z' },
    { id: 'a5', action: 'rsvp_accepted', guest_name: 'Peter Nowak', created_at: '2026-08-17T20:14:00.000Z' },
  ],
};

vi.mock('../../src/app/utils/apiClient', () => ({
  apiFetch: vi.fn(async (route) => {
    if (route === '/dashboard') return { dashboard: DASHBOARD };
    if (route === '/public/shop') return { enabled: false, products: [] };
    return {};
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {} }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(''),
}));

/**
 * `globalThis.React = React` — a HARNESS shim, not a fix to product code.
 *
 * vitest.config.mjs hands .js files to esbuild with `loader: 'jsx'`, which
 * uses the CLASSIC runtime and compiles JSX to `React.createElement(...)`.
 * That needs React in the module's scope. Seventeen components under
 * dashboard/components — UpcomingEventsCards, RecentActivityFeed,
 * DashboardNav and the rest — legitimately do not import React, because Next
 * compiles them with the AUTOMATIC runtime where the import is injected.
 *
 * They are correct as written and this dump is simply the first thing to
 * render them under vitest, so the shim belongs here. Adding an unused React
 * import to seventeen product files to satisfy a screenshot harness would be
 * the tail wagging the dog — the same argument vitest.config.mjs already
 * makes about not renaming 200 components to .jsx.
 *
 * Deliberately NOT done by overriding `esbuild.jsx` in vitest.shots.config —
 * that config is shared with five other probe dumps that currently pass, and
 * changing the JSX runtime under all of them to fix one is a wide blast
 * radius for a narrow problem.
 */
globalThis.React = React;

import OrganizerOverview from '../../src/app/dashboard/components/OrganizerOverview';
import SeatingMiniMap from '../../src/app/[slug]/rsvp/SeatingMiniMap';

const ROOT = process.cwd();
const OUT = path.join(ROOT, '..', '.visual', 'landing');
const STAGE = path.join(OUT, 'stage');
const PUBLIC = path.join(ROOT, 'public').replace(/\\/g, '/');

/**
 * The app's REAL compiled CSS, concatenated from every chunk.
 *
 * src/app/globals.css is useless on its own here — `@import "tailwindcss"`
 * generates nothing outside the build, and `theme()` inside a media condition
 * is a parse error in a browser. The built stylesheet is also SPLIT across
 * chunks, and the .fx-* primitives are NOT in the biggest one, so picking a
 * file by name or size yields a page with no grid at all. That looks exactly
 * like a broken layout rather than a broken harness, which is why the assert
 * below exists: fail loudly instead of photographing a lie.
 */
function appCss() {
  const dir = path.join(ROOT, '.next/static/chunks');
  if (!fs.existsSync(dir)) {
    throw new Error('No .next build found. Run `npx next build` before staging shots.');
  }
  const css = fs.readdirSync(dir)
    .filter((f) => f.endsWith('.css'))
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'))
    .join('\n');
  if (!css.includes('.fx-grid')) {
    throw new Error('The built CSS has no .fx-grid — the build is stale or the chunks moved.');
  }
  return css;
}

/* next/font is unavailable offline; the nearest local faces keep the type at
   roughly the right texture. */
const FONTS = `
  *,*::before,*::after { box-sizing: border-box; }
  :root {
    --font-sans:'Segoe UI',system-ui,sans-serif;
    --font-serif:Georgia,'Times New Roman',serif;
    --font-script:'Segoe Script','Brush Script MT',cursive;
  }
  html,body { margin:0; padding:0; }
`;

/**
 * Styles the components inject into document.head at runtime.
 *
 * Five of these components build a <style> element in an effect and append it
 * (`organizer-overview-styles`, the trend chart's, the activity feed's, the
 * upcoming-events one). None of that is in `container.innerHTML`, and without
 * it every entrance animation stays at its `opacity: 0` start frame — the
 * capture comes out as a page of blank cards that looks like a data problem.
 */
function injectedStyles() {
  return [...document.head.querySelectorAll('style')].map((s) => s.textContent).join('\n');
}

function stage(name, html, { width, height, background = '#FDFCF9', pad = 0 }) {
  fs.mkdirSync(STAGE, { recursive: true });

  fs.writeFileSync(
    path.join(STAGE, `${name}.html`),
    `<!doctype html><html lang="en" dir="ltr"><head><meta charset="utf-8">
<base href="file:///${PUBLIC}/">
<style>${FONTS}</style>
<style>${appCss()}</style>
<style>${injectedStyles()}</style>
<style>
  body { background:${background}; padding:${pad}px; }
  /* Every entrance animation in these components is written as
     "…s both" with a stagger. The capture is a still, so run them all to
     their end state rather than trying to time the shutter. */
  *, *::before, *::after {
    animation-delay: 0s !important;
    animation-duration: 1ms !important;
    transition: none !important;
  }
</style>
</head><body>${html}</body></html>`,
    'utf8',
  );

  fs.writeFileSync(
    path.join(OUT, `frame-${name}.html`),
    `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;background:${background};overflow:hidden;}
  iframe{position:absolute;top:0;left:0;width:${width}px;height:${height}px;border:0;}
</style></head><body><iframe src="stage/${name}.html" scrolling="no"></iframe></body></html>`,
    'utf8',
  );
}

/* A real room: a head table, ten rounds, and the venue furniture that makes a
   floor plan read as a floor plan rather than a scatter of circles.
   Two field names that are NOT interchangeable, both learned the hard way:

     table_name — NOT `name`. The plan renders a NUMERAL derived from
       `el.table_name` (planNumeral strips "Table " and sets the digits three
       times larger than the full label would fit). With the wrong key the
       tables draw perfectly, with seats and shadows, and simply have no
       numbers on them — which reads as a design choice, not a bug.

     position_x / position_y — the element's TOP-LEFT corner, as a PERCENTAGE
       of the 2600x1700 world. Not its centre. Reading them as centres is what
       once scrambled an entire exported layout. */
const TABLES = [
  { id: 'z1', shape: 'stage', element_type: 'zone', position_x: 36, position_y: 3, width: 360, height: 150 },
  { id: 't0', shape: 'head', table_name: 'Head Table', capacity: 12, position_x: 34, position_y: 18 },
  { id: 't1', shape: 'round', table_name: 'Table 1', capacity: 10, position_x: 14, position_y: 30 },
  { id: 't2', shape: 'round', table_name: 'Table 2', capacity: 10, position_x: 30, position_y: 30 },
  { id: 't3', shape: 'round', table_name: 'Table 3', capacity: 10, position_x: 46, position_y: 30 },
  { id: 't4', shape: 'round', table_name: 'Table 4', capacity: 10, position_x: 62, position_y: 30 },
  { id: 't5', shape: 'round', table_name: 'Table 5', capacity: 10, position_x: 14, position_y: 45 },
  { id: 't6', shape: 'round', table_name: 'Table 6', capacity: 10, position_x: 30, position_y: 45 },
  { id: 't7', shape: 'round', table_name: 'Table 7', capacity: 10, position_x: 46, position_y: 45 },
  { id: 't8', shape: 'round', table_name: 'Table 8', capacity: 10, position_x: 62, position_y: 45 },
  { id: 't9', shape: 'oval', table_name: 'Table 9', capacity: 10, position_x: 12, position_y: 62 },
  { id: 't10', shape: 'oval', table_name: 'Table 10', capacity: 10, position_x: 60, position_y: 62 },
  { id: 'z2', shape: 'dance_floor', element_type: 'zone', position_x: 33, position_y: 60, width: 250, height: 190 },
  { id: 'z3', shape: 'bar', element_type: 'zone', position_x: 4, position_y: 80, width: 240, height: 92 },
  { id: 'z4', shape: 'dj_booth', element_type: 'zone', position_x: 74, position_y: 20, width: 132, height: 112 },
  { id: 'z5', shape: 'entrance', element_type: 'zone', position_x: 44, position_y: 88, width: 150, height: 70 },
  { id: 'z6', shape: 'cake_table', element_type: 'zone', position_x: 76, position_y: 78, width: 130, height: 100 },
];

beforeEach(() => {
  /* SeatingMiniMap sizes itself from a ResizeObserver and renders nothing
     measurable until one fires. jsdom has no layout, so report the staged
     width directly — the plan's geometry is computed in JS into inline px
     from this number, which is exactly why the dumped HTML paints correctly
     in a real browser despite jsdom never laying anything out. */
  global.ResizeObserver = class {
    constructor(cb) { this.cb = cb; }
    observe(el) { this.cb([{ target: el, contentRect: { width: 760, height: 560 } }]); }
    unobserve() {}
    disconnect() {}
  };
  global.IntersectionObserver = class {
    constructor(cb) { this.cb = cb; }
    observe() { this.cb([{ isIntersecting: true }]); }
    unobserve() {}
    disconnect() {}
  };

});

describe('landing — product shots', () => {
  it('stages the organizer dashboard', async () => {
    const { container, unmount } = render(<OrganizerOverview onNavigateToReferrals={() => {}} />);

    /* SETTLE THE WHOLE DASHBOARD BEFORE PHOTOGRAPHING IT.
     *
     * Two independent things are in flight after the fetch resolves, and the
     * still has to catch both finished:
     *
     *   • Card ENTRANCES — each card sets `visible` from a setTimeout at
     *     `entranceDelay + 50`, and until it fires the card is inline-styled
     *     `opacity: 0; transform: translateY(24px)`. Miss them and the capture
     *     has a hole in the grid where three cards should be, which reads as a
     *     layout bug rather than a timing one.
     *   • Count-up FIGURES — useAnimatedCounter walks 0 → end over 1500ms of
     *     requestAnimationFrame timestamps. Miss them and the numbers are
     *     wrong: at 400ms every figure staged "0", at 3200ms the late cards
     *     printed 304 where the data says 312.
     *
     * Pumped in SLICES rather than one long sleep, and that is the part that
     * matters. jsdom's rAF is driven by the timer queue; a single multi-second
     * await inside one act() leaves the chain of rAF callbacks and the
     * entrance timeouts competing in one flush, and the result is not
     * monotonic in the wait length — 6000ms in one go staged every figure as
     * "0", worse than 3200ms did. Repeated short acts give React a commit
     * point between slices, so both kinds of animation actually advance.
     *
     * The CSS reset in stage() cannot help with either: it neutralises CSS
     * animations, and both of these are JavaScript state. */
    for (let i = 0; i < 16; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await act(async () => { await new Promise((r) => setTimeout(r, 250)); });
    }

    /* 1120 x 860. The width is what the dashboard route gives this component
       at a desktop size — at anything under 1024 the stat grid drops from
       three columns to two and the screenshot would show a layout no desktop
       organizer ever sees. The height reaches past the stat cards into
       Upcoming Events and the activity feed, so the picture shows the thing
       doing its job rather than six tiles.
       The hero crops the same file back to 1120x700 with object-position:top,
       because at hero size the lower half is unreadable anyway. */
    stage('dash-overview', container.innerHTML, {
      width: 1120, height: 860, background: '#FDFCF9', pad: 24,
    });
    unmount();
  });

  it('stages the seating plan', async () => {
    const { container, unmount } = render(
      <SeatingMiniMap tables={TABLES} myTableId="t3" maxHeight={520} />,
    );
    await act(async () => { await new Promise((r) => setTimeout(r, 200)); });

    stage('dash-seating', container.innerHTML, {
      width: 760, height: 560, background: '#FFFFFF', pad: 16,
    });
    unmount();
  });
});
