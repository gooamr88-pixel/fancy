const { supabase } = require('../../config/supabase');
const { logAdminAction } = require('../../middleware/adminAudit');
const { CONFIG_ID, invalidate: invalidateConfigCache } = require('../../utils/configCache');

/**
 * PRINTED INVITATIONS — admin CRUD.
 *
 * The catalogue of physical, handcrafted cards sold by WhatsApp conversation
 * rather than checkout (see 20260825000000_printed_invitations.sql for why
 * there is no cart or order table). Public read path lives in
 * controllers/shopController.js; this file is everything an admin can change.
 *
 * Modelled directly on controllers/admin/blogController.js — same slug
 * strategy, same 23505 → 409 mapping, same logAdminAction on every mutation —
 * because this is the same shape of problem and a second, subtly different
 * house style in the same folder helps nobody.
 *
 * "shop_" is the identifier prefix; "Printed Invitations" is the customer-
 * facing name. Both are deliberate; see the migration header.
 */

/* ═══════════════════════════════════════════════════════════════════════
   Shared helpers
   ═══════════════════════════════════════════════════════════════════════ */

/** Basic http(s)/data-URI sanity check for image URLs. */
function isValidImageUrl(value) {
  if (!value) return true; // optional
  const s = String(value);
  // The admin uploader falls back to an inline base64 data URI when Supabase
  // storage is unreachable (see admin/_lib/uploadImage.js) — rejecting those
  // here would turn a working fallback into a save that silently fails.
  if (s.startsWith('data:image/')) return true;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
}

/** Finds a free slug in `table`, appending -2, -3, … on collision. */
async function findUniqueSlug(table, baseSlug, fallback, excludeId = null) {
  const base = baseSlug || fallback;
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    let query = supabase.from(table).select('id').eq('slug', candidate).limit(1);
    if (excludeId) query = query.neq('id', excludeId);
    const { data } = await query;
    if (!data || data.length === 0) return candidate;
  }
  return `${base}-${Date.now()}`;
}

/** Maps a Postgres unique-violation to an actionable 409 instead of a 500. */
function slugConflict(res) {
  return res.status(409).json({
    success: false,
    error: 'SLUG_TAKEN',
    message: 'That URL slug was just taken. Please try again.',
  });
}

const badRequest = (res, message) =>
  res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message });

/** `#RGB` / `#RRGGBB`, the only thing the badge renderer can safely inline. */
function isHexColor(value) {
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(value || ''));
}

function toIntOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Normalises the `specs` array. Anything without both a label and a value is
 * dropped rather than stored — a spec row with a blank side renders as a
 * dangling colon on the product page, and nobody ever notices they typed it.
 */
function normalizeSpecs(input) {
  if (!Array.isArray(input)) return [];
  return input
    .map((row) => ({
      label: String(row?.label ?? '').trim(),
      value: String(row?.value ?? '').trim(),
    }))
    .filter((row) => row.label && row.value)
    .slice(0, 30);
}

/** Normalises `highlights` — a flat list of short selling points. */
function normalizeHighlights(input) {
  if (!Array.isArray(input)) return [];
  return input
    .map((row) => String(row ?? '').trim())
    .filter(Boolean)
    .slice(0, 20);
}

/**
 * Attaches images and badges to a set of product rows.
 *
 * Two extra queries TOTAL regardless of how many products came back — not one
 * per product. Written as an explicit stitch rather than a PostgREST embed so
 * the ordering of images is ours to guarantee and the query stays legible.
 */
async function attachRelations(products) {
  // Filtered, not just defaulted: every caller passes the result of a query,
  // and one null row in the array reaches `p.id` and throws inside what is
  // only a decoration step.
  const rows = (products || []).filter(Boolean);
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
      .select('id, label, bg_color, text_color, is_filterable, sort_order, is_published')
      .order('sort_order', { ascending: true }),
  ]);

  const badgeById = new Map((badges || []).map((b) => [b.id, b]));
  const imagesByProduct = new Map();
  (images || []).forEach((img) => {
    if (!imagesByProduct.has(img.product_id)) imagesByProduct.set(img.product_id, []);
    imagesByProduct.get(img.product_id).push(img);
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
 * Replaces a product's badge set. Delete-then-insert rather than a diff: the
 * set is at most a handful of rows, and a diff here would be more code with
 * more ways to leave a stale link behind.
 */
async function setProductBadges(productId, badgeIds) {
  await supabase.from('shop_product_badges').delete().eq('product_id', productId);
  const ids = Array.isArray(badgeIds) ? [...new Set(badgeIds.filter(Boolean))] : [];
  if (ids.length === 0) return;
  await supabase
    .from('shop_product_badges')
    .insert(ids.map((badgeId) => ({ product_id: productId, badge_id: badgeId })));
}

/* ═══════════════════════════════════════════════════════════════════════
   Products
   ═══════════════════════════════════════════════════════════════════════ */

/** GET /api/v1/admin/shop/products — every row, published and draft. */
const listProducts = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('shop_products')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res.json({ success: true, products: await attachRelations(data) });
  } catch (err) {
    next(err);
  }
};

/** POST /api/v1/admin/shop/products */
const createProduct = async (req, res, next) => {
  const b = req.body || {};
  if (!b.title || !String(b.title).trim()) return badRequest(res, 'title is required.');
  if (b.priceCents !== undefined && b.priceCents !== null && b.priceCents !== '') {
    const price = toIntOrNull(b.priceCents);
    if (price === null || price < 0) return badRequest(res, 'priceCents must be a non-negative whole number of cents.');
  }

  try {
    const slug = await findUniqueSlug(
      'shop_products',
      b.slug && String(b.slug).trim() ? slugify(b.slug) : slugify(b.title),
      'product',
    );
    const publish = b.isPublished === true;

    const { data, error } = await supabase
      .from('shop_products')
      .insert({
        title: String(b.title).trim(),
        slug,
        category_id: b.categoryId || null,
        tagline: b.tagline ? String(b.tagline).trim() : null,
        description: b.description ? String(b.description) : null,
        // An empty string must become NULL, not 0 — see the migration: NULL is
        // "Price on request" and 0 is a card that costs nothing.
        price_cents: toIntOrNull(b.priceCents),
        compare_at_cents: toIntOrNull(b.compareAtCents),
        currency: b.currency ? String(b.currency).trim().toUpperCase().slice(0, 3) : 'CAD',
        price_unit: b.priceUnit ? String(b.priceUnit).trim() : null,
        min_order_qty: toIntOrNull(b.minOrderQty),
        lead_time_text: b.leadTimeText ? String(b.leadTimeText).trim() : null,
        specs: normalizeSpecs(b.specs),
        highlights: normalizeHighlights(b.highlights),
        whatsapp_message: b.whatsappMessage ? String(b.whatsappMessage).trim() : null,
        is_published: publish,
        is_featured: b.isFeatured === true,
        is_sold_out: b.isSoldOut === true,
        sort_order: toIntOrNull(b.sortOrder) ?? 0,
        meta_title: b.metaTitle ? String(b.metaTitle).trim() : null,
        meta_description: b.metaDescription ? String(b.metaDescription).trim() : null,
        published_at: publish ? new Date().toISOString() : null,
        created_by: req.user.id,
        updated_by: req.user.id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return slugConflict(res);
      throw error;
    }

    await setProductBadges(data.id, b.badgeIds);
    await logAdminAction(req, {
      action: 'shop_product.create', entityType: 'shop_product', entityId: data.id, after: data,
    });
    const [product] = await attachRelations([data]);
    return res.status(201).json({ success: true, product });
  } catch (err) {
    next(err);
  }
};

/** PATCH /api/v1/admin/shop/products/:productId */
const updateProduct = async (req, res, next) => {
  const { productId } = req.params;
  const b = req.body || {};
  const updates = {};

  try {
    const { data: existing } = await supabase
      .from('shop_products').select('*').eq('id', productId).maybeSingle();
    if (!existing) {
      return res.status(404).json({ success: false, error: 'PRODUCT_NOT_FOUND', message: 'Product not found.' });
    }

    if (b.title !== undefined) {
      if (!String(b.title).trim()) return badRequest(res, 'title cannot be empty.');
      updates.title = String(b.title).trim();
    }
    if (b.slug !== undefined) {
      const base = slugify(b.slug) || slugify(updates.title || existing.title);
      updates.slug = await findUniqueSlug('shop_products', base, 'product', productId);
    }
    if (b.categoryId !== undefined) updates.category_id = b.categoryId || null;
    if (b.tagline !== undefined) updates.tagline = b.tagline ? String(b.tagline).trim() : null;
    if (b.description !== undefined) updates.description = b.description ? String(b.description) : null;
    if (b.priceCents !== undefined) {
      const price = toIntOrNull(b.priceCents);
      if (price !== null && price < 0) return badRequest(res, 'priceCents must be a non-negative whole number of cents.');
      updates.price_cents = price;
    }
    if (b.compareAtCents !== undefined) updates.compare_at_cents = toIntOrNull(b.compareAtCents);
    if (b.currency !== undefined) updates.currency = String(b.currency || 'CAD').trim().toUpperCase().slice(0, 3);
    if (b.priceUnit !== undefined) updates.price_unit = b.priceUnit ? String(b.priceUnit).trim() : null;
    if (b.minOrderQty !== undefined) updates.min_order_qty = toIntOrNull(b.minOrderQty);
    if (b.leadTimeText !== undefined) updates.lead_time_text = b.leadTimeText ? String(b.leadTimeText).trim() : null;
    if (b.specs !== undefined) updates.specs = normalizeSpecs(b.specs);
    if (b.highlights !== undefined) updates.highlights = normalizeHighlights(b.highlights);
    if (b.whatsappMessage !== undefined) updates.whatsapp_message = b.whatsappMessage ? String(b.whatsappMessage).trim() : null;
    if (b.isFeatured !== undefined) updates.is_featured = b.isFeatured === true;
    if (b.isSoldOut !== undefined) updates.is_sold_out = b.isSoldOut === true;
    if (b.sortOrder !== undefined) updates.sort_order = toIntOrNull(b.sortOrder) ?? 0;
    if (b.metaTitle !== undefined) updates.meta_title = b.metaTitle ? String(b.metaTitle).trim() : null;
    if (b.metaDescription !== undefined) updates.meta_description = b.metaDescription ? String(b.metaDescription).trim() : null;

    if (b.isPublished !== undefined) {
      updates.is_published = b.isPublished === true;
      // First publish stamps the date; unpublishing keeps it, so re-publishing
      // an existing piece doesn't silently present it as brand new.
      if (updates.is_published && !existing.published_at) updates.published_at = new Date().toISOString();
    }

    updates.updated_by = req.user.id;
    updates.updated_at = new Date().toISOString();

    // maybeSingle + an explicit null check, uniform across all four update
    // handlers here: `.single()` turns "no such row" into a thrown PostgREST
    // error and therefore a 500, and the null branch is what keeps a row that
    // disappeared between the existence check above and this write from
    // reaching attachRelations([null]) and crashing on `null.id`.
    const { data, error } = await supabase
      .from('shop_products').update(updates).eq('id', productId).select().maybeSingle();
    if (error) {
      if (error.code === '23505') return slugConflict(res);
      throw error;
    }
    if (!data) {
      return res.status(404).json({ success: false, error: 'PRODUCT_NOT_FOUND', message: 'Product not found.' });
    }

    if (b.badgeIds !== undefined) await setProductBadges(productId, b.badgeIds);

    await logAdminAction(req, {
      action: 'shop_product.update', entityType: 'shop_product', entityId: productId, before: existing, after: data,
    });
    const [product] = await attachRelations([data]);
    return res.json({ success: true, product });
  } catch (err) {
    next(err);
  }
};

/** DELETE /api/v1/admin/shop/products/:productId */
const deleteProduct = async (req, res, next) => {
  const { productId } = req.params;
  try {
    const { data: existing } = await supabase
      .from('shop_products').select('*').eq('id', productId).maybeSingle();
    if (!existing) {
      return res.status(404).json({ success: false, error: 'PRODUCT_NOT_FOUND', message: 'Product not found.' });
    }
    // Images and badge links go with it (ON DELETE CASCADE); shop_inquiries is
    // ON DELETE SET NULL and keeps its product_title snapshot, so the demand
    // report survives — see the migration.
    const { error } = await supabase.from('shop_products').delete().eq('id', productId);
    if (error) throw error;

    await logAdminAction(req, {
      action: 'shop_product.delete', entityType: 'shop_product', entityId: productId, before: existing,
    });
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/admin/shop/products/reorder — { order: [productId, …] }
 *
 * This is the "the new one shows first" control. Position is stored, not
 * inferred, so the admin's arrangement survives every later edit; the public
 * listing's default sort reads it directly.
 */
const reorderProducts = async (req, res, next) => {
  const order = req.body?.order;
  if (!Array.isArray(order) || order.length === 0) {
    return badRequest(res, 'order must be a non-empty array of product ids.');
  }
  try {
    const results = await Promise.all(
      order.map((id, index) =>
        supabase.from('shop_products').update({ sort_order: index, updated_by: req.user.id }).eq('id', id),
      ),
    );

    // supabase-js RESOLVES with { error } instead of rejecting, so a bare
    // `await Promise.all(...)` here reported success no matter what the
    // database did. The admin drags a piece to the top, sees it move
    // (the list updates optimistically), and the order silently does not
    // persist — the failure only shows up on the next page load.
    const failed = results.find((r) => r && r.error);
    if (failed) throw failed.error;

    await logAdminAction(req, {
      action: 'shop_product.reorder', entityType: 'shop_product', metadata: { count: order.length },
    });
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

/* ═══════════════════════════════════════════════════════════════════════
   Gallery images
   ═══════════════════════════════════════════════════════════════════════ */

/** POST /api/v1/admin/shop/products/:productId/images */
const addProductImage = async (req, res, next) => {
  const { productId } = req.params;
  const { imageUrl, altText, sortOrder } = req.body || {};
  if (!imageUrl || !String(imageUrl).trim()) return badRequest(res, 'imageUrl is required.');
  if (!isValidImageUrl(imageUrl)) return badRequest(res, 'imageUrl must be a valid http(s) URL or an image data URI.');

  try {
    const { data: product } = await supabase
      .from('shop_products').select('id').eq('id', productId).maybeSingle();
    if (!product) {
      return res.status(404).json({ success: false, error: 'PRODUCT_NOT_FOUND', message: 'Product not found.' });
    }

    const { data, error } = await supabase
      .from('shop_product_images')
      .insert({
        product_id: productId,
        image_url: String(imageUrl).trim(),
        alt_text: altText ? String(altText).trim() : null,
        sort_order: toIntOrNull(sortOrder) ?? 0,
      })
      .select()
      .single();
    if (error) throw error;

    await logAdminAction(req, {
      action: 'shop_image.create', entityType: 'shop_product_image', entityId: data.id, after: data,
    });
    return res.status(201).json({ success: true, image: data });
  } catch (err) {
    next(err);
  }
};

/** PATCH /api/v1/admin/shop/images/:imageId — alt text and position. */
const updateProductImage = async (req, res, next) => {
  const { imageId } = req.params;
  const { altText, sortOrder } = req.body || {};
  const updates = {};
  if (altText !== undefined) updates.alt_text = altText ? String(altText).trim() : null;
  if (sortOrder !== undefined) updates.sort_order = toIntOrNull(sortOrder) ?? 0;
  if (Object.keys(updates).length === 0) return badRequest(res, 'Nothing to update.');

  try {
    // maybeSingle, not single. `.single()` on an update that matched no rows
    // returns a PostgREST error (PGRST116) rather than `data: null`, so the
    // 404 branch below was unreachable and a stale image id came back as a
    // generic 500 — which reads like the server broke rather than like the
    // row is gone. Same reason the sibling handlers check first.
    const { data, error } = await supabase
      .from('shop_product_images').update(updates).eq('id', imageId).select().maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'IMAGE_NOT_FOUND', message: 'Image not found.' });
    return res.json({ success: true, image: data });
  } catch (err) {
    next(err);
  }
};

/** DELETE /api/v1/admin/shop/images/:imageId */
const deleteProductImage = async (req, res, next) => {
  const { imageId } = req.params;
  try {
    const { error } = await supabase.from('shop_product_images').delete().eq('id', imageId);
    if (error) throw error;
    await logAdminAction(req, {
      action: 'shop_image.delete', entityType: 'shop_product_image', entityId: imageId,
    });
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

/* ═══════════════════════════════════════════════════════════════════════
   Collections (categories)
   ═══════════════════════════════════════════════════════════════════════ */

const listCategories = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('shop_categories').select('*').order('sort_order', { ascending: true });
    if (error) throw error;
    return res.json({ success: true, categories: data || [] });
  } catch (err) {
    next(err);
  }
};

const createCategory = async (req, res, next) => {
  const b = req.body || {};
  if (!b.name || !String(b.name).trim()) return badRequest(res, 'name is required.');
  try {
    const slug = await findUniqueSlug(
      'shop_categories',
      b.slug && String(b.slug).trim() ? slugify(b.slug) : slugify(b.name),
      'collection',
    );
    const { data, error } = await supabase
      .from('shop_categories')
      .insert({
        name: String(b.name).trim(),
        slug,
        description: b.description ? String(b.description).trim() : null,
        sort_order: toIntOrNull(b.sortOrder) ?? 0,
        is_published: b.isPublished !== false,
        created_by: req.user.id,
        updated_by: req.user.id,
      })
      .select()
      .single();
    if (error) {
      if (error.code === '23505') return slugConflict(res);
      throw error;
    }
    await logAdminAction(req, {
      action: 'shop_category.create', entityType: 'shop_category', entityId: data.id, after: data,
    });
    return res.status(201).json({ success: true, category: data });
  } catch (err) {
    next(err);
  }
};

const updateCategory = async (req, res, next) => {
  const { categoryId } = req.params;
  const b = req.body || {};
  const updates = {};
  try {
    const { data: existing } = await supabase
      .from('shop_categories').select('*').eq('id', categoryId).maybeSingle();
    if (!existing) {
      return res.status(404).json({ success: false, error: 'CATEGORY_NOT_FOUND', message: 'Collection not found.' });
    }
    if (b.name !== undefined) {
      if (!String(b.name).trim()) return badRequest(res, 'name cannot be empty.');
      updates.name = String(b.name).trim();
    }
    if (b.slug !== undefined) {
      const base = slugify(b.slug) || slugify(updates.name || existing.name);
      updates.slug = await findUniqueSlug('shop_categories', base, 'collection', categoryId);
    }
    if (b.description !== undefined) updates.description = b.description ? String(b.description).trim() : null;
    if (b.sortOrder !== undefined) updates.sort_order = toIntOrNull(b.sortOrder) ?? 0;
    if (b.isPublished !== undefined) updates.is_published = b.isPublished === true;
    updates.updated_by = req.user.id;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('shop_categories').update(updates).eq('id', categoryId).select().maybeSingle();
    if (error) {
      if (error.code === '23505') return slugConflict(res);
      throw error;
    }
    if (!data) {
      return res.status(404).json({ success: false, error: 'CATEGORY_NOT_FOUND', message: 'Collection not found.' });
    }
    await logAdminAction(req, {
      action: 'shop_category.update', entityType: 'shop_category', entityId: categoryId, before: existing, after: data,
    });
    return res.json({ success: true, category: data });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/admin/shop/categories/:categoryId
 *
 * Products in the collection are NOT deleted — the FK is ON DELETE SET NULL,
 * so they become uncategorised and stay on sale. Deleting a filter must never
 * be a way to accidentally delete stock.
 */
const deleteCategory = async (req, res, next) => {
  const { categoryId } = req.params;
  try {
    const { error } = await supabase.from('shop_categories').delete().eq('id', categoryId);
    if (error) throw error;
    await logAdminAction(req, {
      action: 'shop_category.delete', entityType: 'shop_category', entityId: categoryId,
    });
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

/* ═══════════════════════════════════════════════════════════════════════
   Labels (badges) — "New", "Best seller", anything the admin types
   ═══════════════════════════════════════════════════════════════════════ */

const listBadges = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('shop_badges').select('*').order('sort_order', { ascending: true });
    if (error) throw error;
    return res.json({ success: true, badges: data || [] });
  } catch (err) {
    next(err);
  }
};

const createBadge = async (req, res, next) => {
  const b = req.body || {};
  if (!b.label || !String(b.label).trim()) return badRequest(res, 'label is required.');
  if (b.bgColor !== undefined && b.bgColor && !isHexColor(b.bgColor)) return badRequest(res, 'bgColor must be a hex colour like #8A6D34.');
  if (b.textColor !== undefined && b.textColor && !isHexColor(b.textColor)) return badRequest(res, 'textColor must be a hex colour like #FFFFFF.');

  try {
    const { data, error } = await supabase
      .from('shop_badges')
      .insert({
        label: String(b.label).trim().slice(0, 40),
        bg_color: b.bgColor || '#8A6D34',
        text_color: b.textColor || '#FFFFFF',
        is_filterable: b.isFilterable !== false,
        sort_order: toIntOrNull(b.sortOrder) ?? 0,
        is_published: b.isPublished !== false,
        created_by: req.user.id,
        updated_by: req.user.id,
      })
      .select()
      .single();
    if (error) throw error;
    await logAdminAction(req, {
      action: 'shop_badge.create', entityType: 'shop_badge', entityId: data.id, after: data,
    });
    return res.status(201).json({ success: true, badge: data });
  } catch (err) {
    next(err);
  }
};

const updateBadge = async (req, res, next) => {
  const { badgeId } = req.params;
  const b = req.body || {};
  const updates = {};
  if (b.label !== undefined) {
    if (!String(b.label).trim()) return badRequest(res, 'label cannot be empty.');
    updates.label = String(b.label).trim().slice(0, 40);
  }
  if (b.bgColor !== undefined) {
    if (!isHexColor(b.bgColor)) return badRequest(res, 'bgColor must be a hex colour like #8A6D34.');
    updates.bg_color = b.bgColor;
  }
  if (b.textColor !== undefined) {
    if (!isHexColor(b.textColor)) return badRequest(res, 'textColor must be a hex colour like #FFFFFF.');
    updates.text_color = b.textColor;
  }
  if (b.isFilterable !== undefined) updates.is_filterable = b.isFilterable === true;
  if (b.sortOrder !== undefined) updates.sort_order = toIntOrNull(b.sortOrder) ?? 0;
  if (b.isPublished !== undefined) updates.is_published = b.isPublished === true;
  if (Object.keys(updates).length === 0) return badRequest(res, 'Nothing to update.');
  updates.updated_by = req.user.id;
  updates.updated_at = new Date().toISOString();

  try {
    // maybeSingle for the same reason as the others — and this handler has no
    // prior existence check at all, so with `.single()` every edit of a label
    // another admin had just deleted came back as a 500.
    const { data, error } = await supabase
      .from('shop_badges').update(updates).eq('id', badgeId).select().maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'BADGE_NOT_FOUND', message: 'Label not found.' });
    await logAdminAction(req, {
      action: 'shop_badge.update', entityType: 'shop_badge', entityId: badgeId, after: data,
    });
    return res.json({ success: true, badge: data });
  } catch (err) {
    next(err);
  }
};

const deleteBadge = async (req, res, next) => {
  const { badgeId } = req.params;
  try {
    // shop_product_badges is ON DELETE CASCADE — the links go, the products stay.
    const { error } = await supabase.from('shop_badges').delete().eq('id', badgeId);
    if (error) throw error;
    await logAdminAction(req, {
      action: 'shop_badge.delete', entityType: 'shop_badge', entityId: badgeId,
    });
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

/* ═══════════════════════════════════════════════════════════════════════
   Section settings
   ═══════════════════════════════════════════════════════════════════════ */

/** The shape the frontend relies on; also the repair for a hand-edited row. */
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

const SORT_MODES = ['manual', 'newest', 'price_asc', 'price_desc'];

/** GET /api/v1/admin/shop/settings */
const getSettings = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('super_admin_config').select('shop_settings').eq('id', CONFIG_ID).single();
    if (error) throw error;
    return res.json({ success: true, settings: { ...SETTINGS_DEFAULTS, ...(data?.shop_settings || {}) } });
  } catch (err) {
    next(err);
  }
};

/** PATCH /api/v1/admin/shop/settings */
const updateSettings = async (req, res, next) => {
  const b = req.body || {};
  try {
    const { data: existing, error: readErr } = await supabase
      .from('super_admin_config').select('shop_settings').eq('id', CONFIG_ID).single();
    if (readErr) throw readErr;

    const current = { ...SETTINGS_DEFAULTS, ...(existing?.shop_settings || {}) };
    const next_ = { ...current };

    if (b.enabled !== undefined) next_.enabled = b.enabled === true;
    if (b.showOnHomepage !== undefined) next_.show_on_homepage = b.showOnHomepage === true;
    if (b.showInDashboard !== undefined) next_.show_in_dashboard = b.showInDashboard === true;
    if (b.whatsappNumber !== undefined) {
      // Stored as digits only. The `wa.me` URL format accepts nothing else, and
      // an admin will reasonably paste "+1 (905) 555-0134" — normalising here
      // means the four places that build the link never have to.
      next_.whatsapp_number = String(b.whatsappNumber || '').replace(/\D/g, '').slice(0, 20);
    }
    if (b.whatsappGreeting !== undefined) next_.whatsapp_greeting = String(b.whatsappGreeting || '').trim().slice(0, 500);
    if (b.heroKicker !== undefined) next_.hero_kicker = String(b.heroKicker || '').trim().slice(0, 120);
    if (b.heroTitle !== undefined) next_.hero_title = String(b.heroTitle || '').trim().slice(0, 120);
    if (b.heroSubtitle !== undefined) next_.hero_subtitle = String(b.heroSubtitle || '').trim().slice(0, 400);
    if (b.defaultLeadTime !== undefined) next_.default_lead_time = String(b.defaultLeadTime || '').trim().slice(0, 200);
    if (b.defaultSort !== undefined) {
      if (!SORT_MODES.includes(b.defaultSort)) {
        return badRequest(res, `defaultSort must be one of: ${SORT_MODES.join(', ')}.`);
      }
      next_.default_sort = b.defaultSort;
    }

    const { error } = await supabase
      .from('super_admin_config')
      .update({ shop_settings: next_, updated_by: req.user.id, updated_at: new Date().toISOString() })
      .eq('id', CONFIG_ID);
    if (error) throw error;

    // The config row is cached in-process for 30s; without this the admin saves
    // a WhatsApp number and the site keeps serving the old one for half a minute.
    invalidateConfigCache();

    await logAdminAction(req, {
      action: 'shop_settings.update', entityType: 'shop_settings', before: current, after: next_,
    });
    return res.json({ success: true, settings: next_ });
  } catch (err) {
    next(err);
  }
};

/* ═══════════════════════════════════════════════════════════════════════
   Interest report
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * GET /api/v1/admin/shop/inquiries — who tapped through to WhatsApp, and on what.
 *
 * The point of the section is a conversation that happens off-platform, so
 * this is the only place the funnel is visible at all: without it nobody can
 * tell a card that sells from a card nobody clicks.
 */
const listInquiries = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('shop_inquiries')
      .select('id, product_id, product_title, source, created_at')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) throw error;

    const rows = data || [];
    const byProduct = new Map();
    rows.forEach((row) => {
      const key = row.product_id || `deleted:${row.product_title || 'Unknown'}`;
      if (!byProduct.has(key)) {
        byProduct.set(key, {
          productId: row.product_id,
          title: row.product_title || 'Deleted product',
          count: 0,
          lastAt: row.created_at,
        });
      }
      byProduct.get(key).count += 1;
    });

    return res.json({
      success: true,
      inquiries: rows.slice(0, 100),
      summary: [...byProduct.values()].sort((a, b) => b.count - a.count),
      total: rows.length,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listProducts, createProduct, updateProduct, deleteProduct, reorderProducts,
  addProductImage, updateProductImage, deleteProductImage,
  listCategories, createCategory, updateCategory, deleteCategory,
  listBadges, createBadge, updateBadge, deleteBadge,
  getSettings, updateSettings, listInquiries,
  // exported for tests
  SETTINGS_DEFAULTS, SORT_MODES, normalizeSpecs, normalizeHighlights, slugify,
};
