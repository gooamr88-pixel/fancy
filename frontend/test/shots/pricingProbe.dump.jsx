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

/* Four tiers with realistic names and long feature strings — the shapes that
   actually break a layout are long labels and many columns, not the tidy
   three-plan case. */
const TIERS = [
  { name: 'Essential', price_cents: 9900, currency: 'USD', max_guests: 100, is_custom: false, description: 'For an intimate celebration', features: ['Digital invitations', 'Real-time RSVP tracking', 'Guest list import from CSV', 'Email invitations'] },
  /* `recommended`, not `popular` — that is the field the page reads to
     highlight a card and print its "Most Popular" badge. Mocking the wrong
     name renders four identical cards and hides the design being judged. */
  { name: 'Signature', price_cents: 24900, currency: 'USD', max_guests: 300, is_custom: false, recommended: true, description: 'The one most couples choose', features: ['Everything in Essential', 'Seating chart & table plan', 'SMS invitations and reminders', 'Custom colours and typography', 'Multi-day schedule'] },
  { name: 'Enterprise', price_cents: 59900, currency: 'USD', max_guests: 1000, is_custom: false, description: 'For a large or multi-day event', features: ['Everything in Signature', 'Fancy Check-in app (offline door scanner)', 'Dedicated onboarding session', 'Priority support'] },
  { name: 'Bespoke', price_cents: null, currency: 'USD', max_guests: null, is_custom: true, description: 'Built around your event', features: ['Everything in Enterprise', 'Custom integrations', 'On-site support'] },
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

/* Only what next/font supplies at runtime and globals.css therefore assumes.
   Everything else — the tokens, .fx-*, .btn-* — comes from the real file
   above, and must NOT be restated here or the shim silently wins. */
const FX = `
  :root { --font-serif: Georgia; --font-sans: 'Segoe UI'; }
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
<style>${REAL}</style><style>${FX}</style></head>
<body>${r.container.innerHTML}</body></html>`, 'utf8');

    /* Widths are shot through an IFRAME. Chrome on Windows will not open a
       window under ~500px, so --window-size=320 lays out at 500 and crops —
       which looks exactly like horizontal overflow and is not. */
    for (const w of [320, 390, 768, 1280]) {
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
