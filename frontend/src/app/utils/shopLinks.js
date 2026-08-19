/**
 * PRINTED INVITATIONS — the shared vocabulary of the catalogue.
 *
 * Four separate surfaces send people to the same WhatsApp conversation: the
 * listing page, the product page, the homepage teaser and the organizer
 * dashboard card. Each one of them needs the number, the greeting, the price
 * string and the "is this even switched on?" answer.
 *
 * Written once, here, because the alternative was four copies of a
 * `wa.me/${number}?text=…` template — and the failure mode of four copies is
 * not a crash. It is three surfaces quietly sending people to an old number
 * after the admin changes it in one place, which nobody notices until a
 * customer says nobody replied.
 */

/** The catalogue's public route. Referenced by nav, footer, teaser and cards. */
export const SHOP_PATH = '/printed-invitations';

/**
 * The canonical public origin, used to build the link inside a customer's
 * WhatsApp message.
 *
 * Deliberately NOT `window.location.origin`. Two reasons, and the second is
 * the important one:
 *
 *   • reading `window` during render makes the server-rendered href differ
 *     from the hydrated one, and doing it in an effect trips this codebase's
 *     `react-hooks/set-state-in-effect` rule;
 *   • whatever origin the visitor happens to be on is not necessarily the one
 *     you want pasted into a customer's chat. A preview deployment, a staging
 *     host or an IP address would all be faithfully copied into a message
 *     someone reads days later, pointing at a URL that may not resolve.
 *
 * Matches the canonical URLs the page metadata and JSON-LD already emit.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://fancyrsvp.com').replace(/\/+$/, '');

/** What the section is called to a customer, everywhere. */
export const SHOP_LABEL = 'Printed Invitations';

/**
 * Money, from integer cents.
 *
 * `price_cents === null` is meaningful data, not a gap: it is how an admin
 * publishes a piece they would rather quote privately, and it must render as
 * words. Returning null here (rather than "$0.00") forces every caller to
 * decide what to show instead, which is the point.
 */
export function formatPrice(cents, currency = 'CAD') {
  if (cents === null || cents === undefined || Number.isNaN(Number(cents))) return null;
  try {
    // Always two decimals. Dropping them on whole amounts renders "$9" beside
    // "$12.50" in the same grid, which reads as a formatting bug rather than a
    // style — and a price list is exactly where inconsistent money notation
    // gets noticed.
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: currency || 'CAD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(cents) / 100);
  } catch {
    // An admin can type any three letters into the currency field; an unknown
    // ISO code makes Intl throw, and a thrown formatter would blank the whole
    // price rail rather than the one symbol it could not resolve.
    return `${(Number(cents) / 100).toFixed(2)} ${currency || ''}`.trim();
  }
}

/** "$8.99 per card" / "Price on request" — the full line under a title. */
export function priceLine(product) {
  const price = formatPrice(product?.price_cents, product?.currency);
  if (!price) return 'Price on request';
  return product?.price_unit ? `${price} ${product.price_unit}` : price;
}

/**
 * Is the section switched on AND actually reachable?
 *
 * A WhatsApp catalogue with no WhatsApp number is a dead end — every CTA on
 * every card would point at `wa.me/` and open nothing. So an unset number
 * counts as "not live", and the surfaces below hide themselves rather than
 * shipping a button that goes nowhere.
 */
export function isShopLive(settings) {
  return Boolean(settings && settings.enabled !== false && String(settings.whatsapp_number || '').trim());
}

/**
 * Builds the wa.me link, with the message pre-typed for the customer.
 *
 * Order of preference for the text: the product's own override, then the
 * platform greeting, then a literal fallback — so an admin who writes nothing
 * still gets a working, sensible message rather than an empty compose box.
 *
 * The product name and its page URL are appended because the message arrives
 * with no context at all otherwise: "Hello, I'd like to order" tells whoever
 * answers nothing about which of forty cards is meant.
 */
export function buildWhatsappUrl({ settings, product } = {}) {
  const number = String(settings?.whatsapp_number || '').replace(/\D/g, '');
  if (!number) return null;

  const base =
    (product?.whatsapp_message && product.whatsapp_message.trim())
    || (settings?.whatsapp_greeting && settings.whatsapp_greeting.trim())
    || 'Hello! I would like to order printed invitations.';

  const parts = [base];
  if (product?.title) parts.push(`\n\nProduct: ${product.title}`);
  if (product?.slug) parts.push(`${SITE_URL}${SHOP_PATH}/${product.slug}`);

  return `https://wa.me/${number}?text=${encodeURIComponent(parts.join('\n'))}`;
}

/**
 * Records the tap, then lets the link do its own navigation.
 *
 * `keepalive` is the load-bearing part: the browser is about to leave for
 * WhatsApp, and an ordinary fetch is cancelled the moment it does — which
 * would mean the beacon only ever recorded the taps that failed to navigate.
 * Errors are swallowed on purpose; analytics must never stand between a
 * customer and the conversation they are trying to start.
 */
export function recordShopInquiry(productId, source = 'whatsapp') {
  if (!productId) return;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
  try {
    fetch(`${apiUrl}/public/shop/${productId}/inquiry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* never block the outbound link */
  }
}

/**
 * The visitor-facing sort options, and the comparators behind them.
 *
 * `manual` is the admin's own arrangement — the "make the new one show first"
 * control — and it is a real, stored order (shop_products.sort_order), not a
 * guess derived from dates. The rest are conveniences layered on top of it.
 *
 * Products with no price sort LAST in both price directions rather than
 * counting as zero: "Price on request" is the most expensive-looking thing on
 * the page, and floating it to the top of "low to high" reads as a bug.
 */
export const SORT_OPTIONS = [
  { key: 'manual', label: 'Featured' },
  { key: 'newest', label: 'Newest first' },
  { key: 'price_asc', label: 'Price: low to high' },
  { key: 'price_desc', label: 'Price: high to low' },
];

export function sortProducts(products, mode) {
  const rows = [...(products || [])];
  const byManual = (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    || new Date(b.published_at || b.created_at || 0) - new Date(a.published_at || a.created_at || 0);

  switch (mode) {
    case 'newest':
      return rows.sort((a, b) =>
        new Date(b.published_at || b.created_at || 0) - new Date(a.published_at || a.created_at || 0));
    case 'price_asc':
      return rows.sort((a, b) => {
        if (a.price_cents == null && b.price_cents == null) return byManual(a, b);
        if (a.price_cents == null) return 1;
        if (b.price_cents == null) return -1;
        return a.price_cents - b.price_cents;
      });
    case 'price_desc':
      return rows.sort((a, b) => {
        if (a.price_cents == null && b.price_cents == null) return byManual(a, b);
        if (a.price_cents == null) return 1;
        if (b.price_cents == null) return -1;
        return b.price_cents - a.price_cents;
      });
    case 'manual':
    default:
      return rows.sort(byManual);
  }
}

/** First gallery image, or null. Callers render their own placeholder. */
export function coverImage(product) {
  return product?.images?.[0] || null;
}
