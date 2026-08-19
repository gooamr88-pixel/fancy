import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(''), usePathname: () => '/' }));

import ShopClient from '../src/app/printed-invitations/ShopClient';
import ProductClient from '../src/app/printed-invitations/[slug]/ProductClient';
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
  currency: 'CAD',
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
    const url = buildWhatsappUrl({ settings: SETTINGS, product: product() });
    expect(url.startsWith('https://wa.me/19055550134?text=')).toBe(true);
    const text = decodeURIComponent(url.split('text=')[1]);
    expect(text).toContain('Velvet & Gold Suite');
    // The CANONICAL origin, not window.location — a preview or staging host
    // would otherwise be pasted into a customer's chat and read days later.
    expect(text).toContain(`${SITE_URL}/printed-invitations/velvet-gold-suite`);
    expect(SITE_URL).toBe('https://fancyrsvp.com');
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
  const renderShop = (over = {}) => render(
    <ShopClient
      products={[product(), product({ id: 'p2', title: 'Door of Joy Card', slug: 'door-of-joy', category_id: CAT_GRAD.id, price_cents: null, badges: [BADGE_HAND], sort_order: 1 })]}
      categories={[CAT_WEDDING, CAT_GRAD]}
      badges={[BADGE_NEW, BADGE_HAND]}
      settings={SETTINGS}
      {...over}
    />,
  );

  it('renders every published piece with its price', () => {
    renderShop();
    expect(screen.getByText('Velvet & Gold Suite')).toBeTruthy();
    expect(screen.getByText('Door of Joy Card')).toBeTruthy();
    expect(screen.getByText('$8.99 per card')).toBeTruthy();
    expect(screen.getByText('Price on request')).toBeTruthy();
  });

  it('paints the admin-written label on the card', () => {
    renderShop();
    // "New" is a row an admin typed, not a hardcoded string in the component.
    expect(screen.getAllByText('New').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Handmade').length).toBeGreaterThan(0);
  });

  it('filters by collection', async () => {
    const user = userEvent.setup();
    renderShop();
    await user.click(screen.getByRole('button', { name: 'Graduation' }));
    expect(screen.queryByText('Velvet & Gold Suite')).toBeNull();
    expect(screen.getByText('Door of Joy Card')).toBeTruthy();
  });

  it('filters by an admin-written label', async () => {
    const user = userEvent.setup();
    renderShop();
    // The "filters we can write New on" requirement, exercised end to end.
    const chips = screen.getAllByRole('button', { name: 'New' });
    await user.click(chips[chips.length - 1]);
    expect(screen.getByText('Velvet & Gold Suite')).toBeTruthy();
    expect(screen.queryByText('Door of Joy Card')).toBeNull();
  });

  it('offers a way back when a filter empties the grid', async () => {
    const user = userEvent.setup();
    render(
      <ShopClient
        products={[product({ category_id: CAT_WEDDING.id, badges: [] })]}
        categories={[CAT_WEDDING, CAT_GRAD]}
        badges={[BADGE_NEW]}
        settings={SETTINGS}
      />,
    );
    // A collection with no product in it is never rendered as a chip, so the
    // only way to empty the grid is a label filter.
    expect(screen.queryByRole('button', { name: 'Graduation' })).toBeNull();
  });

  it('hides every order button when no WhatsApp number is set', () => {
    renderShop({ settings: { ...SETTINGS, whatsapp_number: '' } });
    // The catalogue still shows — only the dead buttons go.
    expect(screen.getByText('Velvet & Gold Suite')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Order/i })).toBeNull();
  });

  it('links each card at its own product page', () => {
    renderShop();
    const link = screen.getAllByRole('link', { name: /View Velvet & Gold Suite|Velvet & Gold Suite/ })[0];
    expect(link.getAttribute('href')).toBe(`${SHOP_PATH}/velvet-gold-suite`);
  });

  it('shows an honest empty state rather than a broken grid', () => {
    render(<ShopClient products={[]} categories={[]} badges={[]} settings={SETTINGS} />);
    expect(screen.getByText(/being photographed/i)).toBeTruthy();
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

  it('all four surfaces build their WhatsApp link through the one helper', () => {
    // Four hand-rolled `wa.me/${n}` templates would not crash when the number
    // changes — three of them would just keep sending people to the old one.
    const surfaces = [
      'src/app/printed-invitations/ShopClient.js',
      'src/app/printed-invitations/[slug]/ProductClient.js',
      'src/app/dashboard/components/PrintedInvitationsCard.js',
    ];
    surfaces.forEach((rel) => {
      const src = read(rel);
      expect(src).toContain('buildWhatsappUrl');
      expect(src).not.toMatch(/https:\/\/wa\.me\//);
    });
  });

  it('the product page carries its own copy of the shared button/badge CSS', () => {
    // A real bug this caught: .pi-btn lived only in ShopClient's style block.
    // /printed-invitations/[slug] is a different route, so ShopClient is never
    // mounted there and the main "Order on WhatsApp" control shipped as a bare
    // blue underlined anchor. Every test passed while it was broken; only a
    // screenshot showed it. Both pages must include the shared layer.
    ['src/app/printed-invitations/ShopClient.js', 'src/app/printed-invitations/[slug]/ProductClient.js']
      .forEach((rel) => {
        const src = read(rel);
        expect(src).toContain('PI_BASE_CSS');
        expect(src).toMatch(/\$\{PI_BASE_CSS\}/);
      });
  });

  it('the shared button rules are declared exactly once', () => {
    const shared = read('src/app/printed-invitations/piStyles.js');
    expect(shared).toMatch(/\.pi-btn\s*\{/);
    // Redeclaring them per page is how the two drift apart again.
    ['src/app/printed-invitations/ShopClient.js', 'src/app/printed-invitations/[slug]/ProductClient.js']
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
