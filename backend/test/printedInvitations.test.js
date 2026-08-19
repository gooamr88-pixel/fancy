require('./helpers/env');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { injectModule } = require('./helpers/inject');
const { createMockSupabase } = require('./helpers/mockSupabase');
const { mockReq, invoke } = require('./helpers/http');

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PRINTED INVITATIONS — the physical-card catalogue sold by WhatsApp.
 *
 * Four properties this file exists to hold, each one a way the feature breaks
 * silently rather than loudly:
 *
 *   1. A NULL PRICE IS "PRICE ON REQUEST", NOT ZERO. Coerce it anywhere along
 *      the chain and the site publishes handcrafted cards that cost $0.00.
 *   2. DRAFTS ARE NOT PUBLIC. The listing is served to the open internet; a
 *      missing is_published filter shows unfinished work to everyone.
 *   3. THE PUBLIC ENDPOINT DOES NOT TOUCH getPlatformConfig(). That helper
 *      returns the whole super_admin_config row — pricing tiers and SMS
 *      margins included — and this endpoint is unauthenticated.
 *   4. THE ADMIN'S ORDER IS THE PUBLIC ORDER. "Make the new one show first" is
 *      a stored sort_order, not a guess from a timestamp.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const mock = createMockSupabase();
injectModule('../../config/supabase', { supabase: mock.supabase });
// Paths resolve relative to test/helpers/inject.js, not to this file.
injectModule('../../middleware/adminAudit', { logAdminAction: async () => {}, captureRequestMeta: () => ({}) });

const adminCtrl = require('../controllers/admin/shopController');
const publicCtrl = require('../controllers/shopController');

const REPO = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

const PRODUCT = '11111111-1111-4111-8111-111111111111';
const PRODUCT_B = '22222222-2222-4222-8222-222222222222';
const ADMIN = { id: '33333333-3333-4333-8333-333333333333', access: { isSuperAdmin: true, roleKeys: ['super_admin'] } };

test.beforeEach(() => mock.reset());

/* ═══════════════════════════════════════════════════════════════════════
   1. A null price survives the whole chain
   ═══════════════════════════════════════════════════════════════════════ */

test('createProduct stores a null price rather than 0 when no price is given', async () => {
  let inserted = null;
  mock.setResolver((s) => {
    if (s.table === 'shop_products' && s.op === 'insert') {
      inserted = s.payload;
      return { data: { ...s.payload, id: PRODUCT } };
    }
    if (s.table === 'shop_products' && s.op === 'select') return { data: [] };
    return { data: [] };
  });

  const req = mockReq({ user: ADMIN, body: { title: 'Velvet & Gold Suite', priceCents: '' } });
  const { res } = await invoke(adminCtrl.createProduct, req);

  assert.equal(res.statusCode, 201);
  assert.equal(inserted.price_cents, null,
    'an empty price must be NULL — 0 publishes a handcrafted card as free');
});

test('createProduct keeps a real price intact', async () => {
  let inserted = null;
  mock.setResolver((s) => {
    if (s.table === 'shop_products' && s.op === 'insert') {
      inserted = s.payload;
      return { data: { ...s.payload, id: PRODUCT } };
    }
    return { data: [] };
  });

  const req = mockReq({ user: ADMIN, body: { title: 'Plaque', priceCents: 899 } });
  await invoke(adminCtrl.createProduct, req);
  assert.equal(inserted.price_cents, 899);
});

test('a negative price is rejected, not clamped', async () => {
  mock.setResolver(() => ({ data: [] }));
  const req = mockReq({ user: ADMIN, body: { title: 'Bad', priceCents: -500 } });
  const { res } = await invoke(adminCtrl.createProduct, req);
  assert.equal(res.statusCode, 400);
});

test('the admin UI converts dollars to cents without floating-point drift', () => {
  // 8.99 * 100 === 898.9999999999999 in IEEE-754. A bare multiply plus a
  // truncation stores $8.98 — a real, silent, one-cent underprice on every
  // product whose price has decimals.
  const src = read('frontend/src/app/admin/(panel)/shop/page.js');
  assert.match(src, /Math\.round\(n \* 100\)/,
    'dollarsToCents must round, not truncate');
  assert.match(src, /if \(!s\) return null;/,
    'an empty price field must become null, not 0');
});

/* ═══════════════════════════════════════════════════════════════════════
   2. Drafts are not public
   ═══════════════════════════════════════════════════════════════════════ */

test('the public listing filters to published products, collections and labels', async () => {
  mock.setResolver((s) => {
    if (s.table === 'super_admin_config') return { data: { shop_settings: { enabled: true } } };
    return { data: [] };
  });

  const req = mockReq({});
  await invoke(publicCtrl.getPublicShop, req);

  const published = (table) => mock.calls
    .filter((c) => c.table === table && c.op === 'select')
    .some((c) => (c.filters.eq || []).some(([col, val]) => col === 'is_published' && val === true));

  assert.ok(published('shop_products'), 'products must be filtered to published');
  assert.ok(published('shop_categories'), 'collections must be filtered to published');
  assert.ok(published('shop_badges'), 'labels must be filtered to published');
});

test('an unpublished slug is a 404, not an empty product page', async () => {
  mock.setResolver((s) => {
    if (s.table === 'super_admin_config') return { data: { shop_settings: { enabled: true } } };
    if (s.table === 'shop_products') return { data: null };
    return { data: [] };
  });

  const req = mockReq({ params: { slug: 'draft-piece' } });
  const { res } = await invoke(publicCtrl.getPublicProductBySlug, req);

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error, 'PRODUCT_NOT_FOUND');
});

test('the master switch empties the catalogue and 404s every product', async () => {
  mock.setResolver((s) => {
    if (s.table === 'super_admin_config') return { data: { shop_settings: { enabled: false } } };
    return { data: [{ id: PRODUCT, title: 'Should not be served' }] };
  });

  const { res: list } = await invoke(publicCtrl.getPublicShop, mockReq({}));
  assert.equal(list.body.enabled, false);
  assert.deepEqual(list.body.products, [], 'a disabled section must serve no products at all');

  const { res: detail } = await invoke(publicCtrl.getPublicProductBySlug, mockReq({ params: { slug: 'x' } }));
  assert.equal(detail.statusCode, 404,
    'hiding the nav link is not enough — a bookmarked URL must stop resolving too');
});

/* ═══════════════════════════════════════════════════════════════════════
   3. No pricing config leaks through the anonymous endpoint
   ═══════════════════════════════════════════════════════════════════════ */

test('the public settings payload is an allowlist and carries no platform pricing', async () => {
  mock.setResolver((s) => {
    if (s.table === 'super_admin_config') {
      // What the real row actually holds beside shop_settings.
      return {
        data: {
          shop_settings: {
            enabled: true,
            whatsapp_number: '19055550134',
            internal_admin_note: 'must never ship',
          },
        },
      };
    }
    return { data: [] };
  });

  const { res } = await invoke(publicCtrl.getPublicShop, mockReq({}));
  const keys = Object.keys(res.body.settings);

  assert.ok(keys.includes('whatsapp_number'), 'the number is needed to build the CTA');
  assert.ok(!keys.includes('internal_admin_note'),
    'settings must be an allowlist — an unknown key added later must not ship by default');
  assert.deepEqual(keys.sort(), [...publicCtrl.PUBLIC_SETTING_KEYS].sort());
});

test('the public controller selects shop_settings by name and never calls getPlatformConfig', () => {
  const src = read('backend/controllers/shopController.js');
  assert.match(src, /\.select\('shop_settings'\)/,
    'the anonymous endpoint must select the one column, not the whole config row');

  // Comments stripped FIRST. The file's own docblock explains why
  // getPlatformConfig must not be called here, and a naive grep fires on that
  // prose — the same "comment counted as code" false positive that made this
  // repo's earlier responsive greps unusable.
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
  assert.ok(!/getPlatformConfig\s*\(/.test(code),
    'getPlatformConfig returns pricing_tiers and SMS margins — never call it from a public path');
});

/* ═══════════════════════════════════════════════════════════════════════
   4. The admin's order is the public order
   ═══════════════════════════════════════════════════════════════════════ */

test('reorder writes sort_order as the position in the submitted list', async () => {
  const writes = [];
  mock.setResolver((s) => {
    if (s.table === 'shop_products' && s.op === 'update') writes.push(s.payload);
    return { data: [] };
  });

  const req = mockReq({ user: ADMIN, body: { order: [PRODUCT_B, PRODUCT] } });
  const { res } = await invoke(adminCtrl.reorderProducts, req);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(writes.map((w) => w.sort_order), [0, 1]);
});

test('a failed reorder is reported, not swallowed as success', async () => {
  // supabase-js RESOLVES with { error } rather than rejecting, so a bare
  // `await Promise.all(updates)` returns 200 no matter what the database did.
  // The admin then sees the row move (the list is optimistic) and the order
  // silently does not persist until the next page load contradicts it.
  mock.setResolver((s) => {
    if (s.table === 'shop_products' && s.op === 'update') {
      return { data: null, error: { message: 'permission denied' } };
    }
    return { data: [] };
  });

  const req = mockReq({ user: ADMIN, body: { order: [PRODUCT, PRODUCT_B] } });
  const { res, nextErr } = await invoke(adminCtrl.reorderProducts, req);

  assert.ok(nextErr, 'the write failure must reach the error handler');
  assert.notEqual(res.body?.success, true, 'a failed reorder must not answer success');
});

test('patching a missing image is a 404, not a 500', async () => {
  // `.single()` on an update that matched nothing returns a PostgREST error
  // (PGRST116), not `data: null` — so a 404 branch written after
  // `if (error) throw` can never run, and a stale image id surfaces as "the
  // server broke" instead of "that image is gone".
  //
  // The resolver keys on `terminal` ON PURPOSE. createMockSupabase returns the
  // same shape for .single() and .maybeSingle(), so a test that ignores the
  // terminal passes against BOTH the fixed and the broken version and guards
  // nothing. This reproduces the difference the real client makes.
  mock.setResolver((s) => {
    if (s.table === 'shop_product_images') {
      return s.terminal === 'single'
        ? { data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' } }
        : { data: null, error: null };
    }
    return { data: [] };
  });

  const req = mockReq({ user: ADMIN, params: { imageId: PRODUCT }, body: { altText: 'x' } });
  const { res, nextErr } = await invoke(adminCtrl.updateProductImage, req);

  assert.equal(nextErr, null, 'a missing row is a client error, not a thrown one');
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error, 'IMAGE_NOT_FOUND');
});

test('the inquiry counter is incremented atomically, not read-then-written', async () => {
  const rpcCalls = [];
  mock.setResolver((s) => {
    if (s.op === 'rpc') { rpcCalls.push(s.fn); return { data: null }; }
    if (s.table === 'shop_products' && s.op === 'select') return { data: { id: PRODUCT, title: 'X' } };
    return { data: [] };
  });

  await invoke(publicCtrl.recordShopInquiry, mockReq({ params: { productId: PRODUCT }, body: {} }));

  assert.ok(rpcCalls.includes('increment_shop_product_inquiry'),
    'two taps landing together must not lose one of the increments');
  const wrote = mock.calls.some((c) => c.table === 'shop_products' && c.op === 'update');
  assert.equal(wrote, false, 'no read-modify-write on the counter');
});

test('both counter functions exist in the migration', () => {
  const sql = read('supabase/migrations/20260825000000_printed_invitations.sql');
  ['increment_shop_product_view', 'increment_shop_product_inquiry'].forEach((fn) => {
    assert.match(sql, new RegExp(`CREATE OR REPLACE FUNCTION ${fn}`),
      `${fn} is called by a controller and must exist`);
  });
});

test('reorder refuses an empty payload rather than silently doing nothing', async () => {
  mock.setResolver(() => ({ data: [] }));
  const { res } = await invoke(adminCtrl.reorderProducts, mockReq({ user: ADMIN, body: { order: [] } }));
  assert.equal(res.statusCode, 400);
});

test('the public listing orders by sort_order first', async () => {
  mock.setResolver((s) => {
    if (s.table === 'super_admin_config') return { data: { shop_settings: { enabled: true } } };
    return { data: [] };
  });
  await invoke(publicCtrl.getPublicShop, mockReq({}));

  const src = read('backend/controllers/shopController.js');
  assert.match(src, /\.order\('sort_order', \{ ascending: true \}\)/,
    'the catalogue must read the admin arrangement, not invent its own');
});

/* ═══════════════════════════════════════════════════════════════════════
   Slugs, permissions, routing
   ═══════════════════════════════════════════════════════════════════════ */

test('a slug collision surfaces as 409, not a generic 500', async () => {
  mock.setResolver((s) => {
    if (s.table === 'shop_products' && s.op === 'insert') {
      return { data: null, error: { code: '23505', message: 'duplicate key' } };
    }
    return { data: [] };
  });

  const req = mockReq({ user: ADMIN, body: { title: 'Duplicate' } });
  const { res } = await invoke(adminCtrl.createProduct, req);

  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error, 'SLUG_TAKEN');
});

test('reads need cms.view and every write needs cms.manage', () => {
  const src = read('backend/routes/admin/shopRoutes.js');

  const writes = src.match(/router\.(post|patch|delete)\([^)]*\)/g) || [];
  assert.ok(writes.length >= 12, `expected the full write surface, found ${writes.length}`);
  writes.forEach((line) => {
    assert.match(line, /requirePermission\('cms\.manage'\)/,
      `an unguarded write route would let any authenticated admin edit the shop: ${line}`);
  });

  const reads = src.match(/router\.get\([^)]*\)/g) || [];
  assert.ok(reads.length >= 5);
  reads.forEach((line) => {
    assert.match(line, /requirePermission\('cms\.(view|manage)'\)/, `unguarded read: ${line}`);
  });
});

test('/products/reorder is declared before /products/:productId', () => {
  const src = read('backend/routes/admin/shopRoutes.js');
  const reorder = src.indexOf("'/products/reorder'");
  const param = src.indexOf("'/products/:productId'");
  assert.ok(reorder > -1 && param > -1);
  assert.ok(reorder < param,
    'declared the other way round, "reorder" is parsed as a product id and rejected by the UUID guard');
});

test('the shop router is actually mounted on the admin router', () => {
  const src = read('backend/routes/adminRoutes.js');
  assert.match(src, /require\('\.\/admin\/shopRoutes'\)/);
  assert.match(src, /router\.use\('\/shop', shopRoutes\)/);
});

test('the public routes are registered and the inquiry beacon is rate-limited', () => {
  const src = read('backend/routes/publicRoutes.js');
  assert.match(src, /router\.get\('\/shop', getPublicShop\)/);
  assert.match(src, /router\.get\('\/shop\/:slug', getPublicProductBySlug\)/);
  const beacon = src.slice(src.indexOf("'/shop/:productId/inquiry'"));
  assert.match(beacon.slice(0, 600), /rateLimit\(/,
    'an uncapped anonymous write is an invitation to inflate the only demand signal there is');
});

/* ═══════════════════════════════════════════════════════════════════════
   The interest beacon
   ═══════════════════════════════════════════════════════════════════════ */

test('an inquiry snapshots the product title so the report survives deletion', async () => {
  let inserted = null;
  mock.setResolver((s) => {
    if (s.table === 'shop_products' && s.op === 'select') {
      return { data: { id: PRODUCT, title: 'Velvet & Gold Suite', inquiry_count: 4 } };
    }
    if (s.table === 'shop_inquiries' && s.op === 'insert') { inserted = s.payload; return { data: s.payload }; }
    return { data: [] };
  });

  const req = mockReq({ params: { productId: PRODUCT }, body: { source: 'whatsapp' } });
  const { res } = await invoke(publicCtrl.recordShopInquiry, req);

  assert.equal(res.statusCode, 200);
  assert.equal(inserted.product_title, 'Velvet & Gold Suite',
    'without the snapshot, deleting a retired product rewrites its demand history to nothing');
});

test('the inquiry beacon answers 200 even when the write fails', async () => {
  mock.setResolver((s) => {
    if (s.table === 'shop_products' && s.op === 'select') return { data: { id: PRODUCT, title: 'X' } };
    if (s.table === 'shop_inquiries') return { data: null, error: { message: 'boom' } };
    return { data: [] };
  });

  const { res } = await invoke(
    publicCtrl.recordShopInquiry,
    mockReq({ params: { productId: PRODUCT }, body: {} }),
  );
  assert.equal(res.statusCode, 200,
    'analytics must never stand between a customer and the conversation they are starting');
});

test('an unknown source is normalised rather than stored raw', async () => {
  let inserted = null;
  mock.setResolver((s) => {
    if (s.table === 'shop_products' && s.op === 'select') return { data: { id: PRODUCT, title: 'X' } };
    if (s.table === 'shop_inquiries' && s.op === 'insert') { inserted = s.payload; return { data: s.payload }; }
    return { data: [] };
  });

  await invoke(
    publicCtrl.recordShopInquiry,
    mockReq({ params: { productId: PRODUCT }, body: { source: "'; DROP TABLE" } }),
  );
  // The column carries a CHECK constraint; an unnormalised value would make the
  // insert fail and lose the signal entirely.
  assert.equal(inserted.source, 'whatsapp');
});

/* ═══════════════════════════════════════════════════════════════════════
   Settings
   ═══════════════════════════════════════════════════════════════════════ */

test('a pasted WhatsApp number is normalised to digits', async () => {
  let written = null;
  mock.setResolver((s) => {
    if (s.table === 'super_admin_config' && s.op === 'select') return { data: { shop_settings: {} } };
    if (s.table === 'super_admin_config' && s.op === 'update') { written = s.payload; return { data: {} }; }
    return { data: [] };
  });

  const req = mockReq({ user: ADMIN, body: { whatsappNumber: '+1 (905) 555-0134' } });
  await invoke(adminCtrl.updateSettings, req);

  assert.equal(written.shop_settings.whatsapp_number, '19055550134',
    'wa.me accepts digits only — punctuation here produces a link that opens nothing');
});

test('an unknown sort mode is refused', async () => {
  mock.setResolver((s) => {
    if (s.table === 'super_admin_config') return { data: { shop_settings: {} } };
    return { data: [] };
  });
  const { res } = await invoke(adminCtrl.updateSettings, mockReq({ user: ADMIN, body: { defaultSort: 'random' } }));
  assert.equal(res.statusCode, 400);
});

test('saving settings invalidates the 30s config cache', () => {
  const src = read('backend/controllers/admin/shopController.js');
  assert.match(src, /invalidateConfigCache\(\)/,
    'without this the admin saves a number and the site serves the old one for half a minute');
});

/* ═══════════════════════════════════════════════════════════════════════
   Normalisation helpers
   ═══════════════════════════════════════════════════════════════════════ */

test('half-filled specification rows are dropped, not stored', () => {
  const out = adminCtrl.normalizeSpecs([
    { label: 'Material', value: '350gsm cotton' },
    { label: 'Size', value: '   ' },
    { label: '', value: 'orphan' },
  ]);
  assert.deepEqual(out, [{ label: 'Material', value: '350gsm cotton' }]);
});

test('blank selling points are dropped', () => {
  assert.deepEqual(adminCtrl.normalizeHighlights(['Gold foil', '  ', '', 'Letterpress']), ['Gold foil', 'Letterpress']);
});

test('normalisers survive a non-array (a hand-written API call)', () => {
  assert.deepEqual(adminCtrl.normalizeSpecs(null), []);
  assert.deepEqual(adminCtrl.normalizeHighlights('nope'), []);
});

/* ═══════════════════════════════════════════════════════════════════════
   Migration
   ═══════════════════════════════════════════════════════════════════════ */

test('the migration keeps interest history when a product is deleted', () => {
  const sql = read('supabase/migrations/20260825000000_printed_invitations.sql');

  const inquiries = sql.slice(sql.indexOf('CREATE TABLE IF NOT EXISTS shop_inquiries'));
  assert.match(inquiries.slice(0, 900), /product_id\s+uuid REFERENCES shop_products\(id\) ON DELETE SET NULL/,
    'CASCADE here would delete last quarter\'s demand report along with a retired product');

  const images = sql.slice(sql.indexOf('CREATE TABLE IF NOT EXISTS shop_product_images'));
  assert.match(images.slice(0, 600), /ON DELETE CASCADE/,
    'orphaned gallery rows would accumulate forever');
});

test('deleting a collection does not delete the pieces filed under it', () => {
  const sql = read('supabase/migrations/20260825000000_printed_invitations.sql');
  assert.match(sql, /category_id\s+uuid REFERENCES shop_categories\(id\) ON DELETE SET NULL/,
    'deleting a filter must never be a way to accidentally delete stock');
});

test('the ordering number is seeded, digits-only, and cannot clobber a later change', () => {
  const sql = read('supabase/migrations/20260825000000_printed_invitations.sql');

  // +1 (619) 666-6620. wa.me accepts digits only — punctuation or a leading
  // "+" here produces a link that opens nothing, and every "Order on WhatsApp"
  // button on the site is built from this one value.
  assert.match(sql, /"whatsapp_number": "16196666620"/,
    'the DEFAULT must carry the number for a fresh install');

  // A DEFAULT only reaches the row when the column is CREATED, so an
  // already-applied migration needs the backfill too.
  assert.match(sql, /UPDATE super_admin_config[\s\S]*whatsapp_number.*16196666620/,
    'a backfill is required or an existing config row keeps an empty number');

  // …and the backfill must be conditional. Unconditional, re-running the
  // migration would silently repoint every order button at this number after
  // an admin had changed it in the UI.
  assert.match(sql, /WHERE COALESCE\(shop_settings ->> 'whatsapp_number', ''\) = ''/,
    'the backfill must only fill an EMPTY number, never overwrite one');

  const seeded = sql.match(/"whatsapp_number": "(\d*)"/)[1];
  assert.match(seeded, /^\d+$/, 'digits only — no +, spaces, brackets or dashes');
  assert.equal(seeded.length, 11, 'country code + 10-digit NANP number');
});

test('every new table has RLS enabled', () => {
  const sql = read('supabase/migrations/20260825000000_printed_invitations.sql');
  ['shop_categories', 'shop_badges', 'shop_products', 'shop_product_images', 'shop_product_badges', 'shop_inquiries']
    .forEach((t) => {
      assert.match(sql, new RegExp(`ALTER TABLE ${t}\\s+ENABLE ROW LEVEL SECURITY`),
        `${t} is reachable with the anon key unless RLS is on`);
    });
});

test('the view counter is atomic in the database, not read-modify-write', () => {
  const sql = read('supabase/migrations/20260825000000_printed_invitations.sql');
  assert.match(sql, /SET view_count = view_count \+ 1/,
    'two concurrent visitors lose an increment under read-modify-write');
});
