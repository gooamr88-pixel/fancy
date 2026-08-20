/* Renders the Printed Invitations admin screen so it can be LOOKED AT — the
   control surface the whole feature is administered from. Output lands in
   .visual/shop-admin/. Run with:
     npx vitest run --config vitest.shots.config.mjs test/shots/shopAdminProbe.dump.jsx */
import React from 'react';
import { describe, it, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';

const PRODUCTS = [
  {
    id: 'p1', title: 'Velvet & Gold Wedding Suite', slug: 'velvet-gold-wedding-suite',
    category_id: 'c1', price_cents: 899, currency: 'USD', is_published: true, is_featured: true,
    is_sold_out: false, sort_order: 0, view_count: 412, inquiry_count: 18,
    images: [{ id: 'i1', image_url: '', alt_text: '' }],
    badges: [{ id: 'b1', label: 'New', bg_color: '#8A6D34', text_color: '#FFFFFF' }],
  },
  {
    id: 'p2', title: 'Personalised Acrylic Graduation Plaque', slug: 'acrylic-graduation-plaque',
    category_id: 'c2', price_cents: 2499, currency: 'USD', is_published: true, is_featured: false,
    is_sold_out: false, sort_order: 1, view_count: 233, inquiry_count: 31,
    images: [], badges: [
      { id: 'b2', label: 'Best seller', bg_color: '#191B1E', text_color: '#F8F4EC' },
      { id: 'b1', label: 'New', bg_color: '#8A6D34', text_color: '#FFFFFF' },
    ],
  },
  {
    id: 'p3', title: 'Door of Joy Letterpress Card', slug: 'door-of-joy-letterpress',
    category_id: 'c1', price_cents: null, currency: 'USD', is_published: false, is_featured: false,
    is_sold_out: false, sort_order: 2, view_count: 0, inquiry_count: 0,
    images: [], badges: [],
  },
  {
    id: 'p4', title: 'Swan Lake Vellum Overlay', slug: 'swan-lake-vellum',
    category_id: 'c1', price_cents: 1250, currency: 'USD', is_published: true, is_featured: false,
    is_sold_out: true, sort_order: 3, view_count: 88, inquiry_count: 4,
    images: [], badges: [],
  },
];

const CATEGORIES = [
  { id: 'c1', name: 'Wedding', slug: 'wedding', sort_order: 0, is_published: true },
  { id: 'c2', name: 'Graduation', slug: 'graduation', sort_order: 1, is_published: true },
  { id: 'c3', name: 'Corporate & milestone', slug: 'corporate', sort_order: 2, is_published: false },
];

const BADGES = [
  { id: 'b1', label: 'New', bg_color: '#8A6D34', text_color: '#FFFFFF', is_filterable: true, sort_order: 0, is_published: true },
  { id: 'b2', label: 'Best seller', bg_color: '#191B1E', text_color: '#F8F4EC', is_filterable: true, sort_order: 1, is_published: true },
  { id: 'b3', label: 'Limited run', bg_color: '#7A2E2E', text_color: '#FFFFFF', is_filterable: false, sort_order: 2, is_published: true },
];

const SETTINGS = {
  enabled: true, show_on_homepage: true, show_in_dashboard: true,
  whatsapp_number: '19055550134',
  whatsapp_greeting: 'Hello! I would like to order printed invitations.',
  hero_kicker: 'HANDCRAFTED · PRINTED · DELIVERED',
  hero_title: 'Printed Invitations',
  hero_subtitle: 'Invitations your guests can hold.',
  default_lead_time: 'Standard production lead time: 3–4 weeks',
  default_sort: 'manual',
};

vi.mock('../../src/app/admin/_lib/adminApi', () => ({
  default: {
    get: async (p) => {
      if (p === '/shop/products') return { products: PRODUCTS };
      if (p === '/shop/categories') return { categories: CATEGORIES };
      if (p === '/shop/badges') return { badges: BADGES };
      if (p === '/shop/settings') return { settings: SETTINGS };
      if (p === '/shop/inquiries') {
        return {
          summary: [
            { productId: 'p2', title: 'Personalised Acrylic Graduation Plaque', count: 31, lastAt: '2026-08-18T14:02:00Z' },
            { productId: 'p1', title: 'Velvet & Gold Wedding Suite', count: 18, lastAt: '2026-08-18T09:41:00Z' },
          ],
          inquiries: [], total: 49,
        };
      }
      return {};
    },
    post: async () => ({}), patch: async () => ({}), del: async () => ({}),
  },
}));

vi.mock('../../src/app/admin/_hooks/usePermissions', () => ({ default: () => ({ can: () => true }) }));
vi.mock('../../src/app/admin/_components/AlertContext', () => ({
  useAlert: () => ({ showAlert: () => {}, showConfirm: async () => true }),
}));

import ShopAdminPage from '../../src/app/admin/(panel)/shop/page';

const ROOT = process.cwd();
const OUT = path.join(ROOT, '..', '.visual', 'shop-admin');
const GLOBALS = fs.readFileSync(path.join(ROOT, 'src/app/globals.css'), 'utf8');
const FX = `
  :root { --font-serif: Georgia; --font-sans: 'Segoe UI'; --font-script: 'Segoe Script'; }
  html, body { margin: 0; padding: 0; background: var(--admin-bg, #FAFAF8); }
  /* Stands in for the admin shell's own page padding. */
  body > div { padding: 28px; }
`;

function stage(name, html) {
  fs.writeFileSync(path.join(OUT, `${name}.html`),
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<style>${GLOBALS}</style><style>${FX}</style></head>
<body>${html}</body></html>`, 'utf8');
  for (const w of [390, 1280]) {
    fs.writeFileSync(path.join(OUT, `${name}-${w}.html`),
      `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;background:#666;}
  iframe{display:block;width:${w}px;height:2400px;border:0;background:#FAFAF8;}
</style></head><body><iframe src="${name}.html" scrolling="no"></iframe></body></html>`, 'utf8');
  }
}

describe('shop admin probe', () => {
  it('stages the products tab and the settings tab', async () => {
    fs.mkdirSync(OUT, { recursive: true });

    let r;
    await act(async () => { r = render(<ShopAdminPage />); });
    await act(async () => { await new Promise((res) => setTimeout(res, 120)); });
    stage('products', r.container.innerHTML);

    // Settings is the tab that carries the WhatsApp number and the three
    // placement switches — the controls the whole section hangs off.
    const settingsTab = [...r.container.querySelectorAll('button')]
      .find((b) => b.textContent.trim() === 'Settings');
    await act(async () => { settingsTab.click(); });
    await act(async () => { await new Promise((res) => setTimeout(res, 120)); });
    stage('settings', r.container.innerHTML);

    // eslint-disable-next-line no-console
    console.log('DUMP-LEN', r.container.innerHTML.length);
    // 90s: this page mounts five tabs' worth of admin components (DataTable,
    // Modal and the whole editor form) and renders twice. It is a screenshot
    // staging run, not a test — a generous ceiling costs nothing here.
  }, 90000);
});
