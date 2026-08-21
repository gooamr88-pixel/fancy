const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');
const { CONFIG_ID } = require('../utils/configCache');

/**
 * PRINTED INVITATIONS — the anonymous read path (/api/v1/public/shop/*).
 *
 * Serves the public catalogue at /printed-invitations, the homepage teaser and
 * the dashboard card. Admin CRUD lives in controllers/admin/shopController.js.
 *
 * ── Two rules this file exists to hold ──
 *
 * 1. PUBLISHED ONLY. Every query filters is_published, on products AND on the
 *    collections/labels used to build the filter chips. A draft product that
 *    reached this endpoint would be visible to anyone who could guess nothing
 *    at all — it is served to the open internet.
 *
 * 2. NO getPlatformConfig() HERE. That helper returns the WHOLE
 *    super_admin_config row — pricing_tiers, sms_rate_cents_per_credit,
 *    sms_markup_percentage, platform_commission_pct. This endpoint is
 *    unauthenticated, so it selects the single `shop_settings` column by name
 *    and hand-picks the public subset out of it. (Cost margins leaking through
 *    a public endpoint is a mistake this codebase has already made once —
 *    see test/organizerPricingLeak.test.js.)
 */

const SETTINGS_DEFAULTS = {
  enabled: true,
  show_on_homepage: true,
  show_in_dashboard: true,
  whatsapp_number: '',
  whatsapp_greeting: 'Hello! I would like to order printed invitations.',
  hero_kicker: 'HANDCRAFTED · PRINTED · DELIVERED',
  hero_title: 'Printed Invitations',
  hero_subtitle: 'Invitations your guests can hold. Pressed, foiled and finished by hand, then delivered to your door.',
  default_lead_time: 'Standard production lead time: 3–4 weeks',
  default_sort: 'manual',
};

/**
 * The ONLY settings keys that ever reach a browser. An allowlist rather than a
 * blocklist: a future admin-only key added to shop_settings must be opted IN
 * here, instead of silently shipping to the public page the day it is added.
 */
const PUBLIC_SETTING_KEYS = [
  'enabled', 'show_on_homepage', 'show_in_dashboard',
  'whatsapp_number', 'whatsapp_greeting',
  'hero_kicker', 'hero_title', 'hero_subtitle',
  'default_lead_time', 'default_sort',
];

async function readPublicSettings() {
  const { data } = await supabase
    .from('super_admin_config')
    .select('shop_settings')
    .eq('id', CONFIG_ID)
    .maybeSingle();
  const merged = { ...SETTINGS_DEFAULTS, ...(data?.shop_settings || {}) };
  return Object.fromEntries(PUBLIC_SETTING_KEYS.map((k) => [k, merged[k]]));
}

/** Columns safe to serve for a card in the grid. */
const LIST_COLUMNS = 'id, title, slug, tagline, category_id, price_cents, compare_at_cents, currency, price_unit, min_order_qty, is_featured, is_sold_out, sort_order, published_at, created_at';

/** Everything a full product page renders. */
const DETAIL_COLUMNS = `${LIST_COLUMNS}, description, lead_time_text, specs, highlights, whatsapp_message, meta_title, meta_description`;

/**
 * Attaches gallery + labels to product rows — two queries total, not one per
 * product. Only published labels are attached: unpublishing "New" must remove
 * it from every card at once, which is the entire reason it is a row and not a
 * string typed onto each product.
 */
async function attachRelations(products) {
  const rows = products || [];
  if (rows.length === 0) return [];
  const ids = rows.map((p) => p.id);

  const [{ data: images }, { data: links }, { data: badges }] = await Promise.all([
    supabase
      .from('shop_product_images')
      .select('id, product_id, image_url, alt_text, sort_order')
      .in('product_id', ids)
      .order('sort_order', { ascending: true }),
    supabase.from('shop_product_badges').select('product_id, badge_id').in('product_id', ids),
    supabase
      .from('shop_badges')
      .select('id, label, bg_color, text_color, is_filterable, sort_order')
      .eq('is_published', true)
      .order('sort_order', { ascending: true }),
  ]);

  const badgeById = new Map((badges || []).map((b) => [b.id, b]));
  const imagesByProduct = new Map();
  (images || []).forEach((img) => {
    if (!imagesByProduct.has(img.product_id)) imagesByProduct.set(img.product_id, []);
    imagesByProduct.get(img.product_id).push({
      id: img.id, url: img.image_url, alt: img.alt_text || null,
    });
  });
  const badgesByProduct = new Map();
  (links || []).forEach((link) => {
    const badge = badgeById.get(link.badge_id);
    if (!badge) return;
    if (!badgesByProduct.has(link.product_id)) badgesByProduct.set(link.product_id, []);
    badgesByProduct.get(link.product_id).push(badge);
  });

  return rows.map((p) => ({
    ...p,
    images: imagesByProduct.get(p.id) || [],
    badges: (badgesByProduct.get(p.id) || []).sort((a, b) => a.sort_order - b.sort_order),
  }));
}

/**
 * GET /api/v1/public/shop — the whole catalogue in one call.
 *
 * One request rather than four, because the listing page cannot render a
 * single correct card without all of them: the grid needs products, the filter
 * chips need collections and labels, and the CTA needs the WhatsApp number.
 *
 * Ordering is `sort_order` then newest — the admin's arrangement first, with a
 * stable, meaningful tiebreak rather than whatever Postgres returns. That pair
 * is exactly the idx_shop_products_listing index.
 */
const getPublicShop = async (req, res) => {
  try {
    const settings = await readPublicSettings();

    // The master switch. Off means the section is not merely hidden in the nav
    // — the data stops being served, so a bookmarked URL cannot render it either.
    if (settings.enabled === false) {
      res.set('Cache-Control', 'public, max-age=60, s-maxage=60');
      return res.json({ success: true, enabled: false, products: [], categories: [], badges: [], settings });
    }

    /* THE CATEGORY AND BADGE ERRORS ARE CAUGHT NOW, AND THAT MATTERS MORE
       SINCE 2026-08-22.

       Only the PRODUCTS error was checked. The other two destructured `data`
       and dropped `error` on the floor, so a failing categories query fell
       through to `categories || []` and the shop rendered with no collections
       at all — no plates, no shelf index, no Collections group in the filter —
       looking exactly like a shop nobody had configured yet, and logging
       nothing.

       That became a live deployment hazard when this select gained
       `cover_image_url` / `cover_image_alt`: those columns arrive in migration
       20260827000000, so deploying this code before running the migration
       makes Postgres reject the query with "column does not exist" and the
       catalogue silently loses every category. The failure needs to be
       audible. */
    const [{ data: products, error }, { data: categories, error: catError }, { data: badges, error: badgeError }] = await Promise.all([
      supabase
        .from('shop_products')
        .select(LIST_COLUMNS)
        .eq('is_published', true)
        .order('sort_order', { ascending: true })
        .order('published_at', { ascending: false }),
      supabase
        .from('shop_categories')
        /* cover_image_url/alt: the collection's editorial cover, set in
           Admin → Shop → Collections. Before this the public page picked a
           product photograph out of the shelf instead, which meant nobody had
           chosen the image and it changed whenever the catalogue was
           re-ordered. */
        .select('id, name, slug, description, sort_order, cover_image_url, cover_image_alt')
        .eq('is_published', true)
        .order('sort_order', { ascending: true }),
      supabase
        .from('shop_badges')
        .select('id, label, bg_color, text_color, is_filterable, sort_order')
        .eq('is_published', true)
        .eq('is_filterable', true)
        .order('sort_order', { ascending: true }),
    ]);
    if (error) throw error;
    /* Logged rather than thrown: a marketing listing must still render. A
       missing collection list degrades the page; a 500 removes it. */
    if (catError) {
      logger.error({ err: catError }, 'getPublicShop: categories query failed — the catalogue will render with no collections. If this says "column does not exist", migration 20260827000000 has not been applied.');
    }
    if (badgeError) {
      logger.error({ err: badgeError }, 'getPublicShop: badges query failed — labels and label filters will be missing.');
    }

    res.set('Cache-Control', 'public, max-age=60, s-maxage=60');
    return res.json({
      success: true,
      enabled: true,
      products: await attachRelations(products),
      categories: categories || [],
      badges: badges || [],
      settings,
    });
  } catch (err) {
    // A marketing listing must never 500 the page — degrade to an empty
    // catalogue, mirroring getPublicBlogPosts / getPublicTestimonials.
    logger.warn({ err }, 'getPublicShop: query failed, returning empty catalogue');
    return res.status(200).json({
      success: false, enabled: true, products: [], categories: [], badges: [], settings: SETTINGS_DEFAULTS,
    });
  }
};

/**
 * GET /api/v1/public/shop/:slug — one published product, plus related.
 *
 * Unlike the listing, a missing slug is a genuine 404: the page itself does not
 * exist and Next must render notFound() rather than an empty product.
 */
const getPublicProductBySlug = async (req, res, next) => {
  const slug = (req.params.slug || '').toString().trim();
  try {
    const settings = await readPublicSettings();
    if (settings.enabled === false) {
      return res.status(404).json({ success: false, error: 'PRODUCT_NOT_FOUND', message: 'This product could not be found.' });
    }

    const { data, error } = await supabase
      .from('shop_products')
      .select(DETAIL_COLUMNS)
      .eq('slug', slug)
      .eq('is_published', true)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return res.status(404).json({ success: false, error: 'PRODUCT_NOT_FOUND', message: 'This product could not be found.' });
    }

    const [product] = await attachRelations([data]);

    // Same collection first, then anything else, so "related" means related
    // rather than "the next four rows".
    const { data: siblings } = await supabase
      .from('shop_products')
      .select(LIST_COLUMNS)
      .eq('is_published', true)
      .neq('id', data.id)
      .order('sort_order', { ascending: true })
      .limit(24);

    const pool = siblings || [];
    const sameCategory = data.category_id ? pool.filter((p) => p.category_id === data.category_id) : [];
    const others = pool.filter((p) => !sameCategory.includes(p));
    const related = await attachRelations([...sameCategory, ...others].slice(0, 3));

    // The shelf this piece sits on.
    //
    // The row carries category_id and nothing else, which was enough while the
    // catalogue was one flat list at /printed-invitations. The product URL is
    // now /shop/<category>/<slug>, so the page needs the SLUG to build its own
    // canonical and its breadcrumb — without it every product would resolve to
    // a generic segment and the canonical would disagree with the links
    // pointing at it.
    //
    // Only published categories are attached: a category an admin unpublishes
    // must stop naming itself on the pieces inside it.
    let category = null;
    if (data.category_id) {
      const { data: cat } = await supabase
        .from('shop_categories')
        .select('id, name, slug')
        .eq('id', data.category_id)
        .eq('is_published', true)
        .maybeSingle();
      category = cat || null;
    }

    // Fire-and-forget: a view counter must never delay or fail the page.
    supabase.rpc('increment_shop_product_view', { p_product_id: data.id }).then(
      () => {},
      () => {},
    );

    res.set('Cache-Control', 'public, max-age=60, s-maxage=60');
    return res.json({ success: true, product: { ...product, category }, related, settings });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/public/shop/:productId/inquiry — records an "Order on WhatsApp" tap.
 *
 * The entire funnel leaves for WhatsApp, so this beacon is the only signal the
 * platform ever gets about which card people actually want. It deliberately
 * stores no personal data — product, source, timestamp. Always answers 200:
 * a failed analytics write must never block someone from reaching WhatsApp.
 */
const recordShopInquiry = async (req, res) => {
  const { productId } = req.params;
  const source = ['whatsapp', 'listing', 'homepage', 'dashboard'].includes(req.body?.source)
    ? req.body.source
    : 'whatsapp';
  try {
    const { data: product } = await supabase
      .from('shop_products').select('id, title').eq('id', productId).maybeSingle();
    if (!product) return res.json({ success: true });

    await supabase.from('shop_inquiries').insert({
      product_id: product.id,
      // Snapshot, so the report still names the product after it is deleted.
      product_title: product.title,
      source,
    });

    // Atomic in the database, like the view counter. A read-then-write here
    // loses one of any two taps that arrive together, and this is the number
    // that says how many people asked to buy.
    await supabase.rpc('increment_shop_product_inquiry', { p_product_id: product.id });

    return res.json({ success: true });
  } catch (err) {
    logger.warn({ err }, 'recordShopInquiry: failed to record inquiry');
    return res.json({ success: true });
  }
};

module.exports = {
  getPublicShop,
  getPublicProductBySlug,
  recordShopInquiry,
  SETTINGS_DEFAULTS,
  PUBLIC_SETTING_KEYS,
};
