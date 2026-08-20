/* Renders /pricing so its responsive behaviour can be MEASURED rather than
   guessed at. Staged output + per-width iframe wrappers land in
   .visual/pricing/. Run with:
     npx vitest run --config vitest.shots.config.mjs test/shots/pricingProbe.dump.jsx */
import React from 'react';
import { describe, it, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(''), usePathname: () => '/pricing' }));
vi.mock('../../src/app/components/landing/Navbar', () => ({ default: () => null }));
vi.mock('../../src/app/components/landing/FooterSection', () => ({ default: () => null }));
/* PlanRecommender used to be mocked out here, because it imported only the
   hooks it uses and not React itself — fine under Next's automatic JSX
   runtime, a ReferenceError under vitest's classic esbuild transform. That
   meant the plan finder, a two-column grid with a slider and a chip row, was
   MISSING from every screenshot taken of this page while its responsive
   behaviour was being judged. It now imports React like the other 149
   components here do, so it renders for real and is shot with the page. */

/* ─────────────────────────────────────────────────────────────────────────
   THE MOCK HAS TO HAVE THE SHAPE THE ENDPOINT ACTUALLY RETURNS.

   It did not, and that quietly invalidated every screenshot taken here.

   The old mock gave each tier four or five PROSE strings and roll-ups like
   "Everything in Essential". The real endpoint
   (paymentController.getPublicPricing) maps a tier's `features` — which are
   KEYS an admin ticks per tier in /admin/config — through the feature registry
   into labels. So two things were wrong at once:

     · the labels were invented, not registry labels ("Multi-day schedule" is
       not a feature this platform has; "Custom RSVP form builder" is);
     · the sets were incremental rather than cumulative, because a roll-up
       string stood in for the lower tier's features. The comparison table
       matches feature strings exactly, so with that mock the matrix rendered
       as a DIAGONAL of ticks in a field of dashes.

   That made the table look broken when it is not — with real data the higher
   tiers are supersets and it fills in properly. A harness that invents a
   defect is worse than no harness; this is the second time that exact
   sentence has had to be written in this file.

   These are real labels from backend/config/featureRegistry.js, in cumulative
   sets, at the realistic size of a full ladder (~25 features). That is the
   shape that actually stresses this page: 25 comparison rows and a 25-chip
   filter list, not four tidy bullets.
   ───────────────────────────────────────────────────────────────────────── */
const F = {
  rsvpBasic: 'Basic RSVP forms',
  analytics: 'Basic analytics dashboard',
  email: 'Email notifications',
  community: 'Community support',
  manualGuest: 'Manual guest entry',
  customFields: 'Custom RSVP form builder',
  csvIn: 'CSV guest import',
  csvOut: 'Guest export (CSV)',
  seating: 'Seating chart designer',
  tables: 'Table management',
  branding: 'Custom themes & branding',
  sms: 'Text messaging',
  qr: 'QR code check-in',
  manualCheckin: 'Manual check-in',
  checkinApp: 'Fancy Check-in app (offline door scanner)',
  excel: 'Guest export (Excel)',
  watermark: 'Remove Fancy watermark',
  analyticsPro: 'Real-time analytics & reports',
  priority: 'Priority email & chat support',
  whiteLabel: 'White-label solution',
  dedicated: 'Dedicated account manager',
  integrations: 'All integrations',
  api: 'Custom integrations & API',
  sso: 'SSO & team management',
  security: 'Advanced security & compliance',
};

const ESSENTIAL = [F.rsvpBasic, F.analytics, F.email, F.community, F.manualGuest];
const SIGNATURE = [...ESSENTIAL, F.customFields, F.csvIn, F.csvOut, F.seating, F.tables, F.branding, F.sms];
const ENTERPRISE = [...SIGNATURE, F.qr, F.manualCheckin, F.checkinApp, F.excel, F.watermark, F.analyticsPro, F.priority];
const BESPOKE = [...ENTERPRISE, F.whiteLabel, F.dedicated, F.integrations, F.api, F.sso, F.security];

const TIERS = [
  { name: 'Essential', price_cents: 9900, currency: 'USD', max_guests: 100, is_custom: false, description: 'For an intimate celebration', features: ESSENTIAL },
  /* `recommended`, not `popular` — that is the field the page reads to
     highlight a card and print its "Most Popular" badge. Mocking the wrong
     name renders four identical cards and hides the design being judged. */
  { name: 'Signature', price_cents: 24900, currency: 'USD', max_guests: 300, is_custom: false, recommended: true, description: 'The one most couples choose', features: SIGNATURE },
  { name: 'Enterprise', price_cents: 59900, currency: 'USD', max_guests: 1000, is_custom: false, description: 'For a large or multi-day event', features: ENTERPRISE },
  { name: 'Bespoke', price_cents: null, currency: 'USD', max_guests: null, is_custom: true, description: 'Built around your event', features: BESPOKE },
];

vi.mock('../../src/app/utils/usePublicPricing', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, usePublicPricing: () => ({ tiers: TIERS, error: null }) };
});

import PricingPage from '../../src/app/pricing/page';

const ROOT = process.cwd();
const OUT = path.join(ROOT, '..', '.visual', 'pricing');
const GLOBALS = fs.readFileSync(path.join(ROOT, 'src/app/globals.css'), 'utf8');

/* THE REAL globals.css, inlined verbatim.

   A hand-picked subset was tried first and it lied: `.btn-gold` lives in
   globals.css, was not in the subset, and every call-to-action on the page
   rendered as a blue underlined link — a "bug" that does not exist in the
   product. A harness that can invent defects is worse than no harness.

   The file is Tailwind v4 source, so its `@theme` / `@apply` at-rules mean
   nothing to a browser and are skipped. That is fine: this page's layout
   comes from the plain `:root` custom properties, the `.fx-*` primitives and
   the `.btn-*` rules, all of which are ordinary CSS below those at-rules.
   The small block after it only supplies what next/font would. */
const REAL = GLOBALS;

/* THE REAL TYPEFACES — this used to declare Georgia and Segoe UI.

   next/font SELF-HOSTS: every face is already sitting in .next/static/media,
   and the @font-face rules that point at them are in the BUILT css (not in
   globals.css, which is what this probe otherwise reads). So the fonts were
   available the whole time and this shim was overriding them with two the
   product does not use.

   That matters more than it sounds. --font-serif is ABORETO, a capitals-only
   face with a single weight; Georgia is neither. Every pricing screenshot ever
   taken here was of a page set in the wrong type, which is not a page anyone
   can judge. Same defect as landingPageProbe had, found the same way. */
function fontFaces() {
  const dir = path.join(ROOT, '.next/static/chunks');
  if (!fs.existsSync(dir)) throw new Error('No .next build. Run `npx next build` first.');
  const css = fs.readdirSync(dir).filter((f) => f.endsWith('.css'))
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');

  /* URL-ENCODED: this repo lives under "C:/Users/yousef amr/", and a raw space
     inside an unquoted CSS url() ends the token, so the rule parses as garbage
     and the font falls back silently — the exact failure this block removes. */
  const media = encodeURI(path.join(ROOT, '.next/static/media').split(path.sep).join('/'));
  const withFonts = css.replace(/url\(\.\.\/media\//g, `url(file:///${media}/`);
  if (!/@font-face\{font-family:Aboreto;/.test(withFonts)) {
    throw new Error('No Aboreto @font-face in the built CSS — the font pipeline moved.');
  }
  return withFonts.match(/@font-face\{[^}]*\}/g).join('\n');
}

/* next/font puts the family names on a generated class on <html>. The staged
   page has no such class, so var(--font-heading) would be UNDEFINED — and an
   invalid var() inside a font-family list invalidates the WHOLE declaration,
   dropping the page to the body sans. Declared verbatim from the built CSS. */
const FX = `
  :root {
    --font-heading: "Aboreto", "Aboreto Fallback";
    --font-body: "Google Sans";
    --font-cormorant: "Cormorant Garamond", "Cormorant Garamond Fallback";
    --font-playfair: "Playfair Display", "Playfair Display Fallback";
    --font-script: "Great Vibes", "Great Vibes Fallback";
  }
  html, body { margin: 0; padding: 0; }
`;

describe('pricing probe', () => {
  it('stages the page and a frame per width', async () => {
    let r;
    await act(async () => { r = render(<PricingPage />); });
    await act(async () => { await new Promise((res) => setTimeout(res, 80)); });

    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, 'page.html'),
      `<!doctype html><html lang="en"><head><meta charset="utf-8">
<style>${fontFaces()}</style><style>${REAL}</style><style>${FX}</style></head>
<body>${r.container.innerHTML}</body></html>`, 'utf8');

    /* Widths are shot through an IFRAME. Chrome on Windows will not open a
       window under ~500px, so --window-size=320 lays out at 500 and crops —
       which looks exactly like horizontal overflow and is not. */
    /* 440 is the iPhone 16 Pro Max, and its ABSENCE from this list is why the
       page shipped broken at that width: 390 and 768 both looked fine and
       nothing ever laid out in between them. 430 covers the 15/16 Plus. */
    for (const w of [320, 390, 430, 440, 768, 1280]) {
      fs.writeFileSync(path.join(OUT, `frame-${w}.html`),
        `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;background:#666;}
  iframe{display:block;width:${w}px;height:5200px;border:0;background:#fff;}
</style></head><body><iframe src="page.html" scrolling="no"></iframe></body></html>`, 'utf8');
    }

    // The measuring rig: reports anything crossing its viewport, plus the
    // ancestor chain, because an overflowing child is almost never the cause.
    fs.writeFileSync(path.join(OUT, 'probe.html'),
      `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;background:#111;color:#eee;font:12px/1.5 Consolas,monospace;}
  iframe{width:320px;height:5200px;border:0;position:absolute;left:-9999px;}
  pre{padding:10px;white-space:pre-wrap;}
</style></head><body>
<iframe id="f" src="page.html"></iframe><pre id="out">measuring…</pre>
<script>
document.getElementById('f').addEventListener('load', function () {
  var doc=this.contentDocument, win=this.contentWindow, VW=win.innerWidth, L=[];
  L.push('viewport '+VW+'   documentElement.scrollWidth '+doc.documentElement.scrollWidth);
  L.push('--- crossing the edge ---');
  var out=[];
  doc.querySelectorAll('*').forEach(function(el){
    var r=el.getBoundingClientRect();
    if(!r.width||!r.height) return;
    if(r.right<=VW+1 && r.left>=-1) return;
    var chain=[],p=el;
    while(p && p!==doc.body){
      var c=(typeof p.className==='string'?p.className:'').trim().split(/\\s+/).slice(0,2).join('.');
      chain.unshift(p.tagName.toLowerCase()+(c?'.'+c:'')+'['+Math.round(p.getBoundingClientRect().width)+']');
      p=p.parentElement;
    }
    out.push('  '+chain.slice(-4).join(' > ')+'  right=+'+Math.round(r.right-VW)
      +' text="'+(el.textContent||'').trim().replace(/\\s+/g,' ').slice(0,40)+'"');
  });
  L.push(out.length?out.slice(0,18).join('\\n'):'none');
  L.push('--- text under 11px ---');
  var tiny={};
  doc.querySelectorAll('*').forEach(function(el){
    if(el.children.length||!(el.textContent||'').trim()) return;
    var fs=parseFloat(win.getComputedStyle(el).fontSize);
    if(fs&&fs<11){ (tiny[fs+'px']=tiny[fs+'px']||[]).push((el.textContent||'').trim().slice(0,24)); }
  });
  var tk=Object.keys(tiny);
  L.push(tk.length?tk.map(function(k){return '  '+k+' — '+tiny[k].slice(0,3).join(' | ');}).join('\\n'):'none');
  document.getElementById('out').textContent=L.join('\\n');
});
</script></body></html>`, 'utf8');

    // eslint-disable-next-line no-console
    console.log('DUMP-LEN', r.container.innerHTML.length);
  });
});
