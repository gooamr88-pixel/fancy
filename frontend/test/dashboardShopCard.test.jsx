import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE STUDIO CARD ON THE ORGANIZER'S OVERVIEW.
 *
 * Two things were wrong with it, and they were the same thing twice:
 *
 *   • It was headed "Printed invitations for this event" and showed three
 *     featured PRODUCTS. The catalogue stopped being print-only in August — it
 *     carries menus, signage, welcome screens and door scanners — so the
 *     heading described a sixth of what is for sale, and an organizer who
 *     needed table numbers read it and concluded we do not sell them.
 *   • Every product link was a 404. It built `/shop/<product-slug>`, which the
 *     router resolves against `/shop/[category]` — the same bug the catalogue's
 *     "You may also like" rail had, on a surface no test rendered.
 *
 * The card now shows the COLLECTIONS, which are the range, are named by the
 * admin rather than hardcoded here, and do not go stale when the catalogue is
 * re-ordered.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const SETTINGS = {
  enabled: true,
  whatsapp_number: '19055550134',
  whatsapp_greeting: 'Hello! I would like to order printed invitations.',
  show_in_dashboard: true,
};

const CATS = [
  { id: 'c-inv', name: 'Invitations', slug: 'invitations', cover_image_url: '/covers/inv.jpg', cover_image_alt: 'A card', sort_order: 0 },
  { id: 'c-sign', name: 'Signage', slug: 'signage', cover_image_url: null, cover_image_alt: null, sort_order: 1 },
  { id: 'c-empty', name: 'Screens', slug: 'screens', cover_image_url: null, sort_order: 2 },
];

const PRODUCTS = [
  { id: 'p1', title: 'Velvet Suite', slug: 'velvet-suite', category_id: 'c-inv', price_cents: 899, price_unit: 'per card', is_featured: true, sort_order: 0, images: [{ url: '/a.jpg', alt: 'A' }] },
  { id: 'p2', title: 'Welcome Board', slug: 'welcome-board', category_id: 'c-sign', price_cents: null, sort_order: 1, images: [] },
  { id: 'p3', title: 'Table Numbers', slug: 'table-numbers', category_id: 'c-sign', price_cents: 400, sort_order: 2, images: [] },
];

/** The payload /public/shop will answer with for the next render. */
let SHOP = {};

vi.mock('../src/app/utils/apiClient', () => ({
  apiFetch: vi.fn(async (route) => {
    if (route === '/public/shop') {
      if (SHOP.__throw) throw new Error('network');
      return SHOP;
    }
    return {};
  }),
}));

const { default: PrintedInvitationsCard } = await import('../src/app/dashboard/components/PrintedInvitationsCard');

const show = async (payload) => {
  SHOP = payload;
  const utils = render(<PrintedInvitationsCard />);
  // The card fetches on mount and renders nothing until it has an answer.
  await waitFor(() => {
    expect(document.querySelector('.pic') || SHOP.__silent).toBeTruthy();
  }).catch(() => {});
  return utils;
};

const live = (over = {}) => ({
  enabled: true, settings: SETTINGS, products: PRODUCTS, categories: CATS, ...over,
});

beforeEach(() => {
  SHOP = {};
  document.body.innerHTML = '';
});

describe('the collections it offers', () => {
  it('names the whole range, not just invitations', async () => {
    await show(live());
    await screen.findByText('Invitations');
    expect(screen.getByText('Signage')).toBeTruthy();

    // The heading must not narrow the catalogue back down to cards.
    const title = document.querySelector('.pic-title').textContent;
    expect(title).not.toMatch(/printed invitations/i);
  });

  it('links each collection at its own shelf', async () => {
    await show(live());
    const link = (await screen.findByText('Invitations')).closest('a');
    expect(link.getAttribute('href')).toBe('/shop/invitations');
  });

  it('counts the pieces on each shelf', async () => {
    await show(live());
    await screen.findByText('Invitations');
    const signage = [...document.querySelectorAll('.pic-item')]
      .find((el) => el.textContent.includes('Signage'));
    expect(signage.textContent).toMatch(/2 pieces/);
  });

  it('leaves out a collection with nothing published on it', async () => {
    // A shelf with no pieces is a link to an empty page, and "0 pieces" reads
    // as a broken catalogue rather than an empty one.
    await show(live());
    await screen.findByText('Invitations');
    expect(screen.queryByText('Screens')).toBeNull();
  });

  it('wears the cover the admin set, and draws its own when there is none', async () => {
    await show(live());
    const inv = (await screen.findByText('Invitations')).closest('a');
    expect(inv.querySelector('img').getAttribute('src')).toBe('/covers/inv.jpg');

    const sign = [...document.querySelectorAll('.pic-item')]
      .find((el) => el.textContent.includes('Signage'));
    expect(sign.querySelector('img')).toBeNull();
    // Its own drawing, from the catalogue's shared set — not a wordmark, which
    // made every uncovered shelf look like the same object.
    expect(sign.querySelector('.pic-noimg svg')).toBeTruthy();
  });

  it('draws an uncovered collection with the same mark the catalogue uses', async () => {
    // Imported from shopTheme, not redrawn here: a second set of drawings is a
    // second thing to keep in step, and the failure is silent — the dashboard
    // and the shop showing the organizer different faces for one collection.
    const { artFor } = await import('../src/app/shop/shopTheme');
    await show(live());
    await screen.findByText('Signage');
    const sign = [...document.querySelectorAll('.pic-item')]
      .find((el) => el.textContent.includes('Signage'));

    /* Compared on the path DATA, not on innerHTML: the DOM re-serializes
       `<rect …/>` as `<rect …></rect>`, so a string compare fails on the
       serializer rather than on the drawing. */
    const drawn = [...sign.querySelectorAll('.pic-noimg svg > *')]
      .map((el) => el.getAttribute('d') || el.getAttribute('x'));
    const expected = [...artFor('signage').matchAll(/(?:d|x)="([^"]+)"/g)].map((m) => m[1]);
    expect(drawn.length).toBeGreaterThan(0);
    expect(drawn).toEqual(expected);
  });

  it('sends the reader to the whole shop, not to a printed sub-section', async () => {
    await show(live());
    const all = await screen.findByText(/See the full shop/i);
    expect(all.closest('a').getAttribute('href')).toBe('/shop');
  });
});

describe('the product fallback', () => {
  /* A deployment whose shop_categories columns predate migration
     20260827000000 serves `categories: []` — getPublicShop logs it and carries
     on. The card must degrade to what it showed before rather than vanish: a
     card that disappears on a schema mismatch is how an outage goes unnoticed. */

  it('falls back to featured pieces when there are no collections', async () => {
    await show(live({ categories: [] }));
    expect(await screen.findByText('Velvet Suite')).toBeTruthy();
  });

  it('links a piece at a URL that exists', async () => {
    /* The 404. /shop/<piece> is ONE segment: the router reads it as a category
       slug, and an unknown category is a 404 — every product tap on this card
       was dead.

       "all" is the product route's own redirect segment (categorySlugOf falls
       back to it), so the reader lands on the piece and is forwarded to its
       real collection. It is the only correct answer here: this branch renders
       precisely when no collection resolved, so there is no real slug to use. */
    await show(live({ categories: [] }));
    const link = (await screen.findByText('Velvet Suite')).closest('a');
    expect(link.getAttribute('href')).toBe('/shop/all/velvet-suite');
  });

  it('never publishes a link containing undefined', async () => {
    await show(live({ categories: [], products: [{ ...PRODUCTS[0], category_id: null }] }));
    const link = (await screen.findByText('Velvet Suite')).closest('a');
    expect(link.getAttribute('href')).not.toContain('undefined');
    expect(link.getAttribute('href')).toBe('/shop/all/velvet-suite');
  });

  it('prefers collections whenever even one of them has a piece', async () => {
    // The products branch is a fallback, not an alternative — a single
    // populated shelf is a better answer than three cherry-picked cards.
    await show(live({ products: [PRODUCTS[0]], categories: [{ ...CATS[0] }] }));
    const link = (await screen.findByText('Invitations')).closest('a');
    expect(link.getAttribute('href')).toBe('/shop/invitations');
    expect(screen.queryByText('Velvet Suite')).toBeNull();
  });
});

describe('when it must not appear at all', () => {
  const gone = async (payload) => {
    SHOP = { ...payload, __silent: true };
    render(<PrintedInvitationsCard />);
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector('.pic')).toBeNull();
  };

  it('stays hidden when the shop is switched off', () => gone(live({ enabled: false })));

  it('stays hidden when the dashboard placement is switched off', () =>
    gone(live({ settings: { ...SETTINGS, show_in_dashboard: false } })));

  it('stays hidden when there is no WhatsApp number to reach', () =>
    gone(live({ settings: { ...SETTINGS, whatsapp_number: '' } })));

  it('stays hidden when the catalogue is empty', () =>
    gone(live({ products: [], categories: [] })));

  it('never surfaces a fetch error inside the dashboard', () =>
    gone({ __throw: true }));
});
