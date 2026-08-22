/* Renders the studio card as it sits on the organizer's overview, so it can be
   LOOKED AT rather than asserted about. Output lands in .visual/dashboard-shop/.
   Run with:
     npx vitest run --config vitest.shots.config.mjs test/shots/dashboardShopCardProbe.dump.jsx */
import React from 'react';
import { describe, it, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';

/* A realistic catalogue: four shelves with pieces on them, one covered and the
   rest on their drawn plate, plus an empty shelf that must not render. */
const CATEGORIES = [
  { id: 'c1', name: 'Invitations', slug: 'invitations', cover_image_url: '', cover_image_alt: 'A gold-foiled card', sort_order: 0 },
  { id: 'c2', name: 'Menus & place cards', slug: 'menus', cover_image_url: null, sort_order: 1 },
  { id: 'c3', name: 'Signage & welcome boards', slug: 'signage', cover_image_url: null, sort_order: 2 },
  { id: 'c4', name: 'Door scanners', slug: 'scanners', cover_image_url: null, sort_order: 3 },
  { id: 'c5', name: 'Coming soon', slug: 'coming-soon', cover_image_url: null, sort_order: 4 },
];

const p = (id, title, category_id, sort_order) => ({
  id, title, slug: title.toLowerCase().replace(/[^a-z]+/g, '-'),
  category_id, sort_order, price_cents: 899, currency: 'USD', price_unit: 'per card',
  is_featured: sort_order === 0, images: [],
});

const PRODUCTS = [
  p('p1', 'Velvet and Gold Suite', 'c1', 0),
  p('p2', 'Door of Joy Letterpress', 'c1', 1),
  p('p3', 'Vellum Menu Card', 'c2', 2),
  p('p4', 'Gilded Place Card', 'c2', 3),
  p('p5', 'Welcome Board', 'c3', 4),
  p('p6', 'Table Numbers', 'c3', 5),
  p('p7', 'Fancy Check-in Tablet', 'c4', 6),
];

const SETTINGS = {
  enabled: true, show_in_dashboard: true,
  whatsapp_number: '19055550134',
  whatsapp_greeting: 'Hello! I would like to order for my event.',
};

let PAYLOAD = { enabled: true, products: PRODUCTS, categories: CATEGORIES, settings: SETTINGS };

vi.mock('../../src/app/utils/apiClient', () => ({
  apiFetch: vi.fn(async (route) => (route === '/public/shop' ? PAYLOAD : {})),
}));

const { default: PrintedInvitationsCard } = await import('../../src/app/dashboard/components/PrintedInvitationsCard');

const ROOT = process.cwd();
const OUT = path.join(ROOT, '..', '.visual', 'dashboard-shop');
const GLOBALS = fs.readFileSync(path.join(ROOT, 'src/app/globals.css'), 'utf8');

/* Stands in for the dashboard shell: its ivory page ground and its gutter. The
   card is a white panel, so on a white page its border is the only thing
   separating it from the page and it looks unfinished for the wrong reason. */
const FX = `
  :root { --font-serif: Georgia; --font-sans: 'Segoe UI'; --font-script: 'Segoe Script'; }
  html, body { margin: 0; padding: 0; background: #F8F6F1; }
  body > div { padding: 24px; max-width: 1100px; margin: 0 auto; }
`;

function stage(name, html) {
  fs.writeFileSync(path.join(OUT, `${name}.html`),
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<style>${GLOBALS}</style><style>${FX}</style></head>
<body>${html}</body></html>`, 'utf8');
  for (const w of [390, 768, 1280]) {
    fs.writeFileSync(path.join(OUT, `${name}-${w}.html`),
      `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;background:#666;}
  iframe{display:block;width:${w}px;height:1200px;border:0;background:#F8F6F1;}
</style></head><body><iframe src="${name}.html" scrolling="no"></iframe></body></html>`, 'utf8');
  }
}

describe('dashboard studio card probe', () => {
  it('stages the collections view and the product fallback', async () => {
    fs.mkdirSync(OUT, { recursive: true });

    let r;
    await act(async () => { r = render(<PrintedInvitationsCard />); });
    await act(async () => { await new Promise((res) => setTimeout(res, 80)); });
    stage('collections', r.container.innerHTML);
    // eslint-disable-next-line no-console
    console.log('COLLECTIONS-LEN', r.container.innerHTML.length);
    r.unmount();

    /* The fallback a deployment gets when shop_categories predates migration
       20260827000000 — getPublicShop serves `categories: []` and logs it. It
       has to look deliberate, not broken. */
    PAYLOAD = { ...PAYLOAD, categories: [] };
    await act(async () => { r = render(<PrintedInvitationsCard />); });
    await act(async () => { await new Promise((res) => setTimeout(res, 80)); });
    stage('products-fallback', r.container.innerHTML);
    // eslint-disable-next-line no-console
    console.log('FALLBACK-LEN', r.container.innerHTML.length);
  }, 60000);
});
