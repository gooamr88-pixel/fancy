import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(''), usePathname: () => '/' }));

import ShopBrowse from '../src/app/shop/ShopBrowse';
import ProductClient from '../src/app/shop/[category]/[slug]/ProductClient';
import {
  formatPrice, priceLine, isShopLive, buildWhatsappUrl, sortProducts, SHOP_PATH, SITE_URL,
} from '../src/app/utils/shopLinks';

const ROOT = process.cwd();
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/* ═══════════════════════════════════════════════════════════════════════════
   PRINTED INVITATIONS — the physical cards, sold by conversation.

   The catalogue's whole reason for existing is that these cards are NOT sold
   through checkout: the CTA is a WhatsApp thread. Everything below guards one
   of the ways that quietly stops being true —

     • a price of "null" meaning "ask us", not "free";
     • a WhatsApp link that opens nothing because no number is configured;
     • admin-written labels ("New") that must both decorate and filter;
     • the admin's stored arrangement being the order visitors actually see.
   ═══════════════════════════════════════════════════════════════════════════ */

const SETTINGS = {
  enabled: true,
  whatsapp_number: '19055550134',
  whatsapp_greeting: 'Hello! I would like to order printed invitations.',
  hero_title: 'Printed Invitations',
  hero_subtitle: 'Invitations your guests can hold.',
  hero_kicker: 'HANDCRAFTED',
  default_lead_time: 'Standard production lead time: 3–4 weeks',
  default_sort: 'manual',
};

const BADGE_NEW = { id: 'b-new', label: 'New', bg_color: '#8A6D34', text_color: '#FFFFFF', is_filterable: true, sort_order: 0 };
const BADGE_HAND = { id: 'b-hand', label: 'Handmade', bg_color: '#191B1E', text_color: '#F8F4EC', is_filterable: true, sort_order: 1 };

const CAT_WEDDING = { id: 'c-wed', name: 'Wedding', slug: 'wedding', sort_order: 0 };
const CAT_GRAD = { id: 'c-grad', name: 'Graduation', slug: 'graduation', sort_order: 1 };

const product = (over = {}) => ({
  id: 'p1',
  title: 'Velvet & Gold Suite',
  slug: 'velvet-gold-suite',
  tagline: 'Gold-foiled on cotton board',
  category_id: CAT_WEDDING.id,
  price_cents: 899,
  currency: 'USD',
  price_unit: 'per card',
  min_order_qty: 50,
  is_featured: false,
  is_sold_out: false,
  sort_order: 0,
  published_at: '2026-08-01T00:00:00Z',
  images: [{ id: 'i1', url: 'https://cdn.example/a.jpg', alt: 'The suite' }],
  badges: [BADGE_NEW],
  ...over,
});

beforeEach(() => {
  // The WhatsApp beacon fires on click; without a stub jsdom logs a network error.
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));
});

/* ═══════════════════════════════════════════════════════════════════════════
   Price — null is a word, not a number
   ═══════════════════════════════════════════════════════════════════════════ */

describe('price', () => {
  it('renders a real price with its unit', () => {
    expect(priceLine(product({ price_cents: 899 }))).toBe('$8.99 per card');
  });

  it('renders a null price as "Price on request", never as zero', () => {
    expect(formatPrice(null)).toBeNull();
    expect(priceLine(product({ price_cents: null }))).toBe('Price on request');
    // The failure this guards: a card the studio quotes privately being
    // published as costing nothing.
    expect(priceLine(product({ price_cents: null }))).not.toMatch(/0\.00|\$0/);
  });

  it('still shows a price when the currency code is unknown', () => {
    // Intl.NumberFormat throws on a bad ISO code, and an admin can type any
    // three letters. A thrown formatter would blank the entire price rail.
    expect(formatPrice(1250, 'ZZZ')).toMatch(/12\.50/);
  });

  it('a zero price is a real free item and still renders as money', () => {
    expect(formatPrice(0)).toMatch(/\$0/);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   The WhatsApp link
   ═══════════════════════════════════════════════════════════════════════════ */

describe('whatsapp link', () => {
  it('builds a wa.me url carrying the product name and its page', () => {
    const url = buildWhatsappUrl({
      settings: SETTINGS,
      product: product({ category: CAT_WEDDING }),
    });
    expect(url.startsWith('https://wa.me/19055550134?text=')).toBe(true);
    const text = decodeURIComponent(url.split('text=')[1]);
    expect(text).toContain('Velvet & Gold Suite');
    // The CANONICAL origin, not window.location — a preview or staging host
    // would otherwise be pasted into a customer's chat and read days later.
    // And the CATEGORY-SCOPED path, which is where the product actually lives.
    expect(text).toContain(`${SITE_URL}/shop/wedding/velvet-gold-suite`);
    expect(SITE_URL).toBe('https://fancyrsvp.com');
  });

  it('falls back to the catalogue when the product has no category', () => {
    // Rather than pasting "/shop/undefined/velvet-gold-suite" into a chat a
    // customer opens days later.
    const url = buildWhatsappUrl({ settings: SETTINGS, product: product() });
    const text = decodeURIComponent(url.split('text=')[1]);
    expect(text).toContain(`${SITE_URL}/shop`);
    expect(text).not.toContain('undefined');
  });

  it('prefers the product override over the platform greeting', () => {
    const url = buildWhatsappUrl({
      settings: SETTINGS,
      product: product({ whatsapp_message: 'I want the gold one' }),
    });
    expect(decodeURIComponent(url)).toContain('I want the gold one');
  });

  it('returns null when no number is configured, rather than a dead wa.me/ link', () => {
    expect(buildWhatsappUrl({ settings: { ...SETTINGS, whatsapp_number: '' }, product: product() })).toBeNull();
    expect(isShopLive({ ...SETTINGS, whatsapp_number: '' })).toBe(false);
    expect(isShopLive({ ...SETTINGS, enabled: false })).toBe(false);
    expect(isShopLive(SETTINGS)).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Sorting — the admin's arrangement is the default
   ═══════════════════════════════════════════════════════════════════════════ */

describe('sorting', () => {
  const rows = [
    product({ id: 'a', title: 'A', sort_order: 2, price_cents: 500, published_at: '2026-01-01T00:00:00Z' }),
    product({ id: 'b', title: 'B', sort_order: 0, price_cents: 1500, published_at: '2026-06-01T00:00:00Z' }),
    product({ id: 'c', title: 'C', sort_order: 1, price_cents: null, published_at: '2026-03-01T00:00:00Z' }),
  ];

  it('manual sort follows the stored sort_order', () => {
    expect(sortProducts(rows, 'manual').map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });

  it('newest sort follows published_at', () => {
    expect(sortProducts(rows, 'newest').map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });

  it('quote-only pieces sort last in BOTH price directions', () => {
    // Treating null as 0 would float "Price on request" to the top of
    // "low to high", which reads as a bug rather than a choice.
    expect(sortProducts(rows, 'price_asc').map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(sortProducts(rows, 'price_desc').map((r) => r.id)).toEqual(['b', 'a', 'c']);
  });

  it('does not mutate the array it was given', () => {
    const original = [...rows];
    sortProducts(rows, 'price_asc');
    expect(rows).toEqual(original);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   The catalogue
   ═══════════════════════════════════════════════════════════════════════════ */

describe('catalogue', () => {
  const two = () => [
    product(),
    product({
      id: 'p2',
      title: 'Door of Joy Card',
      slug: 'door-of-joy',
      category_id: CAT_GRAD.id,
      price_cents: null,
      badges: [BADGE_HAND],
      sort_order: 1,
    }),
  ];

  const renderShop = (over = {}) => render(
    <ShopBrowse
      products={two()}
      categories={[CAT_WEDDING, CAT_GRAD]}
      badges={[BADGE_NEW, BADGE_HAND]}
      settings={SETTINGS}
      category={null}
      {...over}
    />,
  );

  /* The filter panel is display:none below 768 and revealed by the Filter
     button. jsdom applies the component's own <style> block, so it really is
     hidden here — which is correct, and means a test that wants a checkbox has
     to open the panel exactly as a phone user would. */
  const openFilters = async (user) => {
    await user.click(screen.getByRole('button', { name: /Filter/i }));
  };

  /** The product grid alone. Several strings — "Price on request" among them —
   *  legitimately appear in BOTH a filter label and a card, and a bare
   *  getByText cannot tell which one it found. */
  const grid = () => document.querySelector('.shop-grid');

  it('renders every published piece with its price', () => {
    renderShop();
    expect(screen.getByText('Velvet & Gold Suite')).toBeTruthy();
    expect(screen.getByText('Door of Joy Card')).toBeTruthy();
    expect(screen.getByText('$8.99')).toBeTruthy();
    expect(screen.getByText('/ per card')).toBeTruthy();
    // A null price is a sentence, not a zero.
    expect(within(grid()).getByText('Price on request')).toBeTruthy();
    expect(grid().textContent).not.toMatch(/\$0\.00/);
  });

  it('paints the admin-written label on the card', () => {
    renderShop();
    // "New" is a row an admin typed, not a hardcoded string in the component.
    expect(screen.getAllByText('New').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Handmade').length).toBeGreaterThan(0);
  });

  it('shows one shelf when a category is selected', () => {
    // The /shop/<category> route passes the slug; the same component renders it.
    renderShop({ category: CAT_GRAD.slug });
    expect(screen.queryByText('Velvet & Gold Suite')).toBeNull();
    expect(screen.getByText('Door of Joy Card')).toBeTruthy();
  });

  it('filters by an admin-written label', async () => {
    const user = userEvent.setup();
    renderShop();
    await openFilters(user);
    // The "filters we can write New on" requirement, exercised end to end.
    await user.click(screen.getByRole('checkbox', { name: /New/ }));
    expect(screen.getByText('Velvet & Gold Suite')).toBeTruthy();
    expect(screen.queryByText('Door of Joy Card')).toBeNull();
  });

  it('counts each filter option against the shelf, not the result', async () => {
    const user = userEvent.setup();
    renderShop();
    await openFilters(user);
    const handmade = screen.getByRole('checkbox', { name: /Handmade/ });
    await user.click(screen.getByRole('checkbox', { name: /New/ }));
    // Ticking "New" leaves one product on screen, but "Handmade" must still
    // report the 1 it would find — a count that collapses to 0 as you filter
    // tells you nothing about what the next click would do.
    expect(handmade.closest('label').textContent).toMatch(/Handmade\s*1/);
  });

  it('never offers a filter that would return nothing', async () => {
    const user = userEvent.setup();
    render(
      <ShopBrowse
        products={[product({ badges: [] })]}
        categories={[CAT_WEDDING, CAT_GRAD]}
        badges={[BADGE_NEW]}
        settings={SETTINGS}
        category={null}
      />,
    );
    await openFilters(user);
    // Nothing carries "New", so the option is shown at zero and disabled
    // rather than hidden: an option that vanishes as you browse makes the
    // panel shift under the pointer, and one that is clickable-but-empty
    // wastes the click.
    const dead = screen.getByRole('checkbox', { name: /New/ });
    expect(dead.disabled).toBe(true);
  });

  it('offers a way back when a COMBINATION empties the grid', async () => {
    const user = userEvent.setup();
    renderShop();
    await openFilters(user);

    // Each of these matches one piece on its own; together they match none —
    // the only way to empty this grid, since a zero-count option is disabled.
    await user.click(screen.getByRole('checkbox', { name: /New/ }));
    await user.click(screen.getByRole('checkbox', { name: /Price on request/ }));

    expect(screen.getByText(/Nothing matches those filters/i)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Clear them/i }));
    expect(screen.getByText('Velvet & Gold Suite')).toBeTruthy();
    expect(screen.getByText('Door of Joy Card')).toBeTruthy();
  });

  it('links each card at its category-scoped product page', () => {
    renderShop();
    const link = screen.getAllByRole('link', { name: 'Velvet & Gold Suite' })[0];
    expect(link.getAttribute('href')).toBe(`${SHOP_PATH}/${CAT_WEDDING.slug}/velvet-gold-suite`);
  });

  it('sorts price-on-request last in both directions', async () => {
    const user = userEvent.setup();
    renderShop();
    const titles = () => screen.getAllByRole('link')
      .map((a) => a.textContent)
      .filter((t) => t === 'Velvet & Gold Suite' || t === 'Door of Joy Card');

    await user.selectOptions(screen.getByRole('combobox'), 'price-asc');
    expect(titles()[0]).toBe('Velvet & Gold Suite');

    await user.selectOptions(screen.getByRole('combobox'), 'price-desc');
    // Still last: a quoted piece is not free, and "high to low" must not put
    // an absent price at either extreme of a real one.
    expect(titles()[0]).toBe('Velvet & Gold Suite');
  });

  it('does not scramble the grid when several pieces are all quote-only', async () => {
    const user = userEvent.setup();
    // Mapping a null price to ±Infinity made two quoted pieces compare as
    // `Infinity - Infinity` — NaN — and a comparator returning NaN has no
    // defined ordering at all.
    const quoted = ['Alpha', 'Beta', 'Gamma'].map((t, i) => product({
      id: `q${i}`, title: t, slug: t.toLowerCase(), price_cents: null, badges: [],
    }));
    render(
      <ShopBrowse
        products={quoted}
        categories={[CAT_WEDDING]}
        badges={[]}
        settings={SETTINGS}
        category={null}
      />,
    );

    // The TITLE links: each card also wraps its image in a link, so counting
    // every anchor counts each product twice.
    const shown = () => [...document.querySelectorAll('.shop-grid .sp-title')]
      .map((a) => a.textContent);

    await user.selectOptions(screen.getByRole('combobox'), 'price-asc');
    expect(shown()).toHaveLength(3);
    await user.selectOptions(screen.getByRole('combobox'), 'price-desc');
    expect(shown()).toHaveLength(3);
    // Every piece still present and each rendered exactly once.
    expect(new Set(shown()).size).toBe(3);
  });

  it('tells an empty catalogue apart from an over-tight filter', () => {
    // Offering "clear your filters" to someone who has set none reads as a
    // broken page — and it is what an unreachable backend produced.
    render(<ShopBrowse products={[]} categories={[]} badges={[]} settings={SETTINGS} category={null} />);
    expect(screen.getByText(/being photographed/i)).toBeTruthy();
    expect(screen.queryByText(/Nothing matches those filters/i)).toBeNull();
  });

  it('names the shelf when that one shelf is empty', () => {
    render(
      <ShopBrowse
        products={[product()]}
        categories={[CAT_WEDDING, CAT_GRAD]}
        badges={[]}
        settings={SETTINGS}
        category={CAT_GRAD.slug}
      />,
    );
    expect(screen.getByText(/Nothing is listed under Graduation yet/i)).toBeTruthy();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Getting between shelves

   The reported bug, in the organizer's words: "if I go into any category the
   rest disappear and I can't go to or come back to another category". It was
   literally true — the category band rendered under `!shelf`, so opening a
   shelf removed every route out of it except the breadcrumb, and there was no
   route ACROSS at all. A dead end is invisible to every other test in this
   file, because each one renders one surface and asks what is on it.
   ═══════════════════════════════════════════════════════════════════════════ */

describe('moving between shelves', () => {
  const CAT_THIRD = { id: 'c3', name: 'Signage', slug: 'signage', description: null, sort_order: 30 };
  const all = [CAT_WEDDING, CAT_GRAD, CAT_THIRD];

  const inShelf = (slug) => render(
    <ShopBrowse
      products={[product(), product({ id: 'p2', slug: 'door-of-joy', title: 'Door of Joy Card', category_id: CAT_GRAD.id })]}
      categories={all}
      badges={[]}
      settings={SETTINGS}
      category={slug}
    />,
  );

  /** Every href the shelf index offers, in order. */
  const shelfLinks = () => [...document.querySelectorAll('.shop-index a')].map((a) => a.getAttribute('href'));

  it('keeps every OTHER shelf reachable from inside a shelf', () => {
    inShelf(CAT_WEDDING.slug);
    const hrefs = shelfLinks();
    for (const c of all) expect(hrefs).toContain(`/shop/${c.slug}`);
  });

  it('offers the way back out to the whole catalogue', () => {
    inShelf(CAT_WEDDING.slug);
    expect(shelfLinks()[0]).toBe('/shop');
  });

  it('marks the shelf being read, and only that one', () => {
    inShelf(CAT_GRAD.slug);
    const current = [...document.querySelectorAll('.shop-index a[aria-current="page"]')];
    expect(current.length).toBe(1);
    expect(current[0].getAttribute('href')).toBe(`/shop/${CAT_GRAD.slug}`);
  });

  it('opens the index scrolled to the shelf being read', () => {
    /* The index is a horizontal scroll port that starts at 0, so on a phone a
       shelf far down the list left you looking at a strip with nothing marked
       — on the one control that exists to say where you are. jsdom reports 0
       for every offset, so this asserts the MECHANISM is wired (a ref on the
       active link, and scrollLeft written rather than scrollIntoView, which
       would also scroll the page vertically). */
    const raw = fs.readFileSync(
      path.join(process.cwd(), 'src/app/shop/ShopBrowse.js'), 'utf8',
    );
    /* COMMENTS STRIPPED. The code's own note explains why scrollIntoView is
       the wrong call here, so asserting against raw text failed on the
       documentation for the rule — punishing writing the reason down. */
    const src = raw
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
      .replace(/^[ \t]*\/\/.*$/gm, '');
    expect(src).toMatch(/ref=\{on \? activeShelfRef : undefined\}/);
    expect(src).toMatch(/port\.scrollLeft = /);
    expect(src, 'scrollIntoView also scrolls the nearest vertical ancestor')
      .not.toMatch(/scrollIntoView/);
  });

  it('still offers the way out when there is only one shelf', () => {
    render(
      <ShopBrowse
        products={[product()]}
        categories={[CAT_WEDDING]}
        badges={[]}
        settings={SETTINGS}
        category={CAT_WEDDING.slug}
      />,
    );
    const index = document.querySelector('.shop-index');
    expect(index, 'a single-shelf catalogue has no index at all').toBeTruthy();
    expect(within(index).getByRole('link', { name: /All pieces/i }).getAttribute('href')).toBe('/shop');
  });

  it('counts each shelf against the whole catalogue, not the shelf being read', () => {
    // A count that only ever showed the current shelf's pieces would make
    // every other entry read "0" and look empty.
    inShelf(CAT_WEDDING.slug);
    const index = document.querySelector('.shop-index');
    expect(within(index).getAllByText('1').length).toBeGreaterThanOrEqual(2);
  });

  it('shows the square plates on the shop home and the index inside a shelf, never both', () => {
    // They are two answers to the same question; showing both would repeat
    // the whole category list twice on one screen.
    const home = render(
      <ShopBrowse products={[product()]} categories={all} badges={[]} settings={SETTINGS} category={null} />,
    );
    expect(home.container.querySelector('.shop-plates')).toBeTruthy();
    expect(home.container.querySelector('.shop-index')).toBeNull();
    home.unmount();

    inShelf(CAT_WEDDING.slug);
    expect(document.querySelector('.shop-plates')).toBeNull();
    expect(document.querySelector('.shop-index')).toBeTruthy();
  });
});

describe('finding the way out of a product page', () => {
  const onShelf = { id: CAT_WEDDING.id, name: CAT_WEDDING.name, slug: CAT_WEDDING.slug };

  const renderProduct = (over = {}) => render(
    <ProductClient
      product={{ ...product(), category: onShelf, description: 'A card.', specs: [], highlights: [] }}
      related={[]}
      settings={SETTINGS}
      {...over}
    />,
  );

  it('puts the shelf in the breadcrumb, linked', () => {
    renderProduct();
    const crumbs = document.querySelector('.pi-crumbs');
    const link = within(crumbs).getByRole('link', { name: CAT_WEDDING.name });
    expect(link.getAttribute('href')).toBe(`/shop/${CAT_WEDDING.slug}`);
  });

  it('still renders a trail for a piece on no shelf at all', () => {
    // category_id is nullable, and a crumb that throws takes the whole page.
    renderProduct({ product: { ...product(), category: null, specs: [], highlights: [] } });
    expect(document.querySelector('.pi-crumbs')).toBeTruthy();
  });

  it('links related pieces at a URL that exists', () => {
    // /shop/<slug> is ONE segment: the router reads it as a category, and an
    // unknown category slug is a 404. Every related link was dead.
    renderProduct({
      related: [product({ id: 'r1', slug: 'door-of-joy', title: 'Door of Joy', category_id: CAT_WEDDING.id })],
    });
    const rel = document.querySelector('.pi-rel');
    expect(rel.getAttribute('href')).toBe(`/shop/${CAT_WEDDING.slug}/door-of-joy`);
  });

  it('does not file a related piece from another shelf under this one', () => {
    renderProduct({
      related: [product({ id: 'r2', slug: 'cap-card', title: 'Cap Card', category_id: CAT_GRAD.id })],
    });
    // "all" is the route's own redirect path to the piece's real category —
    // guessing THIS shelf would publish a link that is simply wrong.
    expect(document.querySelector('.pi-rel').getAttribute('href')).toBe('/shop/all/cap-card');
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   STEPPING THROUGH A PIECE'S PHOTOGRAPHS

   Reported as "the right and left arrows of scrolling between images of an
   element of the shop are not working". They were not working because there
   were none: the gallery could only be changed from the thumbnail strip, and
   the lightbox opened on one image and did nothing but close.
   ═══════════════════════════════════════════════════════════════════════════ */

describe('the product gallery arrows', () => {
  const shot = (n) => ({ id: `i${n}`, url: `https://cdn.example/${n}.jpg`, alt: `Angle ${n}` });
  const threeShots = { ...product({ images: [shot(1), shot(2), shot(3)] }), specs: [], highlights: [] };

  const renderProduct = (over) => render(
    <ProductClient product={over || threeShots} related={[]} settings={SETTINGS} />,
  );
  const mainSrc = () => document.querySelector('.pi-gallery-img').getAttribute('src');

  it('walks forward through the images', async () => {
    const user = userEvent.setup();
    renderProduct();
    expect(mainSrc()).toContain('/1.jpg');
    await user.click(screen.getByRole('button', { name: /next image/i }));
    expect(mainSrc()).toContain('/2.jpg');
  });

  it('wraps at both ends instead of dead-ending', async () => {
    // Neither arrow is ever disabled, so neither has a dead state to explain.
    const user = userEvent.setup();
    renderProduct();
    await user.click(screen.getByRole('button', { name: /previous image/i }));
    expect(mainSrc(), 'going back from the first image did not wrap').toContain('/3.jpg');
  });

  it('does not offer arrows for a piece with one photograph', () => {
    renderProduct({ ...product({ images: [shot(1)] }), specs: [], highlights: [] });
    expect(screen.queryByRole('button', { name: /next image/i })).toBeNull();
  });

  it('steps the image without also opening the lightbox', async () => {
    /* The arrows sit over the zoom button. Nested inside it rather than
       beside it, every click would bubble into "open the lightbox" and a
       visitor stepping through the gallery would get a full-screen overlay
       they did not ask for. */
    const user = userEvent.setup();
    renderProduct();
    await user.click(screen.getByRole('button', { name: /next image/i }));
    expect(document.querySelector('.pi-lightbox')).toBeNull();
  });

  it('steps inside the lightbox without closing it', async () => {
    /* The overlay closes on click, so an arrow that lets the event through
       would shut the lightbox instead of advancing — present and broken. */
    const user = userEvent.setup();
    renderProduct();
    await user.click(screen.getByRole('button', { name: /view larger image/i }));
    expect(document.querySelector('.pi-lightbox')).toBeTruthy();

    const next = [...document.querySelectorAll('.pi-lnav')][1];
    await user.click(next);
    expect(document.querySelector('.pi-lightbox'), 'the lightbox closed instead of advancing').toBeTruthy();
    expect(document.querySelector('.pi-lightbox-img').getAttribute('src')).toContain('/2.jpg');
  });

  it('walks the lightbox from the keyboard', async () => {
    const user = userEvent.setup();
    renderProduct();
    await user.click(screen.getByRole('button', { name: /view larger image/i }));
    await user.keyboard('{ArrowRight}');
    expect(document.querySelector('.pi-lightbox-img').getAttribute('src')).toContain('/2.jpg');
    await user.keyboard('{Escape}');
    expect(document.querySelector('.pi-lightbox')).toBeNull();
  });
});

describe('the category plate', () => {
  const all = [CAT_WEDDING, CAT_GRAD];

  const home = (products) => render(
    <ShopBrowse products={products} categories={all} badges={[]} settings={SETTINGS} category={null} />,
  );

  it('wears the photograph of its own featured piece', () => {
    const { container } = home([
      product({ id: 'a', slug: 'a', category_id: CAT_WEDDING.id, sort_order: 0, images: [{ id: 'i1', url: '/plain.jpg', alt: null }] }),
      product({ id: 'b', slug: 'b', category_id: CAT_WEDDING.id, sort_order: 9, is_featured: true, images: [{ id: 'i2', url: '/featured.jpg', alt: null }] }),
    ]);
    const img = container.querySelector('.shop-plates .plate__img');
    // Featured beats sort_order — otherwise the shelf is fronted by whichever
    // piece happens to sit first, which is not a choice anyone made.
    expect(img.getAttribute('src')).toBe('/featured.jpg');
  });

  it('falls back to the drawing when nothing on the shelf has a photograph', () => {
    const { container } = home([product({ category_id: CAT_WEDDING.id, images: [] })]);
    const plate = container.querySelector('.shop-plates .plate');
    expect(plate.querySelector('.plate__img')).toBeNull();
    expect(plate.querySelector('.plate__art svg')).toBeTruthy();
  });

  it('does not lend one shelf a photograph from another', () => {
    const { container } = home([
      product({ id: 'a', slug: 'a', category_id: CAT_WEDDING.id, images: [{ id: 'i1', url: '/wedding.jpg', alt: null }] }),
      product({ id: 'b', slug: 'b', category_id: CAT_GRAD.id, images: [] }),
    ]);
    const plates = [...container.querySelectorAll('.shop-plates .plate')];
    expect(plates[0].querySelector('.plate__img').getAttribute('src')).toBe('/wedding.jpg');
    expect(plates[1].querySelector('.plate__img')).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   The product page
   ═══════════════════════════════════════════════════════════════════════════ */

describe('product page', () => {
  const full = product({
    description: 'First paragraph.\n\nSecond paragraph.',
    highlights: ['Gold foil stamping', 'Laser engraving'],
    specs: [{ label: 'Material', value: '350gsm cotton board' }],
    images: [
      { id: 'i1', url: 'https://cdn.example/a.jpg', alt: 'Front' },
      { id: 'i2', url: 'https://cdn.example/b.jpg', alt: 'Back' },
    ],
  });

  it('shows the price, the minimum, the lead time and the specs', () => {
    const { container } = render(<ProductClient product={full} related={[]} settings={SETTINGS} />);
    // Twice on purpose: the buy rail and the phone-only sticky bar. jsdom
    // applies no CSS, so the media query that hides the sticky bar on desktop
    // does not run here and both nodes are in the tree.
    expect(container.querySelector('.pi-price-now').textContent).toBe('$8.99');
    expect(container.querySelector('.pi-sticky-now').textContent).toBe('$8.99');
    expect(screen.getByText(/Minimum order: 50/)).toBeTruthy();
    expect(screen.getAllByText(/3–4 weeks/).length).toBeGreaterThan(0);
    expect(screen.getByText('350gsm cotton board')).toBeTruthy();
    expect(screen.getByText('Gold foil stamping')).toBeTruthy();
  });

  it('splits the description into paragraphs on blank lines', () => {
    render(<ProductClient product={full} related={[]} settings={SETTINGS} />);
    expect(screen.getByText('First paragraph.')).toBeTruthy();
    expect(screen.getByText('Second paragraph.')).toBeTruthy();
  });

  it('offers the WhatsApp order button, carrying the piece', () => {
    render(<ProductClient product={full} related={[]} settings={SETTINGS} />);
    const cta = screen.getByRole('link', { name: /Order on WhatsApp/i });
    expect(cta.getAttribute('href')).toContain('wa.me/19055550134');
    expect(cta.getAttribute('target')).toBe('_blank');
    // Anchor to another origin without rel=noopener hands the opened tab a
    // handle on this one.
    expect(cta.getAttribute('rel')).toContain('noopener');
  });

  it('records the tap when the order button is used', async () => {
    const user = userEvent.setup();
    render(<ProductClient product={full} related={[]} settings={SETTINGS} />);
    await user.click(screen.getByRole('link', { name: /Order on WhatsApp/i }));
    expect(global.fetch).toHaveBeenCalled();
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toContain(`/public/shop/${full.id}/inquiry`);
    // keepalive, because the browser is about to leave for WhatsApp and an
    // ordinary fetch is cancelled the moment it does.
    expect(opts.keepalive).toBe(true);
  });

  it('falls back to the contact page when no number is configured', () => {
    render(<ProductClient product={full} related={[]} settings={{ ...SETTINGS, whatsapp_number: '' }} />);
    expect(screen.queryByRole('link', { name: /Order on WhatsApp/i })).toBeNull();
    expect(screen.getByRole('link', { name: /Contact us to order/i }).getAttribute('href')).toBe('/contact');
  });

  it('changes the main image when a thumbnail is chosen', async () => {
    const user = userEvent.setup();
    const { container } = render(<ProductClient product={full} related={[]} settings={SETTINGS} />);
    expect(container.querySelector('.pi-gallery-img').getAttribute('src')).toBe('https://cdn.example/a.jpg');
    await user.click(screen.getByRole('button', { name: /View image 2 of 2/ }));
    expect(container.querySelector('.pi-gallery-img').getAttribute('src')).toBe('https://cdn.example/b.jpg');
  });

  it('states sold out and changes the CTA rather than hiding it', () => {
    render(<ProductClient product={product({ ...full, is_sold_out: true })} related={[]} settings={SETTINGS} />);
    expect(screen.getAllByText(/Sold out/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /Ask about this piece/i })).toBeTruthy();
  });

  it('renders "Price on request" in place of a number', () => {
    const { container } = render(
      <ProductClient product={product({ ...full, price_cents: null })} related={[]} settings={SETTINGS} />,
    );
    expect(container.querySelector('.pi-price-quote').textContent).toBe('Price on request');
    expect(container.querySelector('.pi-price-now')).toBeNull();
    expect(container.textContent).not.toMatch(/\$0/);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Wiring — the surfaces that must not drift apart
   ═══════════════════════════════════════════════════════════════════════════ */

describe('wiring', () => {
  it('the route exists at /printed-invitations with a product page under it', () => {
    expect(fs.existsSync(path.join(ROOT, 'src/app/printed-invitations/page.js'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'src/app/printed-invitations/[slug]/page.js'))).toBe(true);
  });

  it('the navbar and footer both link to it', () => {
    /* Either the literal path or the shared SHOP_PATH constant counts. The
       footer now imports SHOP_PATH (and SHOP_LABEL) from utils/shopLinks
       rather than writing the string out, which is what that module exists
       for — four surfaces used to hold four copies of this path. A test that
       demanded the literal would push the next person back into copying it. */
    const linksToShop = (rel) => {
      const src = read(rel);
      return src.includes('/printed-invitations') || /\bSHOP_PATH\b/.test(src);
    };
    expect(linksToShop('src/app/components/landing/Navbar.js')).toBe(true);
    expect(linksToShop('src/app/components/landing/FooterSection.js')).toBe(true);
  });

  it('the homepage renders the teaser and the dashboard renders the offer card', () => {
    expect(read('src/app/page.js')).toContain('PrintedInvitationsSection');
    expect(read('src/app/dashboard/components/OrganizerOverview.js')).toContain('PrintedInvitationsCard');
  });

  it('the admin section is registered in the control-center nav', () => {
    const nav = read('src/app/admin/_components/nav.js');
    expect(nav).toContain("href: '/admin/shop'");
    expect(nav).toContain("perm: 'cms.view'");
    // An item with no icon renders a blank square in the sidebar.
    expect(read('src/app/admin/_components/Sidebar.js')).toMatch(/\n\s*shop:\s*<svg/);
  });

  it('every surface that offers WhatsApp builds the link through the one helper', () => {
    // Hand-rolled `wa.me/${n}` templates would not crash when the number
    // changes — they would just keep sending people to the old one.
    //
    // ShopBrowse is deliberately NOT in this list. Since the /shop rebuild the
    // browse grid carries no order button: a card shows the piece, the price
    // and the minimum, and the conversation starts on the product page where
    // there is something specific to say. A surface with no CTA has no link to
    // build, and asserting it imports the helper would only force a dead
    // import.
    const surfaces = [
      'src/app/shop/[category]/[slug]/ProductClient.js',
      'src/app/dashboard/components/PrintedInvitationsCard.js',
    ];
    surfaces.forEach((rel) => {
      const src = read(rel);
      expect(src).toContain('buildWhatsappUrl');
      expect(src).not.toMatch(/https:\/\/wa\.me\//);
    });

    // And the browse grid really does stay out of it.
    expect(read('src/app/shop/ShopBrowse.js')).not.toMatch(/https:\/\/wa\.me\//);
  });

  it('the product page carries its own copy of the shared button/badge CSS', () => {
    // A real bug this caught: .pi-btn lived only in the catalogue's style
    // block. The product page is a different route, so the main "Order on
    // WhatsApp" control shipped as a bare blue underlined anchor. Every test
    // passed while it was broken; only a screenshot showed it.
    //
    // Only the product page needs the layer now — ShopBrowse ships its own
    // self-contained style block and uses none of the pi- classes.
    const src = read('src/app/shop/[category]/[slug]/ProductClient.js');
    expect(src).toContain('PI_BASE_CSS');
    expect(src).toMatch(/\$\{PI_BASE_CSS\}/);
  });

  it('the shared button rules are declared exactly once', () => {
    const shared = read('src/app/shop/piStyles.js');
    expect(shared).toMatch(/\.pi-btn\s*\{/);
    // Redeclaring them per page is how the two drift apart again.
    ['src/app/shop/ShopBrowse.js', 'src/app/shop/[category]/[slug]/ProductClient.js']
      .forEach((rel) => {
        expect(read(rel)).not.toMatch(/\n\s*\.pi-btn\s*\{/);
      });
  });

  it('renders the product CTA with the button classes, not a bare anchor', () => {
    render(
      <ProductClient
        product={product({ description: 'x', highlights: [], specs: [] })}
        related={[]}
        settings={SETTINGS}
      />,
    );
    const cta = screen.getByRole('link', { name: /Order on WhatsApp/i });
    expect(cta.className).toContain('pi-btn');
    expect(cta.className).toContain('pi-btn--gold');
  });

  it('the upload helper is shared, not copied, between the two admin screens', () => {
    expect(fs.existsSync(path.join(ROOT, 'src/app/admin/_lib/uploadImage.js'))).toBe(true);
    const cms = read('src/app/admin/(panel)/cms/page.js');
    const shop = read('src/app/admin/(panel)/shop/page.js');
    expect(cms).toContain("from '../../_lib/uploadImage'");
    expect(shop).toContain("from '../../_lib/uploadImage'");
    // The old private copy must be gone from the CMS page, or the two diverge.
    expect(cms).not.toContain('function makeImageUploadHandler');
  });
});
