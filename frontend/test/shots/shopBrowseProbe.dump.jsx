/* Renders /shop's browse surface so it can be LOOKED AT rather than assumed.
   Staged output + per-width frames land in .visual/shop/.
     npx vitest run --config vitest.shots.config.mjs test/shots/shopBrowseProbe.dump.jsx */
import React from 'react';
import { describe, it, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(''), usePathname: () => '/shop' }));

import ShopBrowse from '../../src/app/shop/ShopBrowse';

const ROOT = process.cwd();
const OUT = path.join(ROOT, '..', '.visual', 'shop');
const GLOBALS = fs.readFileSync(path.join(ROOT, 'src/app/globals.css'), 'utf8');

/* The REAL typefaces. next/font self-hosts into .next/static/media and writes
   the @font-face src relative to the chunks folder, so a staged page has to
   rewrite those URLs — without this the page renders in a fallback and any
   judgement made from the screenshot is about type the product does not use. */
function fontFaces() {
  const dir = path.join(ROOT, '.next/static/chunks');
  if (!fs.existsSync(dir)) throw new Error('No .next build. Run `npx next build` first.');
  const css = fs.readdirSync(dir).filter((f) => f.endsWith('.css'))
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  const media = encodeURI(path.join(ROOT, '.next/static/media').split(path.sep).join('/'));
  const withFonts = css.replace(/url\(\.\.\/media\//g, `url(file:///${media}/`);
  if (!/@font-face\{font-family:Aboreto;/.test(withFonts)) {
    throw new Error('No Aboreto @font-face in the built CSS — the font pipeline moved.');
  }
  return withFonts.match(/@font-face\{[^}]*\}/g).join('\n');
}

/* next/font puts the family names on a class on <html>; the staged page has no
   such class, and an invalid var() inside a font-family list invalidates the
   WHOLE declaration. Declared verbatim from the built CSS. */
const VARS = `
  :root {
    --font-heading: "Aboreto", "Aboreto Fallback";
    --font-body: "Google Sans";
    --font-cormorant: "Cormorant Garamond", "Cormorant Garamond Fallback";
  }
  html, body { margin: 0; padding: 0; }
`;

/* A stand-in photograph, so the category plate's PHOTOGRAPH face renders here
   too. The catalogue in this repo has no uploaded images, and a probe that can
   only ever show the drawn face proves nothing about the one a real shop sees:
   the scrim, the inverted ink and the frame over an image are exactly where
   that face can go wrong. */
const PHOTO = (a, b) => `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">`
  + `<defs><linearGradient id="g" x1="0" y1="0" x2="0.8" y2="1">`
  + `<stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>`
  + `<rect width="400" height="400" fill="url(#g)"/>`
  + `<rect x="130" y="70" width="140" height="230" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="3"/>`
  + `</svg>`,
)}`;

/* FOUR OF SIX CARRY A COVER, DELIBERATELY.

   `shop_categories.cover_image_url` is set by an admin, so a real shop will
   always be part-way through photographing its shelves — and the two faces
   have to read as one set while that is true. A probe where every plate is a
   photograph, or none is, cannot show that. It also has to show BOTH faces in
   the shelf index and in the filter's Collections group, which is where the
   old design swapped a photograph for a drawing on selection. */
const CATS = [
  { id: 'c1', name: 'Wedding cards', slug: 'wedding-cards', description: 'Foiled, letterpressed and embossed.', sort_order: 10, cover_image_url: PHOTO('#B99A63', '#5C4A2C'), cover_image_alt: '' },
  { id: 'c2', name: 'Screens & displays', slug: 'screens-displays', description: 'Welcome screens and seating displays.', sort_order: 20, cover_image_url: PHOTO('#6E7B72', '#2C332F'), cover_image_alt: '' },
  { id: 'c3', name: 'Scanners & door kit', slug: 'scanners-door', description: 'Handheld scanners and tablet kits.', sort_order: 30 },
  { id: 'c4', name: 'Printed materials', slug: 'printed-materials', description: 'Menus, place cards, table numbers.', sort_order: 40, cover_image_url: PHOTO('#A98A4E', '#3B2F1C'), cover_image_alt: '' },
  { id: 'c5', name: 'Signage', slug: 'signage', description: 'Seating charts and welcome signs.', sort_order: 50 },
  { id: 'c6', name: 'Envelopes & extras', slug: 'envelopes-extras', description: 'Envelopes, seals, ribbon.', sort_order: 60, cover_image_url: PHOTO('#8E7A66', '#33291F'), cover_image_alt: '' },
];

const B_NEW = { id: 'b1', label: 'New', bg_color: '#F6F2E9', text_color: '#8A6D34', is_filterable: true, sort_order: 0 };
const B_BEST = { id: 'b2', label: 'Bestseller', bg_color: '#F6F2E9', text_color: '#8A6D34', is_filterable: true, sort_order: 1 };

/* Long titles and a quoted price on purpose: the shapes that break a dense
   grid are a two-line name and a missing number, not the tidy case. */
const P = (id, title, cat, cents, unit, over = {}) => ({
  id,
  title,
  slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  tagline: over.tagline || '320gsm cotton · Gold foil',
  category_id: cat,
  price_cents: cents,
  compare_at_cents: over.was || null,
  currency: 'USD',
  price_unit: unit,
  min_order_qty: over.moq ?? 100,
  lead_time_text: over.lead || '5 days',
  is_featured: over.featured || false,
  is_sold_out: over.sold || false,
  sort_order: over.sort ?? 0,
  images: over.photo ? [{ id: `${id}-img`, url: over.photo, alt: null }] : [],
  badges: over.badges || [],
});

const PRODUCTS = [
  P('p1', 'Velvet Ring — foiled card', 'c1', 185, 'each', {
    was: 220, badges: [B_BEST], featured: true, photo: PHOTO('#E7DBC6', '#8C7A5E'),
  }),
  P('p2', 'Swan Lake — letterpress', 'c1', 240, 'each', { lead: '7 days' }),
  P('p3', 'Door of Joy — gold foil', 'c1', 210, 'each', {}),
  P('p4', 'Carved-door invitation box with a deliberately long name', 'c1', 640, 'per box', { lead: '12 days' }),
  P('p5', 'Save-the-date card', 'c1', 95, 'each', { badges: [B_NEW] }),
  P('p6', 'Olive wax-sealed envelope', 'c6', 95, 'per envelope', { photo: PHOTO('#DCD8C4', '#6E7358') }),
  P('p7', '43" welcome screen', 'c2', 78000, 'per unit', { moq: 1, lead: '10 days' }),
  P('p8', 'Handheld QR scanner', 'c3', 21000, 'per unit', { moq: 1, badges: [B_NEW] }),
  P('p9', 'Bespoke foil plate', 'c1', null, null, { tagline: 'Made to your monogram' }),
  P('p10', 'Menu cards — cotton stock', 'c4', 90, 'each', {}),
  P('p11', 'Seating chart poster', 'c5', 4800, 'per poster', { moq: 1, sold: true }),
  P('p12', 'Place cards — folded', 'c4', 65, 'each', {}),
];

const SETTINGS = { enabled: true, whatsapp_number: '19055550134', hero_title: 'Shop' };

describe('shop browse probe', () => {
  it('stages the shop home and one category at both widths', async () => {
    fs.mkdirSync(OUT, { recursive: true });

    const stage = (name, node) => {
      let r;
      act(() => { r = render(node); });
      fs.writeFileSync(path.join(OUT, `${name}.html`),
        `<!doctype html><html lang="en"><head><meta charset="utf-8">
<style>${fontFaces()}</style><style>${GLOBALS}</style><style>${VARS}</style></head>
<body>${r.container.innerHTML}</body></html>`, 'utf8');
      r.unmount();
    };

    stage('home', (
      <ShopBrowse products={PRODUCTS} categories={CATS} badges={[B_NEW, B_BEST]} settings={SETTINGS} category={null} />
    ));
    stage('category', (
      <ShopBrowse products={PRODUCTS} categories={CATS} badges={[B_NEW, B_BEST]} settings={SETTINGS} category="wedding-cards" />
    ));

    /* Shot through an IFRAME: Chrome on Windows will not open a window under
       ~500px, so --window-size=390 lays out at 500 and crops, which looks
       exactly like horizontal overflow and is not. 440 is the iPhone 16 Pro
       Max, the width the pricing page shipped broken at because nothing ever
       rendered between 390 and 768. */
    for (const page of ['home', 'category']) {
      /* 1024 is not decoration: it is the exact width the plate row switches
         from a scrolling strip to a six-up grid, and the width where a
         --fx-col chosen for 1280 quietly drops to five and orphans a shelf. */
      for (const w of [390, 440, 1024, 1280]) {
        fs.writeFileSync(path.join(OUT, `frame-${page}-${w}.html`),
          `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;background:#666;}
  iframe{display:block;width:${w}px;height:4200px;border:0;background:#FCFBF8;}
</style></head><body><iframe src="${page}.html" scrolling="no"></iframe></body></html>`, 'utf8');
      }
    }
  });
});
