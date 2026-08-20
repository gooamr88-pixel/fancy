/* Renders the Printed Invitations catalogue and one product page so their
   real layout can be LOOKED AT and MEASURED rather than assumed. Staged
   output + per-width iframe wrappers land in .visual/printed/. Run with:
     npx vitest run --config vitest.shots.config.mjs test/shots/printedInvitationsProbe.dump.jsx */
import React from 'react';
import { describe, it, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(''), usePathname: () => '/printed-invitations' }));

/* The catalogue half of this probe is gone: ShopClient was deleted in the
   /shop rebuild, and its successor is staged by shopBrowseProbe.dump.jsx.
   What remains here is the PRODUCT page, which still has its own component.

   This file broke silently when that happened — the shots probes run under
   vitest.shots.config.mjs, which the ordinary `npx vitest run` does not
   include, so a suite reporting 467 green said nothing about it. */
import ProductClient from '../../src/app/shop/[category]/[slug]/ProductClient';

const ROOT = process.cwd();
const OUT = path.join(ROOT, '..', '.visual', 'printed');
const GLOBALS = fs.readFileSync(path.join(ROOT, 'src/app/globals.css'), 'utf8');

/* Only what next/font supplies at runtime; everything else — the tokens and
   the .fx-* primitives — comes from the real globals.css above. */
const FX = `
  :root { --font-serif: Georgia; --font-sans: 'Segoe UI'; --font-script: 'Segoe Script'; }
  html, body { margin: 0; padding: 0; }
`;

/* Stand-in photographs. Real CDN images cannot load here, and an empty <img>
   collapses the 4:5 frame the whole grid is built on — which would make the
   layout look tidier than it is. These are the right shape and weight. */
const photo = (bg, fg, label) => `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="600">
     <rect width="480" height="600" fill="${bg}"/>
     <rect x="60" y="90" width="360" height="420" fill="none" stroke="${fg}" stroke-width="3"/>
     <text x="240" y="310" font-family="Georgia" font-size="34" fill="${fg}" text-anchor="middle">${label}</text>
   </svg>`,
)}`;

const BADGE_NEW = { id: 'b1', label: 'New', bg_color: '#8A6D34', text_color: '#FFFFFF', is_filterable: true, sort_order: 0 };
const BADGE_BEST = { id: 'b2', label: 'Best seller', bg_color: '#191B1E', text_color: '#F8F4EC', is_filterable: true, sort_order: 1 };
const BADGE_LTD = { id: 'b3', label: 'Limited run', bg_color: '#7A2E2E', text_color: '#FFFFFF', is_filterable: true, sort_order: 2 };

const CATEGORIES = [
  { id: 'c1', name: 'Wedding', slug: 'wedding', sort_order: 0 },
  { id: 'c2', name: 'Graduation', slug: 'graduation', sort_order: 1 },
  { id: 'c3', name: 'Corporate & milestone', slug: 'corporate', sort_order: 2 },
];

/* Deliberately awkward content: a very long title, a quote-only price, a
   sold-out piece and a card with no photograph at all. Tidy data hides the
   cases that actually break a grid. */
const PRODUCTS = [
  {
    id: 'p1', title: 'Velvet & Gold Wedding Suite', slug: 'velvet-gold-wedding-suite',
    tagline: 'Gold foil on 350gsm cotton board, with a hand-tied silk ribbon',
    category_id: 'c1', price_cents: 899, currency: 'USD', price_unit: 'per card',
    min_order_qty: 50, is_featured: true, is_sold_out: false, sort_order: 0,
    published_at: '2026-08-10T00:00:00Z',
    images: [{ id: 'i1', url: photo('#F3ECDD', '#8A6D34', 'Velvet &amp; Gold'), alt: 'Front' }],
    badges: [BADGE_NEW],
  },
  {
    id: 'p2', title: 'Personalised Acrylic Graduation Plaque with Engraved Monogram',
    slug: 'acrylic-graduation-plaque',
    tagline: 'Laser-engraved acrylic, presented in a velvet box',
    category_id: 'c2', price_cents: 2499, compare_at_cents: 3200, currency: 'USD', price_unit: 'each',
    min_order_qty: null, is_featured: false, is_sold_out: false, sort_order: 1,
    published_at: '2026-08-05T00:00:00Z',
    images: [{ id: 'i2', url: photo('#EDEDF2', '#2E2E38', 'Acrylic') }],
    badges: [BADGE_BEST, BADGE_NEW],
  },
  {
    id: 'p3', title: 'Door of Joy Letterpress Card', slug: 'door-of-joy-letterpress',
    tagline: 'Deep-impression letterpress, hand-fed one at a time',
    category_id: 'c1', price_cents: null, currency: 'USD', price_unit: null,
    min_order_qty: 100, is_featured: false, is_sold_out: false, sort_order: 2,
    published_at: '2026-07-28T00:00:00Z',
    images: [{ id: 'i3', url: photo('#E8E0D2', '#6B4E2A', 'Door of Joy') }],
    badges: [BADGE_LTD],
  },
  {
    id: 'p4', title: 'Swan Lake Vellum Overlay', slug: 'swan-lake-vellum',
    tagline: 'Translucent vellum over a pressed cotton base',
    category_id: 'c1', price_cents: 1250, currency: 'USD', price_unit: 'per card',
    min_order_qty: 25, is_featured: false, is_sold_out: true, sort_order: 3,
    published_at: '2026-07-20T00:00:00Z',
    images: [{ id: 'i4', url: photo('#F7F4EF', '#9A8E7A', 'Swan Lake') }],
    badges: [],
  },
  {
    id: 'p5', title: 'Corporate Gala Menu Card', slug: 'corporate-gala-menu',
    tagline: 'Foil-blocked menus and place cards to match',
    category_id: 'c3', price_cents: 450, currency: 'USD', price_unit: 'per card',
    min_order_qty: 200, is_featured: false, is_sold_out: false, sort_order: 4,
    published_at: '2026-07-10T00:00:00Z',
    images: [], // no photograph — the placeholder monogram path
    badges: [],
  },
];

const SETTINGS = {
  enabled: true, show_on_homepage: true, show_in_dashboard: true,
  // The real ordering number, as seeded by the migration: +1 (619) 666-6620
  // stored digits-only. Kept in sync so a staged screenshot shows the link
  // that actually ships.
  whatsapp_number: '16196666620',
  whatsapp_greeting: 'Hello! I would like to order printed invitations.',
  hero_kicker: 'HANDCRAFTED · PRINTED · DELIVERED',
  hero_title: 'Printed Invitations',
  hero_subtitle: 'Invitations your guests can hold. Pressed, foiled and finished by hand, then delivered to your door.',
  default_lead_time: 'Standard production lead time: 3–4 weeks',
  default_sort: 'manual',
};

const DETAIL = {
  ...PRODUCTS[0],
  description: 'Each suite is printed on 350gsm cotton board and stamped with real gold foil, one card at a time.\n\nThe ribbon is tied by hand, and the wording is set for your event — names, dates and language are yours, not a template.',
  highlights: ['Real gold foil stamping', 'Hand-tied silk ribbon', 'Digital proof before printing', 'Envelopes and guest addressing available'],
  specs: [
    { label: 'Material', value: '350gsm cotton board' },
    { label: 'Size', value: '5" × 7" (127 × 178mm)' },
    { label: 'Printing', value: 'Gold foil stamping + letterpress' },
    { label: 'Finishing', value: 'Hand-tied silk ribbon, deckled edge' },
  ],
  lead_time_text: 'Standard production lead time: 3–4 weeks',
  images: [
    { id: 'i1', url: photo('#F3ECDD', '#8A6D34', 'Front'), alt: 'Front of the suite' },
    { id: 'i2', url: photo('#EDE4D0', '#8A6D34', 'Back'), alt: 'Back of the suite' },
    { id: 'i3', url: photo('#E7DCC4', '#6B4E2A', 'Detail'), alt: 'Foil detail' },
  ],
};

function stage(name, html) {
  fs.writeFileSync(path.join(OUT, `${name}.html`),
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<style>${GLOBALS}</style><style>${FX}</style></head>
<body>${html}</body></html>`, 'utf8');

  for (const w of [390, 768, 1280]) {
    fs.writeFileSync(path.join(OUT, `${name}-${w}.html`),
      `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;background:#666;}
  iframe{display:block;width:${w}px;height:4600px;border:0;background:#fff;}
</style></head><body><iframe src="${name}.html" scrolling="no"></iframe></body></html>`, 'utf8');
  }
}

/* The measuring rig — reports anything crossing the viewport edge, with the
   ancestor chain, because an overflowing child is almost never the cause. */
function probe(name, width) {
  fs.writeFileSync(path.join(OUT, `probe-${name}-${width}.html`),
    `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;background:#111;color:#eee;font:12px/1.5 Consolas,monospace;}
  iframe{width:${width}px;height:4600px;border:0;position:absolute;left:-9999px;}
  pre{padding:10px;white-space:pre-wrap;}
</style></head><body>
<iframe id="f" src="${name}.html"></iframe><pre id="out">measuring…</pre>
<script>
document.getElementById('f').addEventListener('load', function () {
  var doc=this.contentDocument, win=this.contentWindow, VW=win.innerWidth, L=[];
  L.push('${name} @ '+VW+'   documentElement.scrollWidth '+doc.documentElement.scrollWidth);
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
  L.push('--- tap targets under 44px ---');
  var small=[];
  doc.querySelectorAll('a,button,select').forEach(function(el){
    var r=el.getBoundingClientRect();
    if(!r.width||!r.height) return;
    if(r.height<44) small.push('  '+el.tagName.toLowerCase()+' '+Math.round(r.height)+'px "'+(el.textContent||'').trim().slice(0,26)+'"');
  });
  L.push(small.length?small.slice(0,12).join('\\n'):'none');
  L.push('--- text under 11px ---');
  var tiny={};
  doc.querySelectorAll('*').forEach(function(el){
    if(el.children.length||!(el.textContent||'').trim()) return;
    var f=parseFloat(win.getComputedStyle(el).fontSize);
    if(f&&f<11){ (tiny[f+'px']=tiny[f+'px']||[]).push((el.textContent||'').trim().slice(0,24)); }
  });
  var tk=Object.keys(tiny);
  L.push(tk.length?tk.map(function(k){return '  '+k+' — '+tiny[k].slice(0,3).join(' | ');}).join('\\n'):'none');
  document.getElementById('out').textContent=L.join('\\n');
});
</script></body></html>`, 'utf8');
}

describe('printed invitations probe', () => {
  it('stages a product page', async () => {
    fs.mkdirSync(OUT, { recursive: true });

    let det;
    await act(async () => {
      det = render(
        <ProductClient product={DETAIL} related={PRODUCTS.slice(1, 4)} settings={SETTINGS} />,
      );
    });
    await act(async () => { await new Promise((r) => setTimeout(r, 60)); });
    stage('product', det.container.innerHTML);

    // 440 is the iPhone 16 Pro Max — the width the pricing page shipped broken
    // at, because nothing ever rendered between 390 and 768.
    [['product', 390], ['product', 440], ['product', 1280]].forEach(([n, w]) => probe(n, w));

    // eslint-disable-next-line no-console
    console.log('DUMP-LEN product', det.container.innerHTML.length);
  });
});
