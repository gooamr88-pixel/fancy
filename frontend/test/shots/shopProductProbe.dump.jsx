/* Renders one product page so its GALLERY can be looked at.

   Written because the arrows for stepping through a piece's photographs were
   reported broken and turned out not to exist — and nothing in the shots
   harness had ever rendered this page, so no screenshot could have shown that.

     npx vitest run --config vitest.shots.config.mjs test/shots/shopProductProbe.dump.jsx

   then photograph .visual/shop-product/frame-<width>.html. */
import React from 'react';
import { describe, it, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(''), usePathname: () => '/shop' }));

import ProductClient from '../../src/app/shop/[category]/[slug]/ProductClient';

const ROOT = process.cwd();
const OUT = path.join(ROOT, '..', '.visual', 'shop-product');
const GLOBALS = fs.readFileSync(path.join(ROOT, 'src/app/globals.css'), 'utf8');

/* See shopBrowseProbe for why the real faces matter: --font-cormorant is a
   different face from the body sans, and judging type that the product does
   not use is judging nothing. */
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

const VARS = `
  :root {
    --font-heading: "Aboreto", "Aboreto Fallback";
    --font-body: "Google Sans";
    --font-cormorant: "Cormorant Garamond", "Cormorant Garamond Fallback";
    --font-script: "Great Vibes", "Great Vibes Fallback";
  }
  html, body { margin: 0; padding: 0; }
`;

/** A stand-in photograph, numbered so stepping between them is visible. */
const SHOT = (n, a, b) => ({
  id: `i${n}`,
  alt: `Angle ${n}`,
  url: `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500">`
    + `<defs><linearGradient id="g" x1="0" y1="0" x2="0.7" y2="1">`
    + `<stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>`
    + `<rect width="400" height="500" fill="url(#g)"/>`
    + `<text x="200" y="270" font-size="130" fill="rgba(255,255,255,.55)" text-anchor="middle" font-family="Georgia">${n}</text>`
    + `</svg>`,
  )}`,
});

const PRODUCT = {
  id: 'p1',
  title: 'Velvet Ring — foiled invitation',
  slug: 'velvet-ring-foiled-invitation',
  tagline: '320gsm cotton · Gold foil · Hand-fed press',
  category: { id: 'c1', name: 'Wedding cards', slug: 'wedding-cards' },
  price_cents: 185,
  compare_at_cents: 220,
  currency: 'USD',
  price_unit: 'card',
  min_order_qty: 100,
  lead_time_text: 'Standard production lead time: 3–4 weeks',
  description: 'A velvet ring box on a darkened stage.\n\nPressed and foiled by hand, then delivered to your door.',
  specs: [{ label: 'Material', value: '320gsm cotton board' }, { label: 'Finish', value: 'Gold foil' }],
  highlights: ['Gold foil stamping', 'Laser-engraved monogram'],
  images: [SHOT(1, '#E7DBC6', '#8C7A5E'), SHOT(2, '#DCD8C4', '#6E7358'), SHOT(3, '#EFE3D2', '#A08A63')],
  badges: [{ id: 'b1', label: 'Bestseller', bg_color: '#F6F2E9', text_color: '#8A6D34' }],
};

const SETTINGS = { enabled: true, whatsapp_number: '19055550134', whatsapp_greeting: 'Hello!' };

describe('shop product probe', () => {
  it('stages one product page at both widths', async () => {
    fs.mkdirSync(OUT, { recursive: true });

    let r;
    await act(async () => {
      r = render(<ProductClient product={PRODUCT} related={[]} settings={SETTINGS} />);
    });

    fs.writeFileSync(path.join(OUT, 'page.html'),
      `<!doctype html><html lang="en"><head><meta charset="utf-8">
<style>${fontFaces()}</style><style>${GLOBALS}</style><style>${VARS}</style></head>
<body>${r.container.innerHTML}</body></html>`, 'utf8');

    /* Through an IFRAME: Chrome on Windows will not open a window under ~500px,
       so --window-size=390 lays out at 500 and crops, which looks exactly like
       horizontal overflow and is not. */
    for (const w of [390, 1280]) {
      fs.writeFileSync(path.join(OUT, `frame-${w}.html`),
        `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;background:#666;}
  iframe{display:block;width:${w}px;height:3200px;border:0;background:#fff;}
</style></head><body><iframe src="page.html" scrolling="no"></iframe></body></html>`, 'utf8');
    }
  });
});
